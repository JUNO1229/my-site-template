"""모든 리드 소스(도시공원 관리기관·일반 테마파크·허가 테마파크)를 SQLite leads/contacts 로 적재한다.
- 원본(data/raw)은 수정하지 않으며, DB 는 언제든 재생성 가능.
- 중복 병합: 지자체 부서 중복(시·군 단위), 허가 파일과 일반 파일의 동일 시설
- 연락처 우선순위: verified_official > public_data > third_party_recheck
실행: python src/build_master.py [--db data/leads.db]
"""
import argparse
import os
import re
import sqlite3
import tempfile
import pandas as pd

import ingest_parks
import ingest_themeparks
import ingest_extra
from common import load_config

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
RAW, MANUAL = f"{ROOT}/data/raw", f"{ROOT}/data/manual"
PRIORITY = {"verified_official": 3, "public_data": 2, "third_party_recheck": 1, "unknown": 0}


def city_key(org: str) -> str:
    """'경기도 수원시 권선구 녹지공원과' -> '경기도 수원시' (부서·구 단위 중복 병합용)."""
    t = str(org).split()
    if len(t) >= 2 and re.search(r"(시|군|구)$", t[1]):
        return " ".join(t[:2])
    return str(org)


def merge_orgs(o: pd.DataFrame) -> pd.DataFrame:
    o = o.copy()
    o["key"] = o["org"].map(city_key)
    rows = []
    for key, g in o.groupby("key"):
        main = g.sort_values("n", ascending=False).iloc[0]
        rows.append(dict(
            sido=main.sido, kind=main.kind, name=key, phone=main.phone if isinstance(main.phone, str) else "",
            n=g.n.sum(), big=g.big.sum(), water=g.water.sum(), play=g.play.sum(), ha=round(g.ha.sum(), 1),
            top=main.top, depts=" / ".join(g.org.tolist()) if len(g) > 1 else ""))
    M = pd.DataFrame(rows)
    M["g"] = M.apply(ingest_parks.grade, axis=1)
    c = load_config()["parks"]["score"]
    M["score"] = (M.big.clip(upper=c["big_cap"]) + c["water_weight"] * M.water.clip(upper=c["water_cap"])
                  + c["play_weight"] * M.play.clip(upper=c["play_cap"]) + c["parks_weight"] * M.n.clip(upper=c["parks_cap"]))
    return M


def norm_name(s: str) -> str:
    return re.sub(r"\(주\)|\(유\)|주식회사|\s", "", str(s))


def build(db_path: str):
    with tempfile.TemporaryDirectory() as tmp:
        ingest_parks.main(f"{RAW}/parks_national_std.csv", tmp)
        ingest_themeparks.main(f"{RAW}/themepark_general.csv", f"{tmp}/general.csv")
        ingest_themeparks.main(f"{RAW}/themepark_permit.csv", f"{tmp}/permit.csv", permit=True)
        orgs, water = pd.read_csv(f"{tmp}/orgs_from_parks.csv"), pd.read_csv(f"{tmp}/water_parks.csv")
        gen, per = pd.read_csv(f"{tmp}/general.csv", dtype=str), pd.read_csv(f"{tmp}/permit.csv", dtype=str)

    saved_outreach = saved_points = saved_cands = saved_docs = saved_disp = None
    if os.path.exists(db_path):  # 사용자 입력(영업 단계·영업 포인트)은 재생성 후에도 이름+주소로 복원
        old = sqlite3.connect(db_path)
        saved_outreach = pd.read_sql("SELECT l.name,l.address,o.* FROM outreach o JOIN leads l ON l.id=o.lead_id", old)
        saved_points = pd.read_sql("SELECT l.name,l.address,s.point,s.category,s.found_on FROM sales_points s JOIN leads l ON l.id=s.lead_id", old)
        has = old.execute("SELECT 1 FROM sqlite_master WHERE name='enrichment_candidates'").fetchone()  # 구버전 DB 호환
        saved_cands = None if not has else pd.read_sql("SELECT l.name,l.address,e.channel,e.value,e.dept,e.note,e.source_url,e.found_by,e.found_on,e.status,e.reviewer,e.reviewed_on,e.review_note,e.approved_confidence FROM enrichment_candidates e JOIN leads l ON l.id=e.lead_id", old)
        if old.execute("SELECT 1 FROM sqlite_master WHERE name='dispatches'").fetchone():
            saved_docs = pd.read_sql("SELECT * FROM documents", old)
            saved_disp = pd.read_sql("SELECT l.name,l.address,d.document_id,d.channel,d.to_value,d.sent_on,d.sent_by,d.note,d.consent_verified FROM dispatches d JOIN leads l ON l.id=d.lead_id", old)
        old.close()
        os.remove(db_path)
    db = sqlite3.connect(db_path)
    db.execute("PRAGMA foreign_keys=ON")
    db.executescript(open(f"{ROOT}/schema/schema_sqlite.sql", encoding="utf-8").read())

    def src(name, pid, path, n):
        return db.execute("INSERT INTO source_files(name,portal_id,file_path,row_count) VALUES(?,?,?,?)",
                          (name, pid, path, n)).lastrowid

    s_parks = src("전국도시공원정보표준데이터", "15012890", "data/raw/parks_national_std.csv", 18376)
    s_gen = src("문화_일반테마파크업", "15124678", "data/raw/themepark_general.csv", len(gen))
    s_per = src("허가 테마파크 대형 시설", None, "data/raw/themepark_permit.csv", len(per))

    def add_lead(**k):
        cols = ",".join(k)
        cur = db.execute(f"INSERT OR IGNORE INTO leads({cols}) VALUES({','.join('?' * len(k))})", list(k.values()))
        if cur.rowcount == 0:
            return db.execute("SELECT id FROM leads WHERE name=? AND address IS ?", (k["name"], k.get("address"))).fetchone()[0]
        return cur.lastrowid

    def add_contact(lead_id, value, conf, note=None, source_url=None, verified_on=None, dept=None):
        if not value or str(value) == "nan":
            return
        db.execute("INSERT OR IGNORE INTO contacts(lead_id,channel,value,note,dept,confidence,source_url,verified_on) "
                   "VALUES(?,?,?,?,?,?,?,?)", (lead_id, "phone", value, note, dept, conf, source_url, verified_on))

    # 1) 공공기관(도시공원 관리기관) — 시·군 단위 병합
    lead_by_name, orgs_ids = {}, {}
    M = merge_orgs(orgs)
    for r in M.itertuples():
        reason = f"공원 {r.n}곳, 대형 {r.big}곳, 물놀이 관련 {r.water}곳, 유희시설 {r.play}곳"
        if r.depts:
            reason += f" (병합 부서: {r.depts})"
        lid = add_lead(lead_type="public_org", name=r.name, sido=r.sido, facility_kind=r.kind,
                       operating_status="영업중", area_m2=r.ha * 10000, grade=r.g, grade_reason=reason,
                       score=float(r.score), source_file_id=s_parks, source_key=r.name)
        add_contact(lid, r.phone, "public_data", note="공원 관리기관 대표번호(데이터 최빈값)", dept=r.name)
        orgs_ids[r.name] = lid

    # 물놀이 관련 공원 → 관리기관 lead 에 연결
    for w in water.itertuples():
        lid = orgs_ids.get(city_key(w.org))
        if lid:
            db.execute("INSERT INTO water_parks(lead_id,park_name,park_kind,address,area_m2) VALUES(?,?,?,?,?)",
                       (lid, w.공원명, w.공원구분, w.addr, None if pd.isna(w.a) else float(w.a)))

    # 2) 민간 시설 — 허가 대형 우선, 일반 파일과 동일 시설은 병합
    seen = set()
    for df, sid, permit in ((per, s_per, True), (gen, s_gen, False)):
        for r in df.to_dict("records"):
            key = (norm_name(r["name"]), norm_name(r["addr"]))
            if key in seen:
                continue
            seen.add(key)
            status = "휴업" if permit and r.get("영업상태명") == "휴업" else "영업중"
            fa = float(r["fa"]) if r.get("fa") not in (None, "", "nan") and pd.notna(r.get("fa")) else None
            nr = int(float(r["n"])) if pd.notna(r.get("n")) else None
            lid = add_lead(lead_type="private_facility", name=r["name"], sido=r["sido"], address=r["addr"],
                           facility_kind=r["type"], operating_status=status,
                           closed_from=r.get("휴업시작일자") if pd.notna(r.get("휴업시작일자")) else None,
                           closed_until=r.get("휴업종료일자") if pd.notna(r.get("휴업종료일자")) else None,
                           area_m2=fa, ride_count=nr, grade=r["grade"],
                           grade_reason=f"{r['type']}, 시설면적 {fa or '-'}㎡, 놀이시설 {nr or '-'}종",
                           is_mobile_or_event=int(bool(re.search(load_config()['themeparks']['mobile_pattern'], r["name"]))) if not permit else 0,
                           source_file_id=sid, source_key=r["name"])
            tel = r.get("tel")
            if isinstance(tel, str) and tel:
                add_contact(lid, tel, "public_data", note="공공데이터 인허가 전화번호" + (" (지역번호 확인필요)" if "확인필요" in tel else ""))

    # 2-b) Phase 5 확대 대상 (config/sources.yaml, 파일이 있는 것만)
    scfg = load_config("sources.yaml")
    for src_cfg in scfg["sources"]:
        ex = ingest_extra.load_source(src_cfg, scfg)
        if ex is None:
            continue
        sid = src(f"확대 대상: {src_cfg['kind']}", None, f"data/raw/extra/{src_cfg['file']}", len(ex))
        for r in ex.to_dict("records"):
            key = (norm_name(r["name"]), norm_name(r["address"] or ""))
            if key in seen:
                continue
            seen.add(key)
            lid = add_lead(lead_type="private_facility" if src_cfg["kind"] != "지자체 축제" else "public_org",
                           name=r["name"], sido=r["sido"], address=r["address"], facility_kind=r["facility_kind"],
                           operating_status="영업중", area_m2=r["area_m2"], grade=r["grade"], grade_reason=r["grade_reason"],
                           source_file_id=sid, source_key=r["source_key"])
            add_contact(lid, r["tel"], "public_data", note="공공데이터 전화번호" + (" (지역번호 확인필요)" if "확인필요" in r["tel"] else ""))
        print(f"확대 대상 {src_cfg['kind']}: {len(ex)}건")

    # 2-c) 방문객 통계 → 등급 상향
    vis = ingest_extra.load_visitors(scfg)
    if vis is not None:
        names = pd.read_sql("SELECT id,name,grade FROM leads", db)
        nmap = {norm_name(r.name): (r.id, r.grade) for r in names.itertuples()}
        for v in vis.to_dict("records"):
            hit = nmap.get(norm_name(v["name"]))
            n = pd.to_numeric(v.get("visitors"), errors="coerce")
            if not hit or pd.isna(n):
                continue
            db.execute("INSERT INTO visitor_stats(lead_id,year,visitors,source_name) VALUES(?,?,?,?)", (hit[0], v.get("year"), int(n), v["name"]))
            ng = ingest_extra.upgraded(hit[1], n, scfg["visitors"]["upgrade"])
            if ng != hit[1]:
                db.execute("UPDATE leads SET grade=?, grade_reason=grade_reason||' / 방문객 '||?||'명(상향)' WHERE id=?", (ng, int(n), hit[0]))
                nmap[norm_name(v["name"])] = (hit[0], ng)

    # 3) 수동 확인 연락처 — 매핑 규칙으로 lead 와 연결, 우선순위가 높으면 덮어씀
    vmap = pd.read_csv(f"{MANUAL}/verified_contact_map.csv", dtype=str).set_index("facility")["lead_name_regex"].to_dict()
    leads = pd.read_sql("SELECT id,name FROM leads", db)
    unmatched = []
    for v in pd.read_csv(f"{MANUAL}/verified_contacts.csv", dtype=str).fillna("").to_dict("records"):
        rx = vmap.get(v["facility"])
        ids = leads[leads.name.str.contains(rx, regex=True)].id.tolist() if rx else []
        if not ids:
            unmatched.append(v["facility"])
            continue
        for lid in ids:
            db.execute("DELETE FROM contacts WHERE lead_id=? AND channel='phone' AND value=?", (lid, v["phone"]))
            add_contact(lid, v["phone"], v["status"], note=v["phone_note"] or None, source_url=v["source"], verified_on=v["verified_on"])
    for u in pd.read_csv(f"{MANUAL}/unresolved_contacts.csv", dtype=str).to_dict("records"):
        db.execute("INSERT INTO unresolved_contacts VALUES(?,?,?)", (u["facility"], u["reason"], u["next_step"]))

    # 4) 수동 등급 보정(규칙보다 우선)
    for o in pd.read_csv(f"{MANUAL}/grade_overrides.csv", dtype=str).to_dict("records"):
        db.execute("UPDATE leads SET grade=?, grade_reason=grade_reason||' / 수동보정: '||?, grade_overridden=1 WHERE name=?",
                   (o["grade"], o["reason"], o["name"]))

    db.execute("INSERT INTO outreach(lead_id) SELECT id FROM leads")
    if saved_outreach is not None:
        for o in saved_outreach.to_dict("records"):
            db.execute("""UPDATE outreach SET stage=?,last_action=?,next_action=?,next_action_on=?,consent_for_email=?,owner=?,memo=?,updated_at=?
                          WHERE lead_id=(SELECT id FROM leads WHERE name=? AND address IS ?)""",
                       (o["stage"], o["last_action"], o["next_action"], o["next_action_on"], o["consent_for_email"],
                        o["owner"], o["memo"], o["updated_at"], o["name"], o["address"]))
        for p in saved_points.to_dict("records"):
            db.execute("INSERT INTO sales_points(lead_id,point,category,found_on) SELECT id,?,?,? FROM leads WHERE name=? AND address IS ?",
                       (p["point"], p["category"], p["found_on"], p["name"], p["address"]))
    if saved_cands is not None:
        for e in saved_cands.to_dict("records"):
            db.execute("""INSERT OR IGNORE INTO enrichment_candidates(lead_id,channel,value,dept,note,source_url,found_by,found_on,status,reviewer,reviewed_on,review_note,approved_confidence)
                          SELECT id,?,?,?,?,?,?,?,?,?,?,?,? FROM leads WHERE name=? AND address IS ?""",
                       (e["channel"], e["value"], e["dept"], e["note"], e["source_url"], e["found_by"], e["found_on"], e["status"],
                        e["reviewer"], e["reviewed_on"], e["review_note"], e["approved_confidence"], e["name"], e["address"]))
            if e["status"] == "approved":  # 승인된 연락처는 contacts 에 재반영(우선순위 규칙 유지)
                conf = e["approved_confidence"] or "third_party_recheck"
                db.execute("""INSERT OR IGNORE INTO contacts(lead_id,channel,value,note,dept,confidence,source_url,verified_on)
                              SELECT id,?,?,?,?,?,?,? FROM leads WHERE name=? AND address IS ?""",
                           (e["channel"], e["value"], e["note"], e["dept"], conf, e["source_url"], e["reviewed_on"], e["name"], e["address"]))
    if saved_docs is not None:
        for d in saved_docs.to_dict("records"):  # id 유지(dispatches.document_id 참조)
            db.execute("INSERT INTO documents(id,name,kind,file_path,version,created_at) VALUES(?,?,?,?,?,?)",
                       (d["id"], d["name"], d["kind"], d["file_path"], d["version"], d["created_at"]))
        for d in saved_disp.to_dict("records"):
            db.execute("""INSERT INTO dispatches(lead_id,document_id,channel,to_value,sent_on,sent_by,note,consent_verified)
                          SELECT id,?,?,?,?,?,?,? FROM leads WHERE name=? AND address IS ?""",
                       (None if pd.isna(d["document_id"]) else int(d["document_id"]), d["channel"], d["to_value"], d["sent_on"],
                        d["sent_by"], d["note"], d["consent_verified"], d["name"], d["address"]))
    db.commit()
    stats = dict(
        leads=db.execute("SELECT lead_type, grade, COUNT(*) FROM leads GROUP BY 1,2").fetchall(),
        contacts=db.execute("SELECT confidence, COUNT(*) FROM contacts GROUP BY 1").fetchall(),
        unmatched_verified=unmatched)
    db.close()
    return stats


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", default=f"{ROOT}/data/leads.db")
    a = ap.parse_args()
    for k, v in build(a.db).items():
        print(k, v)


if __name__ == "__main__":
    main()

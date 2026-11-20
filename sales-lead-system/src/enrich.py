"""Phase 3 연락처 보강 워크플로. 후보 수집 → pending → 사람 검수(approve/reject) → contacts 반영.
원칙(docs/04, 05): robots.txt 준수, 봇 차단·접속 실패는 우회하지 않고 blocked 로 기록, 자동 반영 금지, 조직 연락처만.
"""
import datetime as dt
import re
import urllib.request
import urllib.robotparser
from urllib.parse import urlparse

import pandas as pd

PHONE_RX = re.compile(r"(?<![\d-])(?:0\d{1,2}-\d{3,4}-\d{4}|1[5-8]\d{2}-\d{4})(?![\d-])")
MOBILE_RX = re.compile(r"^01[016789]-")  # 개인 휴대폰 대역은 저장 금지
UA = "sales-lead-enrich/1.0 (org contact lookup)"


def extract_phones(html: str) -> list:
    """본문에서 조직 대표번호 후보 추출. 휴대폰(010 등)은 개인정보 가능성으로 제외."""
    seen, out = set(), []
    for m in PHONE_RX.findall(re.sub(r"<[^>]+>", " ", html)):
        if MOBILE_RX.match(m) or m in seen:
            continue
        seen.add(m); out.append(m)
    return out


def robots_allows(url: str, fetch=None) -> bool:
    p = urlparse(url)
    rp = urllib.robotparser.RobotFileParser()
    try:
        txt = (fetch or _get)(f"{p.scheme}://{p.netloc}/robots.txt")
        rp.parse(txt.splitlines())
    except Exception:
        return True  # robots.txt 없음 = 제한 없음 (접속 자체 실패는 이후 단계에서 blocked 처리)
    return rp.can_fetch(UA, url)


def _get(url: str, timeout=10) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode(r.headers.get_content_charset() or "utf-8", "replace")


def collect_from_site(db, lead_id: int, url: str, fetch=None) -> dict:
    """공식 사이트 URL 하나에서 번호 후보를 pending 으로 저장. 차단/실패는 blocked 로 남기고 우회하지 않는다."""
    if not robots_allows(url, fetch):
        _add(db, lead_id, "homepage", url, source_url=url, status="blocked", note="robots.txt 로 수집 불허 — 수동 확인 필요", found_by="auto")
        return {"status": "blocked", "phones": []}
    try:
        html = (fetch or _get)(url)
    except Exception as e:
        _add(db, lead_id, "homepage", url, source_url=url, status="blocked", note=f"접속 실패: {type(e).__name__} — 수동 확인 필요", found_by="auto")
        return {"status": "blocked", "phones": []}
    phones = extract_phones(html)
    _add(db, lead_id, "homepage", url, source_url=url, found_by="auto")
    for ph in phones:
        _add(db, lead_id, "phone", ph, source_url=url, found_by="auto", note="사이트 본문 정규식 추출 — 푸터/대표번호 여부 검수 필요")
    return {"status": "ok", "phones": phones}


def _add(db, lead_id, channel, value, source_url=None, dept=None, note=None, found_by="manual", status="pending"):
    if channel == "phone" and MOBILE_RX.match(value.strip()):
        raise ValueError("개인 휴대폰 번호는 저장할 수 없습니다 (docs/05_compliance.md)")
    db.execute("INSERT OR IGNORE INTO enrichment_candidates(lead_id,channel,value,dept,note,source_url,found_by,status) VALUES(?,?,?,?,?,?,?,?)",
               (lead_id, channel, value.strip(), dept, note, source_url, found_by, status))
    db.commit()


def add_candidate(db, lead_id, channel, value, source_url=None, dept=None, note=None):
    _add(db, lead_id, channel, value, source_url, dept, note)


def pending(db) -> pd.DataFrame:
    return pd.read_sql("""SELECT e.id, l.grade, l.name, e.channel, e.value, e.dept, e.source_url, e.status, e.note, e.found_by, e.found_on
        FROM enrichment_candidates e JOIN leads l ON l.id=e.lead_id
        WHERE e.status IN ('pending','blocked') ORDER BY l.grade, l.name, e.status""", db)


def approve(db, cand_id: int, reviewer: str, official: bool, verified_on=None, review_note=None):
    """검수 승인. official=True(공식 사이트 확인)이면 verified_official, 아니면 third_party_recheck."""
    c = db.execute("SELECT lead_id,channel,value,dept,note,source_url,status FROM enrichment_candidates WHERE id=?", (cand_id,)).fetchone()
    if not c or c[6] not in ("pending",):
        raise ValueError("승인할 수 없는 후보입니다 (pending 만 승인 가능)")
    if not reviewer:
        raise ValueError("검수자 이름이 필요합니다")
    lead_id, channel, value, dept, note, src, _ = c
    day = verified_on or dt.date.today().isoformat()
    conf = "verified_official" if official else "third_party_recheck"
    if conf == "verified_official" and not src:
        raise ValueError("공식 확인은 출처 URL 이 필요합니다")
    db.execute("INSERT OR IGNORE INTO contacts(lead_id,channel,value,note,dept,confidence,source_url,verified_on) VALUES(?,?,?,?,?,?,?,?)",
               (lead_id, channel, value, note, dept, conf, src, day))
    db.execute("UPDATE enrichment_candidates SET status='approved',reviewer=?,reviewed_on=?,review_note=?,approved_confidence=? WHERE id=?",
               (reviewer, day, review_note, conf, cand_id))
    db.commit()


def reject(db, cand_id: int, reviewer: str, review_note=None):
    db.execute("UPDATE enrichment_candidates SET status='rejected',reviewer=?,reviewed_on=?,review_note=? WHERE id=?",
               (reviewer, dt.date.today().isoformat(), review_note, cand_id))
    db.commit()


def import_candidates_csv(db, path) -> int:
    """data/manual/enrichment_candidates.csv (lead_name,channel,value,source_url,dept,note) 일괄 등록."""
    df = pd.read_csv(path, dtype=str).fillna("")
    n = 0
    for r in df.to_dict("records"):
        row = db.execute("SELECT id FROM leads WHERE name=? LIMIT 1", (r["lead_name"],)).fetchone()
        if row:
            _add(db, row[0], r["channel"], r["value"], r["source_url"] or None, r["dept"] or None, r["note"] or None)
            n += 1
    return n

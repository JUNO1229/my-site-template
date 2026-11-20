"""공공데이터 → 정제·등급·병합 결과를 웹앱 시드용 JSON 으로 내보낸다.
실행: python src/export_seed.py [--out data/seed/seed.json]   (웹앱: npm run db:seed)
SQLite 는 중간 산출물일 뿐이며 단일 원본은 웹앱의 Postgres 이다.
"""
import argparse
import json
import os
import sqlite3
import tempfile

import build_master

ROOT = build_master.ROOT


def export(out_path: str):
    with tempfile.TemporaryDirectory() as tmp:
        db_path = f"{tmp}/leads.db"
        build_master.build(db_path)
        db = sqlite3.connect(db_path)
        db.row_factory = sqlite3.Row
        rows = lambda q, a=(): [dict(r) for r in db.execute(q, a)]
        leads = []
        for l in rows("SELECT l.*, s.name AS source_name, s.portal_id, s.file_path, s.row_count FROM leads l JOIN source_files s ON s.id=l.source_file_id ORDER BY l.id"):
            lid = l["id"]
            leads.append({
                **{k: l[k] for k in ("lead_type", "name", "sido", "facility_kind", "operating_status", "closed_from", "closed_until",
                                      "area_m2", "ride_count", "grade", "grade_reason", "grade_overridden", "score", "is_mobile_or_event",
                                      "source_key", "source_name")},
                "address": l["address"] or "",
                "contacts": rows("SELECT channel,value,note,dept,confidence,source_url,verified_on FROM contacts WHERE lead_id=?", (lid,)),
                "water_parks": rows("SELECT park_name,park_kind,address,area_m2 FROM water_parks WHERE lead_id=?", (lid,)),
                "visitors": rows("SELECT year,visitors,source_name FROM visitor_stats WHERE lead_id=?", (lid,)),
            })
        data = {"sources": rows("SELECT name,portal_id,file_path,row_count FROM source_files"),
                "leads": leads, "unresolved": rows("SELECT facility,reason,next_step FROM unresolved_contacts")}
        db.close()
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)
    return data


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=f"{ROOT}/data/seed/seed.json")
    a = ap.parse_args()
    d = export(a.out)
    print(f"seed: leads={len(d['leads'])} sources={len(d['sources'])} unresolved={len(d['unresolved'])} -> {a.out}")


if __name__ == "__main__":
    main()

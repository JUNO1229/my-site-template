"""Phase 5: 확대 대상(캠핑장·수목원·동물원·박물관·해수욕장·축제 등) 설정 기반 수집 + 방문객 통계 연동."""
import os
import re
import pandas as pd
from common import read_public_csv, normalize_phone, load_config

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
EXTRA = f"{ROOT}/data/raw/extra"
ORDER = "CBA"


def pick(df, cands):
    return next((c for c in cands if c in df.columns), None)


def grade_for(src, name, area):
    g = src.get("base", "C")
    if src.get("A_area") and area and area >= src["A_area"] or (src.get("A_name") and re.search(src["A_name"], name or "")):
        return "A", "대형 면적/키워드"
    if src.get("B_area") and area and area >= src["B_area"] and ORDER.index(g) < 1:
        g = "B"
    return g, f"유형 기본등급({src['kind']})"


def load_source(src, cfg):
    path = f"{EXTRA}/{src['file']}"
    if not os.path.exists(path):
        return None
    d = read_public_csv(path)
    cols = {k: pick(d, v) for k, v in cfg["defaults"]["columns"].items()}
    if not cols["name"]:
        raise ValueError(f"{src['file']}: 이름 컬럼을 찾지 못했습니다 (config/sources.yaml columns.name 조정)")
    if cols["status"]:
        d = d[d[cols["status"]].isin(cfg["defaults"]["status_ok"])]
    out = []
    for r in d.to_dict("records"):
        name = str(r[cols["name"]]).strip()
        addr = r[cols["addr"]] if cols["addr"] and pd.notna(r[cols["addr"]]) else None
        area = pd.to_numeric(r[cols["area"]], errors="coerce") if cols["area"] else None
        g, why = grade_for(src, name, None if area is None or pd.isna(area) else float(area))
        out.append(dict(name=name, address=addr, sido=str(addr).split()[0] if addr else "미확인",
                        facility_kind=src["kind"], area_m2=None if area is None or pd.isna(area) else float(area),
                        grade=g, grade_reason=f"{src['kind']}: {why}", source_key=src["id"],
                        tel=normalize_phone(r[cols["phone"]]) if cols["phone"] else ""))
    return pd.DataFrame(out).drop_duplicates(subset=["name", "address"])


def load_visitors(cfg):
    path = f"{ROOT}/data/raw/{cfg['visitors']['file']}"
    return read_public_csv(path) if os.path.exists(path) else None


def upgraded(grade, visitors, rule):
    """방문객 수에 따른 등급 상향(하향 없음)."""
    target = "A" if visitors >= rule["to_A"] else "B" if visitors >= rule["to_B"] else grade
    return min(grade, target)  # 'A'<'B'<'C' 문자 비교: 더 높은 등급(작은 문자) 유지

"""문화_일반테마파크업(15124678) 계열 CSV -> 민간 리드. 영업/정상(+휴업) 사업장만.
실행: python src/ingest_themeparks.py data/raw/themepark_general.csv data/processed/themepark_general.csv [--permit]
--permit: 허가 대형 테마파크 파일(휴업 포함) 처리
"""
import re
import sys
import pandas as pd
from common import read_public_csv, normalize_phone, load_config, alias_sido

CFG = load_config()["themeparks"]
MOBILE_PAT, BRAND_PAT, WATER_NAME = CFG["mobile_pattern"], CFG["brand_pattern"], CFG["water_name"]


def classify(name: str) -> str:
    if re.search(WATER_NAME, name):
        return "물놀이"
    if re.search("레일|루지|카트|스피디움", name):
        return "레저·체험"
    if re.search("리조트|호텔", name):
        return "리조트"
    if re.search("키즈|뽀로로|라바|타요|플레이|놀이", name):
        return "키즈·실내"
    return "테마파크·기타"


def main(src, out, permit=False):
    d = read_public_csv(src)
    keep = ["영업/정상", "휴업"] if permit else ["영업/정상"]
    o = d[d["영업상태명"].isin(keep)].copy()
    o["fa"] = pd.to_numeric(o["시설면적"], errors="coerce")
    o["n"] = pd.to_numeric(o["놀이시설수"], errors="coerce")
    o["tel"] = o["전화번호"].map(normalize_phone)
    o["addr"] = o["도로명주소"].fillna(o["지번주소"])
    o["name"] = o["사업장명"].str.strip()
    o["sido"] = o["addr"].str.split().str[0].fillna("미확인").map(alias_sido)
    o["type"] = o["name"].map(classify)
    o["mobile"] = o["name"].str.contains(MOBILE_PAT, na=False) & (not permit)

    def grade(r):
        if r.mobile:
            return "C"
        big = r.fa >= CFG["A"]["area_min"] if pd.notna(r.fa) else False
        if big or (permit and re.search(BRAND_PAT, r["name"])) or (r.type == "물놀이" and (permit or r.tel)):
            return "A"
        if (r.type in ("물놀이", "리조트") or (pd.notna(r.fa) and r.fa >= CFG["B"]["area_min"])
                or (pd.notna(r.n) and r.n >= CFG["B"]["rides_min"]) or r.type == "키즈·실내" or permit):
            return "B"
        return "C"

    o["grade"] = o.apply(grade, axis=1)
    o = o.drop_duplicates(subset=["name", "addr"]).sort_values(["grade", "fa"], ascending=[True, False])
    cols = ["grade", "sido", "name", "type", "영업상태명", "휴업시작일자", "휴업종료일자", "addr", "tel", "fa", "n", "인허가일자"]
    o[cols].to_csv(out, index=False, encoding="utf-8")
    print(f"rows={len(o)} grades={o.grade.value_counts().to_dict()} no_phone={(o.tel=='').sum()}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], "--permit" in sys.argv)

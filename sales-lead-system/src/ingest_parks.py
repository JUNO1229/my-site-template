"""전국도시공원정보표준데이터(15012890) -> 관리기관 단위 리드(ref_orgs) + 물놀이 관련 공원(ref_water).
실행: python src/ingest_parks.py data/raw/parks_national_std.csv data/processed
"""
import re
import sys
import pandas as pd
from common import read_public_csv, load_config

CFG = load_config()["parks"]
AGENCY_RX = re.compile(CFG["agency_pattern"])  # 공단·공사·재단 등 시설관리 기관(지자체 본청·부서와 구분)
WATER_PAT = CFG["water_pattern"]  # '분수','계류','실개천'은 조경 시설이라 제외
BIG_TYPES = CFG["big_types"]
FAC_COLS = ["공원보유시설(운동시설)", "공원보유시설(유희시설)", "공원보유시설(편익시설)",
            "공원보유시설(교양시설)", "공원보유시설(기타시설)"]


SIDO_ALIAS = {"강원도": "강원특별자치도", "전라북도": "전북특별자치도"}
VALID_SIDO = {"서울특별시", "부산광역시", "대구광역시", "인천광역시", "광주광역시", "대전광역시", "울산광역시", "세종특별자치시",
              "경기도", "강원특별자치도", "충청북도", "충청남도", "전북특별자치도", "전라남도", "경상북도", "경상남도",
              "제주특별자치도", "전남광주통합특별시"}


def norm_sido(token):
    token = SIDO_ALIAS.get(token, token)
    return token if token in VALID_SIDO else None


def sido_of(group):
    """시도: 제공기관명 첫 토큰이 시도가 아니면(공단·공사가 자기 이름을 제공기관으로 쓰는 경우) 관리 공원 주소에서 추론."""
    t = norm_sido(str(group["제공기관명"].dropna().iloc[0]).split()[0]) if group["제공기관명"].notna().any() else None
    if t:
        return t
    addrs = group["소재지도로명주소"].fillna(group["소재지지번주소"]).dropna().str.split().str[0].map(norm_sido).dropna()
    return addrs.mode().iloc[0] if len(addrs) else "미확인"


def grade(r) -> str:
    a, b = CFG["A"], CFG["B"]
    if r.water >= a["water_min"] or (r.water >= a["water_with_big"]["water_min"] and r.big >= a["water_with_big"]["big_min"]):
        return "A"
    if r.water >= b["water_min"] or r.big >= b["big_min"] or r.n >= b["parks_min"]:
        return "B"
    return "C"


def main(src, outdir):
    d = read_public_csv(src)
    d["org"] = d["관리기관명"].fillna(d["제공기관명"])  # 관리기관명이 비면 제공기관(시군구)로 대체
    d["a"] = pd.to_numeric(d["공원면적"], errors="coerce")
    txt = d[FAC_COLS].fillna("").agg(" ".join, axis=1)
    d["water"] = txt.str.contains(WATER_PAT, case=False) | d["공원명"].fillna("").str.contains(WATER_PAT, case=False)
    d["play"] = d["공원보유시설(유희시설)"].notna()
    d["big"] = d["공원구분"].isin(BIG_TYPES)
    d["sido"] = d["제공기관명"].fillna(d["org"]).str.split().str[0]

    rows = []
    for org, g in d.groupby("org"):
        top = g.sort_values("a", ascending=False).iloc[0]
        ph = g["전화번호"].dropna()
        rows.append(dict(sido=sido_of(g), org=org, kind="시설관리 기관" if AGENCY_RX.search(org) else "공원 관리기관", phone=ph.mode().iloc[0] if len(ph) else "",
                         n=len(g), big=int(g.big.sum()), water=int(g.water.sum()),
                         play=int(g.play.sum()), ha=round(g.a.sum() / 10000, 1), top=top["공원명"]))
    G = pd.DataFrame(rows)
    G["g"] = G.apply(grade, axis=1)
    c = CFG["score"]
    G["score"] = (G.big.clip(upper=c["big_cap"]) + c["water_weight"] * G.water.clip(upper=c["water_cap"])
                  + c["play_weight"] * G.play.clip(upper=c["play_cap"]) + c["parks_weight"] * G.n.clip(upper=c["parks_cap"]))
    G = G.sort_values(["g", "score"], ascending=[True, False])
    G.to_csv(f"{outdir}/orgs_from_parks.csv", index=False, encoding="utf-8")

    W = d[d.water].copy()
    W["addr"] = W["소재지도로명주소"].fillna(W["소재지지번주소"])
    W[["sido", "공원명", "공원구분", "addr", "org", "전화번호", "a"]].to_csv(
        f"{outdir}/water_parks.csv", index=False, encoding="utf-8")
    print(f"orgs={len(G)} grades={G.g.value_counts().to_dict()} water_parks={len(W)}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])

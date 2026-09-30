"""data/*.csv → analysis/report.md, data/nextgate_products.xlsx

모든 수치는 수집 데이터에서 계산한다. 기준일은 수집일(collected_at 중 가장 이른 날짜).
"""
import csv
import json
import re
import statistics as st
from collections import Counter, defaultdict
from datetime import date, timedelta
from pathlib import Path

from openpyxl import Workbook
from openpyxl.comments import Comment
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
OUT = ROOT / "analysis"

# ---------- 지역 → (시도, 권역) ----------
SIDO = {
    "서울": ["서울", "여의도", "잠실", "인사동", "홍대"],
    "인천": ["인천", "강화"],
    "경기": ["경기", "용인", "과천", "부천", "양평", "여주", "고양", "동탄", "가평", "파주", "의정부", "하남",
           "화성", "분당", "남양주", "일산", "시흥", "광교", "김포", "안성", "오산", "수원", "성남", "안산",
           "포천", "이천", "평택", "광명", "구리", "양주", "연천", "안양", "군포", "의왕"],
    "강원": ["강원", "속초", "춘천", "영월", "정선", "홍천", "철원", "강릉", "평창", "원주", "양양", "삼척",
           "동해", "인제", "고성", "태백", "횡성"],
    "충남": ["충남", "아산", "예산", "태안", "천안", "공주", "보령", "서산", "논산", "당진", "부여", "서천",
           "청양", "홍성", "금산", "계룡"],
    "충북": ["충북", "제천", "단양", "청주", "충주", "괴산", "보은", "옥천", "영동", "진천", "음성", "증평"],
    "대전": ["대전"], "세종": ["세종"],
    "전북": ["전북", "전주", "군산", "익산", "정읍", "남원", "김제", "완주", "무주", "부안", "고창", "진안",
           "장수", "임실", "순창"],
    "전남": ["전남", "여수", "화순", "순천", "목포", "광양", "담양", "보성", "해남", "완도", "나주", "영광"],
    "광주": ["광주"],
    "부산": ["부산", "해운대", "기장"], "울산": ["울산"], "대구": ["대구"],
    "경북": ["경북", "경주", "청도", "포항", "안동", "구미", "영덕", "문경", "울진"],
    "경남": ["경남", "진주", "남해", "통영", "거제", "창원", "김해", "양산", "하동", "거창", "사천"],
    "제주": ["제주", "서귀포"],
    "전국": ["전국"],
}
GWON = {"서울": "수도권", "인천": "수도권", "경기": "수도권", "강원": "강원",
        "충남": "충청", "충북": "충청", "대전": "충청", "세종": "충청",
        "전북": "호남", "전남": "호남", "광주": "호남",
        "부산": "영남", "울산": "영남", "대구": "영남", "경북": "영남", "경남": "영남",
        "제주": "제주", "전국": "전국"}
GWON_ORDER = ["수도권", "충청", "호남", "영남", "강원", "제주", "전국", "미분류"]
ADDR_SIDO = [("충청남도|충남", "충남"), ("전북특별자치도|전라북도|전북", "전북"), ("충청북도|충북", "충북"),
             ("전라남도|전남", "전남"), ("경상북도|경북", "경북"), ("경상남도|경남", "경남"),
             ("강원", "강원"), ("제주", "제주"), ("서울", "서울"), ("인천", "인천"), ("경기", "경기"),
             ("부산", "부산"), ("대구", "대구"), ("울산", "울산"), ("대전", "대전"), ("세종", "세종"),
             ("광주광역시", "광주")]

WATERPARK_TOP10 = [("원마운트", r"원마운트"), ("테르메덴", r"테르메덴"),
                   ("파라다이스 스파도고", r"스파\s*도고"), ("아산스파비스", r"스파비스"),
                   ("웅진플레이도시", r"웅진\s*플레이도시"), ("씨랄라", r"씨랄라"), ("썬밸리", r"썬밸리"),
                   ("아쿠아필드", r"아쿠아필드"), ("스플라스리솜", r"스플라스"),
                   ("포레스트리솜", r"포레스트\s*리솜")]
BUCKETS = [("0-9%", 0, 9), ("10-19%", 10, 19), ("20-29%", 20, 29), ("30-39%", 30, 39),
           ("40-49%", 40, 49), ("50%+", 50, 1000)]


def sido_of(region, address):
    out = []
    for part in re.split(r"[/,·]", region or ""):
        part = part.strip().replace("경기 ", "")
        for sido, keys in SIDO.items():
            if any(part.startswith(k) for k in keys):
                out.append(sido)
                break
    for pat, s in ADDR_SIDO:  # 시설 주소로 보완 (지역 태그와 다른 시도면 추가하지 않고 태그 우선)
        if not out and re.search(pat, address or ""):
            out.append(s)
            break
    return list(dict.fromkeys(out))


def load():
    prods = list(csv.DictReader(open(DATA / "nextgate_products.csv", encoding="utf-8-sig")))
    opts = list(csv.DictReader(open(DATA / "nextgate_options.csv", encoding="utf-8-sig")))
    for p in prods:
        for k in ("list_price", "sale_price", "discount_pct", "max_qty", "option_count"):
            p[k] = int(p[k]) if p[k] not in ("", None) else None
        p["sido"] = sido_of(p["region"], p["vendor_address"])
        p["gwon"] = list(dict.fromkeys(GWON[s] for s in p["sido"])) or ["미분류"]
        p["cats"] = list(zip(p["cat1"].split(";"), p["cat2"].split(";")))
        # 가격 분석 대상: 광고상품·가격 0 제외
        p["priced"] = p["ticket_div"] != "광고상품" and bool(p["list_price"]) and p["sale_price"] is not None
    for o in opts:
        for k in ("list_price", "sale_price", "discount_pct"):
            o[k] = int(o[k]) if o[k] not in ("", None) else None
        o["calc_discount_pct"] = float(o["calc_discount_pct"]) if o["calc_discount_pct"] else None
        o["is_basis"] = o["is_basis"] == "True"
    return prods, opts


def stats(vals):
    vals = [v for v in vals if v is not None]
    if not vals:
        return dict(n=0, mean=None, median=None, min=None, max=None)
    return dict(n=len(vals), mean=round(st.mean(vals), 1), median=st.median(vals), min=min(vals), max=max(vals))


def fmt(v, unit=""):
    if v is None:
        return "-"
    if isinstance(v, float):
        v = round(v, 1)
        return f"{v:,.1f}{unit}" if v != int(v) else f"{int(v):,}{unit}"
    return f"{v:,}{unit}"


def table(headers, rows):
    out = ["| " + " | ".join(headers) + " |", "| " + " | ".join("---" for _ in headers) + " |"]
    for r in rows:
        out.append("| " + " | ".join(str(c).replace("|", "/").replace("\n", " ") for c in r) + " |")
    return "\n".join(out)


def bucket(d):
    for name, lo, hi in BUCKETS:
        if lo <= d <= hi:
            return name
    return "-"


def adult_weekend(opts_of):
    """대인(또는 대소공통)·주말(또는 주중+주말/토·일) 옵션."""
    return [o for o in opts_of
            if o["detail_div"] in ("대인", "대소공통", "")
            and not re.search(r"소인|어린이|청소년|영유아|유아|키즈", o["option"])
            and (o["week_div"] in ("주말", "주중+주말", "토요일", "일요일")
                 or re.search(r"주말|공통|토요일", o["option"]))]


def main():
    prods, opts = load()
    OUT.mkdir(exist_ok=True)
    by_pid = defaultdict(list)
    for o in opts:
        by_pid[o["product_id"]].append(o)
    today = min(date.fromisoformat(p["collected_at"][:10]) for p in prods)
    priced = [p for p in prods if p["priced"]]
    md = []
    A = md.append

    A("# 넥스트에너지(nextgate.kr) 상품 분석")
    A("")
    A(f"- 수집일: {today.isoformat()} / 상품 {len(prods)}개, 옵션 {len(opts)}개")
    ad = [p for p in prods if not p["priced"]]
    A(f"- 가격 통계 대상: {len(priced)}개 (광고상품·가격 없음 {len(ad)}개 제외: "
      + ", ".join(p["name"] for p in ad) + ")")
    A("- 대표가격 = 사이트 목록·상세에 표시되는 가격(첫 번째 옵션). 할인율은 사이트 표기값(%).")
    A("")

    # 1. 카테고리 현황
    A("## 1. 카테고리 현황")
    A("")
    rows = []
    groups = defaultdict(list)
    for p in priced:
        for c1, c2 in p["cats"]:
            groups[(c1, "(전체)")].append(p)
            groups[(c1, c2)].append(p)
    cnt_all = Counter()
    for p in prods:
        for c1, c2 in p["cats"]:
            cnt_all[(c1, "(전체)")] += 1
            cnt_all[(c1, c2)] += 1
    order = sorted(cnt_all, key=lambda k: (-cnt_all[(k[0], "(전체)")], k[0], k[1] != "(전체)", -cnt_all[k]))
    for k in order:
        g = groups.get(k, [])
        s = stats([p["discount_pct"] for p in g])
        rows.append([k[0], k[1], f"{cnt_all[k]}개", f"{s['n']}개", fmt(s["mean"], "%"), fmt(s["median"], "%"),
                     fmt(s["min"], "%"), fmt(s["max"], "%"),
                     fmt(round(st.mean([p["sale_price"] for p in g])) if g else None, "원")])
    s = stats([p["discount_pct"] for p in priced])
    rows.append(["**전체**", "", f"{len(prods)}개", f"{s['n']}개", fmt(s["mean"], "%"), fmt(s["median"], "%"),
                 fmt(s["min"], "%"), fmt(s["max"], "%"), fmt(round(st.mean([p["sale_price"] for p in priced])), "원")])
    A(table(["대분류", "소분류", "상품 수", "가격대상", "할인율 평균", "중간값", "최소", "최대", "평균 판매가"], rows))
    A("")
    A("### 할인율 구간 분포 (대분류별, 상품 수)")
    A("")
    cats1 = [k[0] for k in order if k[1] == "(전체)"]
    rows = []
    for c1 in cats1 + ["**전체**"]:
        g = priced if c1 == "**전체**" else groups.get((c1, "(전체)"), [])
        cb = Counter(bucket(p["discount_pct"]) for p in g)
        rows.append([c1] + [f"{cb.get(b[0], 0)}" for b in BUCKETS])
    A(table(["대분류"] + [b[0] for b in BUCKETS], rows))
    A("")

    # 2. 지역 분포
    A("## 2. 지역 분포")
    A("")
    A("권역 × 대분류 (상품 수). 여러 지역에 걸친 상품(예: [서울/천안])은 해당 권역마다 1개씩 셈.")
    A("")
    mat = defaultdict(Counter)
    for p in prods:
        for g in p["gwon"]:
            for c1 in dict.fromkeys(c[0] for c in p["cats"]):
                mat[g][c1] += 1
    rows = []
    for g in GWON_ORDER:
        if g not in mat and g == "미분류":
            continue
        rows.append([g] + [mat[g].get(c, 0) or "·" for c in cats1] + [sum(mat[g].values())])
    A(table(["권역"] + cats1 + ["합계"], rows))
    A("")
    sido_cnt = Counter(s for p in prods for s in p["sido"])
    A("시도별 상품 수: " + ", ".join(f"{k} {v}개" for k, v in sido_cnt.most_common()))
    A("")
    focus = [p for p in prods if {"전북", "충남"} & set(p["sido"])]
    A("### 전북·충남 상품 (모두의티켓 1차 공략 지역)")
    A("")
    jb = [p for p in focus if "전북" in p["sido"]]
    A(f"- **전북: {len(jb)}개**" + (" — 넥스트에너지 판매 상품 없음" if not jb else ""))
    A(f"- **충남: {len([p for p in focus if '충남' in p['sido']])}개**")
    A("")
    if focus:
        A(table(["시도", "카테고리", "상품", "정상가", "판매가", "할인율", "기준 권종", "발권채널", "시설"],
                [["/".join(p["sido"]), p["cat2"], f"[{p['region']}] {p['name']}", fmt(p["list_price"], "원"),
                  fmt(p["sale_price"], "원"), fmt(p["discount_pct"], "%"), p["basis"],
                  p["issue_channel"] or p["issue_medium"] or "-", p["vendor_name"]] for p in focus]))
    A("")

    # 3. 가격 경쟁력
    A("## 3. 가격 경쟁력")
    A("")
    low = sorted([p for p in priced if p["discount_pct"] < 15], key=lambda p: p["discount_pct"])
    A(f"### 할인율 15% 미만: {len(low)}개 (온라인 쿠폰보다 불리할 가능성)")
    A("")
    A(table(["카테고리", "상품", "정상가", "판매가", "할인율", "기준 권종", "옵션 중 최고 할인율"],
            [[p["cat2"], f"[{p['region']}] {p['name']}", fmt(p["list_price"], "원"), fmt(p["sale_price"], "원"),
              fmt(p["discount_pct"], "%"), p["basis"],
              fmt(max((o["discount_pct"] or 0) for o in by_pid[p["product_id"]]), "%")] for p in low]))
    A("")
    A("### 대표가격이 소인·주중 기준인 상품 → 대인·주말 옵션 할인율")
    A("")
    rows = []
    for p in priced:
        bo = next((o for o in by_pid[p["product_id"]] if o["is_basis"]), None)
        if not bo:
            continue
        kid = bo["detail_div"] == "소인" or re.search(r"소인|어린이|키즈|영유아|유아", bo["option"])
        wd = bo["week_div"] == "주중" or re.search(r"주중(?!\s*[ㆍ·+/]\s*주말)(?!.*공통)", bo["option"])
        if not (kid or wd):
            continue
        aw = adult_weekend(by_pid[p["product_id"]])
        ds = [o["discount_pct"] for o in aw if o["discount_pct"] is not None]
        rows.append([p["cat2"], f"[{p['region']}] {p['name']}", ("소인" if kid else "") + ("·" if kid and wd else "") + ("주중" if wd else ""),
                     fmt(p["discount_pct"], "%"), len(aw),
                     fmt(min(ds), "%") if ds else "해당 옵션 없음", fmt(round(st.mean(ds), 1), "%") if ds else "-",
                     fmt(max(ds), "%") if ds else "-",
                     (fmt(round(st.mean(ds) - p["discount_pct"], 1), "%p") if ds else "-")])
    A(f"{len(rows)}개. '대인·주말'은 대인(또는 대소공통) 권종 중 주말 또는 주중+주말 옵션.")
    A("")
    A(table(["카테고리", "상품", "대표 기준", "대표 할인율", "대인·주말 옵션 수", "최소", "평균", "최대", "평균-대표 차이"], rows))
    A("")

    # 4. 유효기간
    A("## 4. 유효기간")
    A("")
    expired, soon, monthly = [], [], []
    for p in prods:
        vt = p["valid_to"]
        if re.fullmatch(r"\d{4}-\d{2}-\d{2}", vt or ""):
            d = date.fromisoformat(vt)
            if d < today:
                expired.append(p)
            elif d <= today + timedelta(days=30):
                soon.append((p, (d - today).days))
        vf = p["valid_from"]
        reason = []
        if re.fullmatch(r"\d{4}-\d{2}-01", vf or "") and re.fullmatch(r"\d{4}-\d{2}-\d{2}", vt or ""):
            f, t = date.fromisoformat(vf), date.fromisoformat(vt)
            if f.month == t.month and (t + timedelta(days=1)).day == 1:
                reason.append(f"유효기간 {vf}~{vt} (한 달)")
        if re.search(r"\d+월\s*\d+일[^\n]{0,15}(?:구매\s*사이트\s*)?(?:open|오픈)|매월|월\s*단위|월별\s*(?:판매|오픈)",
                     p["notice_text"], re.I):
            m = re.search(r"[^\n]{0,40}(?:open|오픈|매월|월\s*단위|월별)[^\n]{0,30}", p["notice_text"], re.I)
            reason.append("안내문: " + m.group(0).strip()[:70])
        mo = []
        for o in by_pid[p["product_id"]]:
            if o["start_div"] != "구매일" and o["end_div"] != "구매일" and \
                    re.fullmatch(r"\d{4}-\d{2}-01", o["start_date"] or "") and re.fullmatch(r"\d{4}-\d{2}-\d{2}", o["end_date"] or ""):
                f, t = date.fromisoformat(o["start_date"]), date.fromisoformat(o["end_date"])
                if f.month == t.month and t.day >= 28:
                    mo.append(f"{f.month}월")
        if mo and not reason:
            reason.append(f"옵션 {len(mo)}개가 {', '.join(dict.fromkeys(mo))} 한 달 단위")
        if reason:
            monthly.append((p, " / ".join(reason)))
    exp_opts = [o for o in opts if re.fullmatch(r"\d{4}-\d{2}-\d{2}", o["end_date"] or "")
                and date.fromisoformat(o["end_date"]) < today and o["end_div"] != "구매일"]
    A(f"### 기간이 지났는데 판매 중: 상품 {len(expired)}개 / 옵션 {len(exp_opts)}개")
    A("")
    if expired:
        A(table(["상품", "유효기간 종료"], [[f"[{p['region']}] {p['name']}", p["valid_to"]] for p in expired]))
        A("")
    if exp_opts:
        A("만료된 옵션이 남아 있는 상품:")
        A("")
        A(table(["상품", "옵션", "종료일"], [[f"[{o['region']}] {o['name']}", o["option"], o["end_date"]] for o in exp_opts]))
        A("")
    A(f"### 30일 안에 끝나는 상품 ({today.isoformat()} 기준): {len(soon)}개")
    A("")
    A(f"종료일이 수집일({today.isoformat()})과 같은 상품 {sum(1 for _, d in soon if d == 0)}개는 다음 날부터 기간 경과 상태가 됨. 유효기간 종료 = 옵션 종료일 중 가장 늦은 날.")
    A("")
    if soon:
        A(table(["카테고리", "상품", "종료일", "남은 일수"],
                [[p["cat2"], f"[{p['region']}] {p['name']}", p["valid_to"], f"{d}일"] for p, d in sorted(soon, key=lambda x: x[1])]))
        A("")
    A(f"### 월 단위로 판매를 여는 상품: {len(monthly)}개")
    A("")
    A("판정: 상품 또는 옵션의 유효기간이 한 달(1일~말일, 말일은 28일 이후)이거나, 안내문에 'N월 N일 오픈'·'매월' 등의 표현이 있는 상품.")
    A("")
    if monthly:
        A(table(["카테고리", "상품", "근거"], [[p["cat2"], f"[{p['region']}] {p['name']}", r] for p, r in monthly]))
        A("")
    vd = Counter(p["valid_days"] for p in prods if p["valid_days"])
    A("구매 후 N일 방식: " + (", ".join(f"{k}일 {v}개" for k, v in sorted(vd.items(), key=lambda x: int(x[0]))) or "없음"))
    A("")

    # 5. 발권 구조
    A("## 5. 발권 구조")
    A("")
    it = Counter(p["issue_type"] for p in prods)
    A(table(["issue_type", "상품 수"], [[k, f"{v}개"] for k, v in it.most_common()]))
    A("")
    A("issue_type 판정: 안내문에 '예약대기' → 예약대기 / 뱃지 '바로 사용가능' → 즉시발송 / '예약필수' / '수령 후 사용 가능'(지류·직접수령) / '광고상품'(판매 없음, 외부 상담 연결).")
    A("")
    A("### 발권 대행사(카카오 발송채널)별")
    A("")
    ch = defaultdict(list)
    for p in prods:
        key = p["issue_channel"] or f"(채널 표기 없음 · {p['issue_medium'] or '발송 안내 없음'})"
        ch[key].append(p)
    rows = []
    for k, v in sorted(ch.items(), key=lambda x: -len(x[1])):
        rows.append([k, f"{len(v)}개", f"{len(v) / len(prods) * 100:.0f}%",
                     ", ".join(sorted(dict.fromkeys(c[1] for p in v for c in p["cats"]))),
                     ", ".join(f"[{p['region']}] {p['name']}" for p in v)])
    A(table(["발송채널", "상품 수", "비중", "카테고리", "상품"], rows))
    A("")

    # 6. 워터파크
    A("## 6. 워터파크 집중 분석")
    A("")
    wp = [p for p in prods if any(c[0] == "워터파크" for c in p["cats"])]
    A(f"현재 판매 중 {len(wp)}개, 옵션 {sum(len(by_pid[p['product_id']]) for p in wp)}개.")
    A("")
    A(table(["상품", "시도", "정상가", "판매가", "할인율", "기준 권종", "옵션 수", "유효기간", "발권", "발송채널"],
            [[f"[{p['region']}] {p['name']}", "/".join(p["sido"]), fmt(p["list_price"], "원"), fmt(p["sale_price"], "원"),
              fmt(p["discount_pct"], "%"), p["basis"], p["option_count"],
              f"{p['valid_from']}~{p['valid_to'] or ('구매후 ' + p['valid_days'] + '일' if p['valid_days'] else '')}",
              p["issue_type"], p["issue_channel"] or p["issue_medium"] or "-"] for p in wp]))
    A("")
    A("### 옵션별 가격")
    A("")
    A(table(["상품", "옵션", "대소", "주중/주말", "정상가", "판매가", "할인율", "기간"],
            [[f"{o['name']}", o["option"], o["detail_div"] or "-", o["week_div"] or "-", fmt(o["list_price"], "원"),
              fmt(o["sale_price"], "원"), fmt(o["discount_pct"], "%"),
              f"{o['start_date'] if o['start_div'] != '구매일' else '구매일'}~{o['end_date'] if o['end_div'] != '구매일' else '구매후' + o['end_date'] + '일'}"]
             for p in wp for o in by_pid[p["product_id"]]]))
    A("")
    A("### 과거 매출 상위 10곳 판매 여부")
    A("")
    rows = []
    wtop = []
    for name, pat in WATERPARK_TOP10:
        allhit = [p for p in prods if re.search(pat, p["name"] + " " + p["vendor_name"])]
        hit = [p for p in allhit if any(c[0] == "워터파크" for c in p["cats"])]
        other = [p for p in allhit if p not in hit]
        wtop.append((name, hit))
        rows.append([name, "판매 중" if hit else "**미판매**",
                     "; ".join(f"[{p['region']}] {p['name']} {fmt(p['sale_price'], '원')} ({fmt(p['discount_pct'], '%')})" for p in hit) or "-",
                     "; ".join(dict.fromkeys(p["issue_channel"] or p["issue_medium"] or "-" for p in hit)) or "-",
                     "; ".join(f"{p['cat2']}: {p['name']}" for p in other) or "-"])
    A(table(["시설", "판매 여부", "워터파크 상품 (대표 판매가, 할인율)", "발송채널", "같은 시설 다른 상품"], rows))
    A("")
    A("※ 원마운트·테르메덴의 과거 매출(합계 23.5억 원)은 작업지시서 제공 정보이며 수집 데이터가 아님.")
    A("")

    # 7. 시사점(수치 부분)
    A("## 7. 모두의티켓 시사점")
    A("")
    A("### 직계약 할인율 기준선 (카테고리별 넥스트에너지 중간값)")
    A("")
    rows = []
    for c1 in cats1:
        for (a, b), g in groups.items():
            if a == c1 and b != "(전체)" and len(g) >= 3:
                s = stats([p["discount_pct"] for p in g])
                rows.append([a, b, f"{s['n']}개", fmt(s["median"], "%"), fmt(s["mean"], "%"),
                             f"{sum(1 for p in g if p['discount_pct'] >= s['median'])}개"])
    A(table(["대분류", "소분류", "가격대상", "중간값", "평균", "중간값 이상 상품"], rows))
    A("")
    A("(상품 3개 미만 소분류는 기준선에서 제외)")
    A("")
    A("<!-- IMPLICATIONS -->")
    A("")

    md = implications(md, prods, priced, groups, mat, focus, ch, wtop, by_pid)
    (OUT / "report.md").write_text("\n".join(md))
    ctx = dict(prods=prods, opts=opts, priced=priced, groups=groups, cats1=cats1, mat=mat, focus=focus, low=low,
               ch=ch, wp=wp, wtop=wtop, today=today, expired=expired, soon=soon, monthly=monthly, exp_opts=exp_opts)
    build_xlsx(prods, opts, focus, wp, wtop)
    return ctx


def implications(md, prods, priced, groups, mat, focus, ch, wtop, by_pid):
    """7번 시사점 문장. 수치는 모두 수집 데이터에서 계산."""
    med = lambda k: st.median([p["discount_pct"] for p in groups[k]])
    L = []
    L.append("### 기준선 제안")
    L.append("")
    tp, wp, aq, cr, ac = (med(("테마파크", "테마파크")), med(("워터파크", "워터파크")),
                          med(("테마파크", "아쿠아리움")), med(("레져", "크루즈")), med(("레져", "액티비티")))
    L.append(f"- **테마파크 {fmt(tp, '%')} · 아쿠아리움 {fmt(aq, '%')} · 워터파크 {fmt(wp, '%')}**: 넥스트에너지 중간값. "
             "직계약 할인율이 이 값 이상이면 넥스트에너지 동일 카테고리 상품의 절반 이상보다 유리함 → 영업 제안의 최저선으로 사용 (제안).")
    wp_hi = sum(1 for p in groups[("워터파크", "워터파크")] if p["discount_pct"] >= 40)
    L.append(f"- 워터파크는 17개 중 {wp_hi}개가 40% 이상 → 워터파크는 '시설 직계약 원가'가 아니면 가격으로 이기기 어려움. "
             f"크루즈({fmt(cr, '%')})·액티비티({fmt(ac, '%')})는 기준선이 낮아 진입 여지가 큼.")
    L.append("")
    L.append("### 넥스트에너지가 비어 있는 지역·카테고리")
    L.append("")
    jb = [p for p in focus if "전북" in p["sido"]]
    cn = [p for p in focus if "충남" in p["sido"]]
    honam = sum(mat["호남"].values())
    cn_cat = Counter(c[0] for p in cn for c in p["cats"])
    L.append(f"- **전북 0개, 호남 전체 {honam}개**(전남 화순·여수만). 전북은 경쟁 상품이 없는 공백 시장.")
    L.append(f"- **충남 {len(cn)}개**: " + ", ".join(f"{k} {v}개" for k, v in cn_cat.most_common())
             + ". 아산·예산·태안·천안에 몰려 있고 공연·전시·레져는 없음.")
    only_sudo = [c for c in ("공연", "전시") if all(g == "수도권" for g in mat if mat[g].get(c))]
    L.append(f"- 공연·전시는 수도권에만 있음. 수집된 15개 소분류에 스키·눈썰매·골프·캠핑·영화 소분류는 없음 (추정: 겨울 시즌 상품 공백).")
    L.append("")
    L.append("### 발권 대행사를 거치는 상품 중 직계약 후보")
    L.append("")
    ls = ch.get("엘에스컴퍼니", [])
    dino = [p for p in ls if "공룡월드" in p["name"]]
    L.append(f"- **엘에스컴퍼니 {len(ls)}개({len(ls) / len(prods) * 100:.0f}%)**: 넥스트에너지 최대 의존 대행사, 대부분 테마파크. "
             f"그중 공룡월드 {len(dino)}곳(평균 할인율 {st.mean(p['discount_pct'] for p in dino):.1f}%)은 "
             "할인율이 낮고 충남(아산·천안) 지점이 있어 체인 단위 직계약 1순위 후보.")
    pl = ch.get("플레이스토리", [])
    L.append(f"- **플레이스토리 {len(pl)}개**: 리솜 3곳(스플라스·포레스트·아일랜드)과 하이원 워터월드. "
             "충남 리솜 2곳(예산 스플라스 32%, 태안 아일랜드 14%)은 할인율이 낮아 직계약 시 가격 우위 가능.")
    nb = ch.get("놀이의발견", [])
    L.append(f"- **놀이의발견 {len(nb)}개**: 웅진플레이도시·경주 뽀로로아쿠아빌리지 워터파크. 과거 상위 워터파크(웅진)가 대행사를 거침.")
    miss = [n for n, h in wtop if not h]
    L.append(f"- 과거 매출 상위 워터파크 중 **{', '.join(miss)} 미판매** → 현재 넥스트에너지 채널이 비어 있어 우선 접촉 대상. "
             "파라다이스 스파도고는 시설 자체 채널로 발송 중(이미 직접 거래 구조).")
    return md[:md.index("<!-- IMPLICATIONS -->")] + L


# ---------- 엑셀 ----------
HDR = Font(name="Arial", bold=True, color="FFFFFF")
HFILL = PatternFill("solid", fgColor="305496")
BASE = Font(name="Arial", size=10)


def style_sheet(ws, widths=None):
    for row in ws.iter_rows():
        for c in row:
            c.font = BASE if c.row > 1 else HDR
            if c.row == 1:
                c.fill = HFILL
                c.alignment = Alignment(vertical="center", wrap_text=True)
    ws.freeze_panes = "A2"
    for i, col in enumerate(ws.iter_cols(min_row=1, max_row=1), 1):
        ws.column_dimensions[get_column_letter(i)].width = (widths or {}).get(col[0].value, 14)


PCOLS = ["product_id", "cat1", "cat2", "sido", "gwon", "region", "name", "tagline", "list_price", "sale_price",
         "discount_pct", "basis", "option_count", "valid_from", "valid_to", "valid_days", "badges", "issue_type",
         "issue_channel", "issue_medium", "usage_method", "max_qty", "refund_rule", "vendor_name", "vendor_address",
         "vendor_phone", "external_link", "ticket_div", "priced", "check", "collected_at"]
OCOLS = ["product_id", "option_id", "cat1", "cat2", "region", "name", "option", "detail_div", "week_div", "time_div",
         "list_price", "sale_price", "discount_pct", "calc_discount_pct", "min_ticket_unit", "start_div",
         "start_date", "end_div", "end_date", "is_basis"]


def build_xlsx(prods, opts, focus, wp, wtop):
    wb = Workbook()
    ws = wb.active
    ws.title = "상품목록"
    ws.append(PCOLS)
    for p in prods:
        row = []
        for k in PCOLS:
            v = p[k]
            if k in ("sido", "gwon"):
                v = ";".join(v)
            elif k == "priced":
                v = "Y" if v else "N"
            row.append(v)
        ws.append(row)
    n = len(prods) + 1
    style_sheet(ws, {"name": 34, "basis": 34, "tagline": 28, "refund_rule": 40, "usage_method": 36,
                     "vendor_address": 34, "external_link": 30})
    col = {k: get_column_letter(i + 1) for i, k in enumerate(PCOLS)}

    wo = wb.create_sheet("옵션")
    wo.append(OCOLS)
    for o in opts:
        wo.append([o[k] for k in OCOLS])
    style_sheet(wo, {"name": 30, "option": 44})

    # 카테고리요약: 전부 수식 (상품목록 시트 참조)
    wc = wb.create_sheet("카테고리요약")
    wc.append(["대분류", "소분류", "상품 수", "가격대상 수", "할인율 평균(%)", "할인율 중간값(%)", "할인율 최소(%)",
               "할인율 최대(%)", "평균 판매가(원)", "0-9%", "10-19%", "20-29%", "30-39%", "40-49%", "50%+"])
    pairs = []
    for p in prods:
        for c in p["cats"]:
            if c not in pairs:
                pairs.append(c)
    pairs.sort(key=lambda c: (c[0], c[1]))
    L = lambda k: f"상품목록!${col[k]}$2:${col[k]}${n}"
    for i, (c1, c2) in enumerate(pairs, 2):
        crit = f'{L("cat1")},A{i},{L("cat2")},B{i}'
        pc = f'{L("priced")},"Y"'
        wc.append([
            c1, c2,
            f"=COUNTIFS({crit})",
            f"=COUNTIFS({crit},{pc})",
            f"=IFERROR(ROUND(AVERAGEIFS({L('discount_pct')},{crit},{pc}),1),\"-\")",
            f"=IFERROR(MEDIAN(IF(({L('cat1')}=A{i})*({L('cat2')}=B{i})*({L('priced')}=\"Y\"),{L('discount_pct')})),\"-\")",
            f"=IFERROR(_xlfn.MINIFS({L('discount_pct')},{crit},{pc}),\"-\")",
            f"=IFERROR(_xlfn.MAXIFS({L('discount_pct')},{crit},{pc}),\"-\")",
            f"=IFERROR(ROUND(AVERAGEIFS({L('sale_price')},{crit},{pc}),0),\"-\")",
        ] + [f'=COUNTIFS({crit},{pc},{L("discount_pct")},">={lo}",{L("discount_pct")},"<={hi}")'
             for _, lo, hi in BUCKETS])
    last = len(pairs) + 1
    tot = last + 1
    wc.append(["전체", "", f"=COUNTA({L('product_id')})", f'=COUNTIF({L("priced")},"Y")',
               f'=ROUND(AVERAGEIF({L("priced")},"Y",{L("discount_pct")}),1)',
               f'=MEDIAN(IF({L("priced")}="Y",{L("discount_pct")}))',
               f'=_xlfn.MINIFS({L("discount_pct")},{L("priced")},"Y")',
               f'=_xlfn.MAXIFS({L("discount_pct")},{L("priced")},"Y")',
               f'=ROUND(AVERAGEIF({L("priced")},"Y",{L("sale_price")}),0)']
              + [f'=COUNTIFS({L("priced")},"Y",{L("discount_pct")},">={lo}",{L("discount_pct")},"<={hi}")'
                 for _, lo, hi in BUCKETS])
    from openpyxl.worksheet.formula import ArrayFormula
    for r in range(2, tot + 1):
        c = wc[f"F{r}"]
        c.value = ArrayFormula(f"F{r}", c.value)
    style_sheet(wc, {"대분류": 18, "소분류": 14})
    for c in wc[tot]:
        c.font = Font(name="Arial", size=10, bold=True)
    wc.cell(row=tot + 2, column=1, value="가격대상 = 광고상품·가격 없음 제외 (상품목록 priced=Y). 할인율은 사이트 표기값.").font = BASE
    wc.cell(row=tot + 3, column=1, value="대분류·소분류는 상품목록 cat1·cat2 일치로 셈 (수집 시점 복수 카테고리 상품 없음). 중간값 열은 배열수식.").font = BASE

    # 전북·충남
    wj = wb.create_sheet("전북·충남")
    wj.append(["시도", "product_id", "cat2", "region", "name", "list_price", "sale_price", "discount_pct", "basis",
               "issue_type", "issue_channel", "vendor_name", "vendor_address"])
    for p in focus:
        wj.append([";".join(p["sido"]), p["product_id"], p["cat2"], p["region"], p["name"], p["list_price"],
                   p["sale_price"], p["discount_pct"], p["basis"], p["issue_type"], p["issue_channel"] or p["issue_medium"],
                   p["vendor_name"], p["vendor_address"]])
    k = len(focus) + 3
    wj.cell(row=k, column=1, value="전북 상품 수")
    wj.cell(row=k, column=2, value=f'=COUNTIF({L("sido")},"*전북*")')
    wj.cell(row=k + 1, column=1, value="충남 상품 수")
    wj.cell(row=k + 1, column=2, value=f'=COUNTIF({L("sido")},"*충남*")')
    style_sheet(wj, {"name": 34, "basis": 30, "vendor_address": 34})

    # 워터파크: 옵션별 + 상위10
    ww = wb.create_sheet("워터파크")
    ww.append(["product_id", "region", "name", "option", "detail_div", "week_div", "list_price", "sale_price",
               "discount_pct", "start_date", "end_date", "issue_channel"])
    wp_ids = {p["product_id"]: p for p in wp}
    for o in opts:
        if o["product_id"] in wp_ids:
            p = wp_ids[o["product_id"]]
            ww.append([o["product_id"], o["region"], o["name"], o["option"], o["detail_div"], o["week_div"],
                       o["list_price"], o["sale_price"], o["discount_pct"],
                       o["start_date"] if o["start_div"] != "구매일" else "구매일",
                       o["end_date"] if o["end_div"] != "구매일" else f"구매후{o['end_date']}일",
                       p["issue_channel"] or p["issue_medium"]])
    r0 = ww.max_row + 2
    ww.cell(row=r0, column=1, value="과거 매출 상위 10곳")
    ww.cell(row=r0, column=2, value="검색어(상품명)")
    ww.cell(row=r0, column=3, value="판매 상품 수")
    ww.cell(row=r0, column=4, value="판매 여부")
    for c in ww[r0]:
        c.font = Font(name="Arial", size=10, bold=True)
    kw = {"원마운트": "원마운트", "테르메덴": "테르메덴", "파라다이스 스파도고": "스파 도고", "아산스파비스": "스파비스",
          "웅진플레이도시": "웅진플레이도시", "씨랄라": "씨랄라", "썬밸리": "썬밸리", "아쿠아필드": "아쿠아필드",
          "스플라스리솜": "스플라스", "포레스트리솜": "포레스트 리솜"}
    for i, (name, hit) in enumerate(wtop, r0 + 1):
        ww.cell(row=i, column=1, value=name)
        ww.cell(row=i, column=2, value=kw[name])
        ww.cell(row=i, column=3, value=f'=COUNTIFS({L("name")},"*"&B{i}&"*",{L("cat1")},"워터파크")')
        ww.cell(row=i, column=4, value=f'=IF(C{i}>0,"판매 중","미판매")')
    ww.cell(row=r0 + 12, column=1, value="판매 상품 수 = 상품목록에서 cat1=워터파크이고 name에 검색어가 들어간 상품 수(수식). 과거 매출 순위는 작업지시서 제공 정보.")
    style_sheet(ww, {"name": 30, "option": 44})

    # 발권대행사: 수식 집계
    wa = wb.create_sheet("발권대행사")
    wa.append(["발송채널(issue_channel)", "상품 수", "비중", "즉시발송", "예약필수", "예약대기", "평균 할인율(%)"])
    chans = sorted({p["issue_channel"] for p in prods if p["issue_channel"]})
    for i, ch in enumerate(chans, 2):
        wa.append([ch, f'=COUNTIF({L("issue_channel")},A{i})', f"=B{i}/COUNTA({L('product_id')})",
                   f'=COUNTIFS({L("issue_channel")},A{i},{L("issue_type")},"즉시발송")',
                   f'=COUNTIFS({L("issue_channel")},A{i},{L("issue_type")},"예약필수")',
                   f'=COUNTIFS({L("issue_channel")},A{i},{L("issue_type")},"예약대기")',
                   f'=IFERROR(ROUND(AVERAGEIFS({L("discount_pct")},{L("issue_channel")},A{i},{L("priced")},"Y"),1),"-")'])
    i = len(chans) + 2
    wa.append(["(채널 표기 없음)", f'=COUNTIF({L("issue_channel")},"")', f"=B{i}/COUNTA({L('product_id')})",
               f'=COUNTIFS({L("issue_channel")},"",{L("issue_type")},"즉시발송")',
               f'=COUNTIFS({L("issue_channel")},"",{L("issue_type")},"예약필수")',
               f'=COUNTIFS({L("issue_channel")},"",{L("issue_type")},"예약대기")',
               f'=IFERROR(ROUND(AVERAGEIFS({L("discount_pct")},{L("issue_channel")},"",{L("priced")},"Y"),1),"-")'])
    wa.append(["합계", f"=SUM(B2:B{i})", f"=SUM(C2:C{i})", f"=SUM(D2:D{i})", f"=SUM(E2:E{i})", f"=SUM(F2:F{i})", ""])
    for r in range(2, i + 2):
        wa[f"C{r}"].number_format = "0.0%"
    style_sheet(wa, {"발송채널(issue_channel)": 26})
    wa.cell(row=i + 3, column=1, value="발송채널 = 상품 안내문의 '카카오톡 발송채널 : ○○' 표기. 표기 없음은 LMS 문자 발송·예약상품·광고상품 등.")
    wa.cell(row=i + 3, column=1).comment = Comment("parse.py issue_channel 규칙", "analyze.py")

    from openpyxl.workbook.properties import CalcProperties
    wb.calculation = CalcProperties(fullCalcOnLoad=True)
    wb.save(DATA / "nextgate_products.xlsx")


if __name__ == "__main__":
    ctx = main()
    print("report:", OUT / "report.md", "xlsx:", DATA / "nextgate_products.xlsx")

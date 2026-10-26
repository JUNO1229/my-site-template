"""수집 원본(raw/ 또는 samples/)을 상품·옵션 표로 변환하고, 상세 HTML과 목록 JSON을 교차검증한다.

사용
  python3 parse.py samples   # samples/ 검증 → samples/parsed_samples.json, 검증 결과 출력
  python3 parse.py full      # raw/ → data/nextgate_products.csv, data/nextgate_options.csv

원천
- 목록 JSON(cartListAjax): 옵션 전체(정상가·판매가·할인율·기간·주중/주말·대소), 카테고리
- 상세 HTML(cartProduct): 뱃지, 대표가격, 유효기간, 안내문, 환불규정, 시설정보
  (값은 HTML을 우선하고, JSON과 다르면 check 열에 기록한다)
"""
import csv
import json
import re
import sys
from datetime import datetime
from pathlib import Path

from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent

PRODUCT_FIELDS = [
    "product_id", "cat1", "cat2", "region", "name", "tagline",
    "list_price", "sale_price", "discount_pct", "basis", "option_count", "options",
    "valid_from", "valid_to", "valid_days", "validity_static", "badges", "issue_type", "issue_channel", "issue_medium",
    "usage_method", "max_qty", "refund_rule", "vendor_name", "vendor_address", "vendor_phone",
    "external_link", "ticket_type", "ticket_div", "calendar_chk", "manage_name",
    "check", "notice_text", "refund_text", "collected_at",
]
OPTION_FIELDS = [
    "product_id", "option_id", "name", "region", "cat1", "cat2", "option", "detail_div",
    "week_div", "time_div", "list_price", "sale_price", "discount_pct", "calc_discount_pct",
    "min_ticket_unit", "start_div", "start_date", "end_div", "end_date", "is_basis",
]


# ---------- 텍스트 도구 ----------
def html_text(s):
    if not s:
        return ""
    s = re.sub(r"(?i)<br\s*/?>|</p>|</div>|</li>", "\n", s)
    t = BeautifulSoup(s, "lxml").get_text()
    t = t.replace("\r", "").replace("\xa0", " ").replace("　", " ")
    lines = [re.sub(r"[ \t]+", " ", ln).strip() for ln in t.split("\n")]
    return "\n".join(ln for ln in lines if ln)


def to_int(v):
    try:
        return int(str(v).replace(",", "").strip())
    except (TypeError, ValueError):
        return None


def split_name(product_name):
    m = re.match(r"\s*\[([^\]]+)\]\s*(.*)", product_name or "")
    return (m.group(1).strip(), m.group(2).strip()) if m else ("", (product_name or "").strip())


# ---------- 항목 추출 ----------
def issue_channel(text):
    m = re.search(r"발송\s*채널\s*[:：]\s*([^\n]+)", text)
    return m.group(1).strip() if m else ""


def issue_medium(text):
    """발송 수단: 카카오 발송채널(알림톡) / LMS 문자 / 순차 발송 / 기타."""
    m = []
    if re.search(r"발송\s*채널|알림톡|카카오톡\s*(?:으로|발송)", text):
        m.append("알림톡")
    if re.search(r"LMS|문자\s*(?:로|발송)", text):
        m.append("LMS 문자")
    if re.search(r"순차\s*발송", text):
        m.append("순차 발송")
    return "/".join(m)


def issue_type(ticket_div, text):
    if re.search(r"예약\s*대기", text):
        return "예약대기"
    return {"바로 사용가능": "즉시발송", "예약필수": "예약필수",
            "수령 후 사용 가능": "수령후사용", "광고상품": "광고상품"}.get(ticket_div or "", ticket_div or "")


USAGE_RULES = [
    ("QR/바코드 제시", r"(QR|큐알|바코드)[^\n]{0,40}(제시|스캔|확인|입장)|(제시|스캔)[^\n]{0,20}(QR|바코드)"),
    ("매표소 교환", r"매표소[^\n]{0,40}(교환|발권|수령|제시)|(교환|발권)[^\n]{0,20}매표소"),
    ("전화 예약", r"(전화|유선|☎)[^\n]{0,40}예약|예약[^\n]{0,30}(전화|유선|☎|0\d{1,3}-\d{3,4}-\d{4})"),
    ("온라인 예약", r"(홈페이지|네이버|온라인|예약\s*링크|URL|사이트)[^\n]{0,40}예약|예약[^\n]{0,30}(홈페이지|링크|URL)"),
    ("카카오톡 예약", r"(카카오톡|카톡|알림톡)[^\n]{0,40}예약"),
    ("바로 입장", r"바로\s*(입장|사용|이용)"),
]


def usage_method(text):
    tags = " / ".join(name for name, pat in USAGE_RULES if re.search(pat, text))
    m = re.search(r"이용\s*방법\s*[:：]\s*([^\n]+)", text)
    line = m.group(1).strip() if m else ""
    return f"{tags} | {line}" if tags and line else (tags or line)


def refund_summary(text):
    """기한 / 수수료 / 불가 조건 / 접수 방법으로 요약. 공통 문구인 타행 이체 수수료(500원)는 제외."""
    if not text:
        return ""
    parts = []
    m = re.search(r"(수령|구매|결제)[^\n]{0,8}로부터\s*(\d+)\s*일\s*이내", text)
    if m:
        parts.append(f"기한: {m.group(1)} 후 {m.group(2)}일 이내")
    fees = []
    m = re.search(r"장당\s*([\d,]+)\s*원", text)
    if m:
        fees.append(f"발송·취소 장당 {m.group(1)}원")
    for d, v in re.findall(r"(\d+)\s*일\s*전[^\n]{0,30}?(\d+\s*%|기본\s*수수료)", text):
        fees.append(f"D-{d} {v.replace(' ', '')}")
    for v in re.findall(r"(?<!\d)(\d{1,3})\s*%[^\n]{0,10}(?:수수료|공제|위약금)", text):
        if not any(v + "%" in f for f in fees):
            fees.append(f"{v}%")
    if fees:
        parts.append("수수료: " + ", ".join(dict.fromkeys(fees)))
    no = []
    if re.search(r"부분[^\n]{0,6}(?:취소|환불)[^\n]{0,20}불가", text):
        no.append("부분취소")
    if re.search(r"(?:기간\s*경과|만료)[^\n]{0,30}(?:취소|환불)[^\n]{0,6}(?:안|불가)", text):
        no.append("기간경과")
    if re.search(r"예약\s*확정[^\n]{0,15}(?:취소|환불)[^\n]{0,6}불가", text):
        no.append("예약확정 후")
    if re.search(r"(?:당일|NO\s*show|노쇼)[^\n]{0,15}(?:환불|취소)\s*불가", text, re.I):
        no.append("당일·노쇼")
    if re.search(r"(?:사용|발권|발송)\s*(?:후|이후|된)[^\n]{0,10}(?:환불|취소)\s*불가", text):
        no.append("사용·발권 후")
    if no:
        parts.append("불가: " + ", ".join(no))
    ch = []
    if re.search(r"유선|전화|☎", text):
        ch.append("유선(주중)" if re.search(r"주중에\s*유선", text) else "유선")
    if re.search(r"게시판|문의하기|1:1", text):
        ch.append("게시판")
    if re.search(r"카카오|카톡", text):
        ch.append("카카오톡")
    if ch:
        parts.append("접수: " + "/".join(ch))
    return " | ".join(parts)


def vendor(text):
    def grab(pat):
        m = re.search(pat, text)
        return m.group(1).strip() if m else ""
    return (grab(r"(?:업체명|이용\s*업체|시설명)\s*[:：]\s*([^\n]+)"),
            grab(r"(?:업체\s*주소|주\s*소)\s*[:：]\s*([^\n]+)"),
            grab(r"(?:상담\s*문의|전화\s*번호|연락처|대표\s*번호|문의|전화)\s*[:：]\s*([^\n]+)"))


def external_links(homepage, contents_html, notice):
    links = []
    if homepage:
        links.append(homepage.strip())
    links += re.findall(r'href="(https?://[^"]+)"', contents_html or "")
    links += re.findall(r"https?://[^\s<>\"')]+", notice)
    links = [l.rstrip(".,") for l in links if "nextgate.kr" not in l]
    return " ; ".join(dict.fromkeys(links))


def validity_from_html(raw):
    """상세 HTML 정적 표기(예: '0 ~ 30', '0 ~ 2026-12-31', '2026-10-01 ~ 2026-10-31') 해석."""
    if not raw:
        return "", "", ""
    a, _, b = [x.strip() for x in raw.partition("~")]
    vf = "구매일" if a in ("0", "구매일로부터", "null", "") else a
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", b):
        return vf, b, ""
    m = re.search(r"(\d+)", b)
    return vf, "", (m.group(1) if m else b)


def validity_from_json(p):
    """상세 페이지 makeUseDate() 규칙을 옵션 데이터로 재현."""
    opts = p["eventDetailList"]
    starts = [o["start_date"] for o in opts if o["start_div"] != "구매일" and o["start_date"]]
    ends = [o["end_date"] for o in opts if o["end_div"] != "구매일" and o["end_date"]]
    days = [to_int(o["end_date"]) for o in opts if o["end_div"] == "구매일"]
    vf = min(starts) if (starts and p.get("startDiv") != 0) else "구매일"
    vt = max(ends) if (ends and p.get("endDiv") != 0) else ""
    vd = str(max(d for d in days if d is not None)) if any(d is not None for d in days) else ""
    if p.get("endDiv") == 0 and not vd:
        m = re.search(r"(\d+)", p.get("endDate") or "")
        vd = m.group(1) if m else ""
    return vf, vt, vd


# ---------- 상세 HTML ----------
def parse_detail_html(html):
    soup = BeautifulSoup(html, "lxml")
    g = lambda sel: (soup.select_one(sel).get_text(" ", strip=True) if soup.select_one(sel) else "")
    out = {
        "badges": [li.get_text(strip=True).lstrip("◎").strip() for li in soup.select("ul.lab_top li.lab_x")],
        "tagline": g("p.tit_01"),
        "title": g("p.detail_tit"),
        "list_price": to_int(re.sub(r"\D", "", g("p.pre_price"))),
    }
    dp = soup.select_one("p.detail_price")
    if dp:
        txt = dp.get_text(" ", strip=True)
        m = re.search(r"판매가\s*([\d,]+)", txt)
        out["sale_price"] = to_int(m.group(1)) if m else None
        m = re.search(r"\((.*)기준", txt, re.S)
        out["basis"] = re.sub(r"\s+", " ", m.group(1)).strip() if m else ""
    vp = soup.select_one("#normal_option p.option")
    out["validity_raw"] = vp.get_text(strip=True).split("|", 1)[-1].strip() if vp else ""
    out["options"] = [{"option_id": o.get("data-id"), "option": o.get_text(" ", strip=True),
                       "sale_price": to_int(o.get("value")), "discount_pct": to_int(o.get("data-discount")),
                       "min_ticket_unit": to_int(o.get("data-min_ticket_unit"))}
                      for o in soup.select("#select_box option[data-id]")]
    box = soup.select_one("div.details_contents_01 .contents_box")
    secs = box.select("section") if box else []
    out["notice_html"] = str(secs[0]) if secs else ""
    out["refund_text"] = html_text(str(secs[1])) if len(secs) > 1 else ""
    fac = soup.select_one("div.details_contents03 .contents_box")
    out["facility_text"] = html_text(str(fac)) if fac else ""
    m = re.search(r'var idx_eventProduct = "(\d+)"', html)
    out["product_id"] = m.group(1) if m else None
    return out


# ---------- 조립 ----------
def build(p, cats, detail_html, collected_at):
    pid = p["idx_eventProduct"]
    d = parse_detail_html(detail_html) if detail_html else None
    region, name = split_name(p["product_name"])
    notice = html_text(d["notice_html"]) if d else html_text(p.get("contents"))
    notice = re.sub(r"^▷ 상품 기본정보\n", "", notice)
    refund = d["refund_text"] if d else html_text(p.get("ref_guide"))
    refund = re.sub(r"^▷ 취소˙환불규정을 확인하세요!\n", "", refund)
    fac = d["facility_text"] if d else html_text(p.get("enter_info"))
    vname, vaddr, vphone = vendor(fac)
    opts = p["eventDetailList"]
    basis_opt = opts[0] if opts else {}
    checks = []

    if d:
        badges = d["badges"]
        lp, sp, basis = d["list_price"], d["sale_price"], d["basis"]
        # 화면에 최종 표시되는 유효기간은 JS(makeUseDate)가 옵션 데이터로 다시 계산한 값 → JSON 규칙 사용.
        # HTML 정적 표기는 참고용으로 validity_static에 남긴다.
        vf, vt, vd = validity_from_json(p)
        validity_static = d["validity_raw"]
        if d["title"] != p["product_name"]:
            checks.append("상품명 불일치")
        if (lp, sp) != (to_int(basis_opt.get("normal_price")), to_int(basis_opt.get("sale_price"))):
            checks.append("대표가격 불일치")
        if len(d["options"]) != len(opts):
            checks.append(f"옵션수 HTML {len(d['options'])} / JSON {len(opts)}")
    else:
        checks.append("상세 없음(JSON만 사용)")
        badges = [b for b in (p.get("ticket_type"), p.get("ticket_div")) if b]
        lp, sp = to_int(basis_opt.get("normal_price")), to_int(basis_opt.get("sale_price"))
        basis = (basis_opt.get("option_standard") or "").strip()
        vf, vt, vd = validity_from_json(p)
        validity_static = ""

    disc = to_int(basis_opt.get("discount"))
    if disc is None and lp and sp:
        disc = round((lp - sp) / lp * 100)

    options = []
    for i, o in enumerate(opts):
        np_, sp_ = to_int(o["normal_price"]), to_int(o["sale_price"])
        options.append({
            "product_id": pid, "option_id": o["idx_eventDetail"], "name": name, "region": region,
            "cat1": ";".join(dict.fromkeys(c[0] for c in cats)), "cat2": ";".join(dict.fromkeys(c[1] for c in cats)),
            "option": (o["option"] or "").strip(), "detail_div": o.get("detail_div") or "",
            "week_div": o.get("week_div") or "", "time_div": o.get("time_div") or "",
            "list_price": np_, "sale_price": sp_, "discount_pct": to_int(o["discount"]),
            "calc_discount_pct": round((np_ - sp_) / np_ * 100, 1) if np_ and sp_ is not None else None,
            "min_ticket_unit": o.get("min_ticket_unit"),
            "start_div": o["start_div"], "start_date": o["start_date"],
            "end_div": o["end_div"], "end_date": o["end_date"], "is_basis": i == 0,
        })

    prod = {
        "product_id": pid,
        "cat1": ";".join(dict.fromkeys(c[0] for c in cats)),
        "cat2": ";".join(dict.fromkeys(c[1] for c in cats)),
        "region": region, "name": name,
        "tagline": (d["tagline"] if d else "") or (p.get("sale_exp") or "").strip(),
        "list_price": lp, "sale_price": sp, "discount_pct": disc, "basis": basis,
        "option_count": len(opts),
        "options": json.dumps([{k: o[k] for k in ("option", "detail_div", "week_div", "list_price",
                                                  "sale_price", "discount_pct", "start_date", "end_date")}
                               for o in options], ensure_ascii=False),
        "valid_from": vf, "valid_to": vt, "valid_days": vd, "validity_static": validity_static,
        "badges": ";".join(badges),
        "issue_type": issue_type(p.get("ticket_div"), notice),
        "issue_channel": issue_channel(notice),
        "issue_medium": issue_medium(notice),
        "usage_method": usage_method(notice),
        "max_qty": to_int(p.get("ticket_limit")),
        "refund_rule": refund_summary(refund),
        "vendor_name": vname, "vendor_address": vaddr, "vendor_phone": vphone,
        "external_link": external_links(p.get("homepage"), p.get("contents"), notice),
        "ticket_type": p.get("ticket_type") or "", "ticket_div": p.get("ticket_div") or "",
        "calendar_chk": p.get("calendar_chk") or "", "manage_name": p.get("manage_name") or "",
        "check": "; ".join(checks),
        "notice_text": notice, "refund_text": refund,
        "collected_at": collected_at,
    }
    return prod, options


def write_csv(path, rows, fields):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        for r in rows:
            w.writerow({k: r.get(k) for k in fields})


def mtime(path):
    return datetime.fromtimestamp(path.stat().st_mtime).isoformat(timespec="seconds")


def run_samples():
    sd = ROOT / "samples"
    lst = json.loads((sd / "테마파크_목록.json").read_text())
    full = {x["idx_eventProduct"]: x for x in json.loads((ROOT / "raw/probe/list_all.json").read_text())}
    out = []
    for f in sorted(sd.glob("*_*.html")):
        pid = f.stem.rsplit("_", 1)[1]
        p = full[pid]
        cats = [(p["category"], p["category_sub"])]
        prod, opts = build(p, cats, f.read_text(), mtime(f))
        out.append({"product": prod, "options": opts})
    (sd / "parsed_samples.json").write_text(json.dumps(out, ensure_ascii=False, indent=1))
    # 테마파크 목록 검증: 목록 카드 값(첫 옵션 기준)을 JSON만으로 재구성
    rows = [build(p, [(p["category"], p["category_sub"])], None, mtime(sd / "테마파크_목록.json"))[0] for p in lst]
    write_csv(sd / "테마파크_목록_parsed.csv", rows, PRODUCT_FIELDS)
    return out, rows


def run_full():
    raw = ROOT / "raw"
    cats, products = {}, {}
    index = json.loads((raw / "list" / "index.json").read_text())  # 파일명 → [대분류, 소분류]
    for f in sorted((raw / "list").glob("*.json")):
        if f.name in ("subcategories.json", "index.json"):
            continue
        for p in json.loads(f.read_text()):
            pid = p["idx_eventProduct"]
            products.setdefault(pid, p)
            if f.name in index:
                pair = tuple(index[f.name])
                if pair not in cats.setdefault(pid, []):
                    cats[pid].append(pair)
    prods, opts, missing = [], [], []
    for pid, p in products.items():
        dp = raw / "detail" / f"{pid}.html"
        html = dp.read_text() if dp.exists() else None
        if html is None:
            missing.append(pid)
        c = cats.get(pid) or [(p["category"], p["category_sub"])]
        prod, o = build(p, c, html, mtime(dp) if dp.exists() else mtime(raw / "list" / "all.json"))
        prods.append(prod)
        opts += o
    write_csv(ROOT / "data/nextgate_products.csv", prods, PRODUCT_FIELDS)
    write_csv(ROOT / "data/nextgate_options.csv", opts, OPTION_FIELDS)
    print(f"상품 {len(prods)}개, 옵션 {len(opts)}개, 상세 없음 {len(missing)}개 {missing}")
    print(f"교차검증 경고 {sum(1 for p in prods if p['check'])}건")
    for p in prods:
        if p["check"]:
            print(f"  {p['product_id']} {p['name']}: {p['check']}")
    return prods, opts


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else ""
    if mode == "samples":
        out, rows = run_samples()
        for r in out:
            p = r["product"]
            print("=" * 70)
            for k in PRODUCT_FIELDS:
                if k in ("notice_text", "refund_text", "options"):
                    v = (p[k] or "")[:120].replace("\n", " ⏎ ")
                else:
                    v = p[k]
                print(f"{k:15}: {v}")
            print("options:")
            for o in r["options"]:
                print(f"   - {o['option']} | {o['detail_div']} | {o['week_div']} | "
                      f"{o['list_price']}→{o['sale_price']} ({o['discount_pct']}%) | {o['start_date']}~{o['end_date']}")
        print("=" * 70)
        print(f"테마파크 목록 {len(rows)}개 → samples/테마파크_목록_parsed.csv")
    elif mode == "full":
        run_full()
    else:
        print(__doc__)

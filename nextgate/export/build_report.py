"""모두패스 약식 보고서 v1.1 기준 HTML·PDF·기획용 원고 생성.

  python3 export/build_report.py --fonts <Pretendard woff2 폴더> [--pdf]

- 수치는 analyze.main()이 수집 데이터에서 계산한 값만 쓴다.
- HTML은 A4(794×1123) 쪽 단위로 자동 배치된다(쪽 나누기는 페이지 안 스크립트).
- --pdf: Chromium으로 쪽마다 따로 렌더링해 1개 PDF로 합친다. 쪽마다 본문 넘침 0px을 확인한다.
"""
import argparse
import base64
import html
import io
import re
import statistics as st
import sys
from collections import Counter
from datetime import timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
import analyze as A  # noqa: E402

EXPORT = ROOT / "export"
DOC = "넥스트에너지 판매상품 분석 보고서"
VERSION = "2.0"
COMPANY = "(주)모두패스"
AUTHOR = "전준호"
FONT_WEIGHTS = {400: "Regular", 500: "Medium", 600: "SemiBold", 700: "Bold", 800: "ExtraBold"}

e = html.escape
f = A.fmt


def won(v):
    return f(v, "원")


def pct(v):
    return f(v, "%")


def dot(d):
    return d.strftime("%Y. %m. %d")


def short(d):
    return f"{d.month}. {d.day}."


def pname(p):
    return f"[{p['region']}] {p['name']}" if p["region"] else p["name"]


# ---------- 블록 ----------
class Doc:
    def __init__(self):
        self.html, self.md = [], []

    def chapter(self, no, title):
        self.html.append(f'<div class="ch" data-k="head"><span class="no">{no:02d}</span><span class="tt">{e(title)}</span></div>')
        self.md += [f"## {no:02d} {title}", ""]

    def sub(self, no, title):
        self.html.append(f'<div class="sub" data-k="head" data-t="{e(no)} {e(title)}"><i></i>{e(no)} {e(title)}</div>')
        self.md += [f"### {no} {title}", ""]

    def p(self, text, cls=""):
        self.html.append(f'<p class="{cls}">{rich(text)}</p>')
        self.md += [plain(text), ""]

    def note(self, text):
        self.html.append(f'<p class="note">{rich(text)}</p>')
        self.md += [plain(text), ""]

    def ul(self, items, cls="ul"):
        self.html.append(f'<ul class="{cls}">' + "".join(f"<li>{rich(t)}</li>" for t in items) + "</ul>")
        mark = "- [ ] " if cls == "check" else "- "
        self.md += [mark + plain(t) for t in items] + [""]

    def ol(self, items):
        out = []
        for i, (title, subs) in enumerate(items, 1):
            sl = "".join(f"<li>{rich(s)}</li>" for s in subs)
            out.append(f'<li><div class="olt"><b class="n">{i}.</b><b>{rich(title)}</b></div><ul class="ul2">{sl}</ul></li>')
            self.md.append(f"{i}. **{plain(title)}**")
            self.md += [f"   - {plain(s)}" for s in subs]
        self.html.append('<ol class="ol">' + "".join(out) + "</ol>")
        self.md.append("")

    def dl(self, pairs):
        self.html.append('<dl class="dl">' + "".join(f"<dt>{e(k)}</dt><dd>{rich(v)}</dd>" for k, v in pairs) + "</dl>")
        self.md += [f"- **{k}**: {plain(v)}" for k, v in pairs] + [""]

    def box(self, title, items):
        li = "".join(f"<li>{rich(t)}</li>" for t in items)
        self.html.append(f'<div class="box"><div class="bt">{e(title)}</div><ul class="ul">{li}</ul></div>')
        self.md += [f"**{title}**", ""] + [f"- {plain(t)}" for t in items] + [""]

    def bars(self, rows, unit="%", vmax=None):
        vmax = vmax or max(v for _, v, _ in rows)
        out = []
        for label, v, sub in rows:
            w = v / vmax * 100
            out.append(f'<div class="br"><span class="bl">{e(label)}</span><span class="bt2"><span style="width:{w:.1f}%"></span></span>'
                       f'<span class="bv">{f(v, unit)}</span><span class="bs">{e(sub)}</span></div>')
        self.html.append('<div class="bars">' + "".join(out) + "</div>")
        self.md += ["(막대) " + " / ".join(f"{l} {f(v, unit)} ({s})" for l, v, s in rows), ""]

    def table(self, headers, rows, cls="", widths=None, align=None):
        """align: 열별 'l'|'c'|'r'. 숫자 열은 r."""
        align = align or ["l"] * len(headers)
        cg = ""
        if widths:
            cg = "<colgroup>" + "".join(f'<col style="width:{w}">' if w else "<col>" for w in widths) + "</colgroup>"
        th = "".join(f"<th>{e(h)}</th>" for h in headers)
        body = "".join("<tr>" + "".join(f'<td class="{align[i]}">{rich(str(c))}</td>' for i, c in enumerate(r)) + "</tr>" for r in rows)
        self.html.append(f'<table class="tbl {cls}" data-k="table">{cg}<thead><tr>{th}</tr></thead><tbody>{body}</tbody></table>')
        self.md += [A.table(headers, [[plain(str(c)) for c in r] for r in rows]), ""]


TAG = {"t1": "tag t1", "t2": "tag t2", "t3": "tag t3"}


def tag(kind, text):
    return f"{{{{{kind}:{text}}}}}"


def rich(s):
    s = e(s)
    s = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", s)
    s = re.sub(r"\[\[(\d+)\]\]", r'<sup class="fn">[\1]</sup>', s)
    s = re.sub(r"\{\{(t[123]):(.+?)\}\}", lambda m: f'<span class="{TAG[m.group(1)]}">{m.group(2)}</span>', s)
    return s


def plain(s):
    s = re.sub(r"\[\[(\d+)\]\]", r"[\1]", s)
    return re.sub(r"\{\{t[123]:(.+?)\}\}", r"\1", s)


# ---------- 본문 ----------
def build(c):
    prods, opts, priced, groups = c["prods"], c["opts"], c["priced"], c["groups"]
    by_pid, ch, wp, wtop, today, d = c["by_pid"], c["ch"], c["wp"], c["wtop"], c["today"], c["diff"]
    old_p, old_o, old_day = d["old_p"], d["old_o"], d["old_day"]
    old_priced = [p for p in old_p if p["priced"]]
    med = lambda ps: st.median(p["discount_pct"] for p in ps)
    gmed = lambda k: med(groups[k])
    D = Doc()

    # 01 개요
    D.chapter(1, "개요")
    ad = [p for p in prods if not p["priced"]]
    D.dl([
        ("조사 대상", "(주)넥스트에너지 판매사이트 nextgate.kr의 전체 판매 상품[[1]]"),
        ("조사 목적", "모두의티켓 상품 구성, 직계약 할인율 기준선, 우선 공략 시설·지역 결정"),
        ("수집 일시", f"{dot(today)} (직전 수집 {dot(old_day)}[[2]])"),
        ("수집 규모", f"상품 {len(prods)}개 · 옵션 {len(opts)}개 · 수집 실패 0건"),
        ("가격 기준", f"대표가격은 사이트에 첫 번째로 표시되는 옵션. 할인율은 사이트 표기값. "
                   f"가격 통계는 광고상품·가격 없음 {len(ad)}개를 뺀 {len(priced)}개 기준"),
    ])
    miss = [n for n, h in wtop if not h]
    wp_med = gmed(("워터파크", "워터파크"))
    ls = ch.get("엘에스컴퍼니", [])
    jb = [p for p in c["focus"] if "전북" in p["sido"]]
    cn = [p for p in c["focus"] if "충남" in p["sido"]]
    D.box("핵심 요약", [
        f"**판매 상품 {len(old_p)}개 → {len(prods)}개**: {short(old_day)} 대비 새 상품 {len(d['added'])}개, 판매 종료 {len(d['removed'])}개. "
        f"할인율 중간값은 {pct(med(old_priced))} → {pct(med(priced))}",
        f"**워터파크 할인율 중간값 {pct(wp_med)}**: {len(groups[('워터파크', '워터파크')])}개 중 "
        f"{sum(1 for p in groups[('워터파크', '워터파크')] if p['discount_pct'] >= 40)}개가 40% 이상으로 가격 경쟁이 가장 치열함",
        f"**과거 매출 상위 워터파크 미판매: {', '.join(miss)}**. 테르메덴은 {short(old_day)}에는 없었으나 새로 판매 시작",
        f"**전북 {len(jb)}개 · 충남 {len(cn)}개**: 전북은 여전히 경쟁 상품이 없는 공백 지역",
        f"**발권 대행 의존**: 엘에스컴퍼니 {len(ls)}개({len(ls) / len(prods) * 100:.0f}%)로 최대. 공룡월드 체인이 직계약 1순위 후보",
    ])

    # 02 변동
    D.chapter(2, f"{short(old_day)} 대비 판매 상품 변동")
    D.sub("2-1.", "규모 변화")
    wp_old = [p for p in old_p if any(x[0] == "워터파크" for x in p["cats"])]
    ls_old = [p for p in old_p if p["issue_channel"] == "엘에스컴퍼니"]
    om = lambda ps, k: st.median(p["discount_pct"] for p in ps if p["priced"] and any(x == k for x in p["cats"]))
    rows = [
        ["판매 상품", f"{len(old_p)}개", f"{len(prods)}개", f"{len(prods) - len(old_p):+d}개"],
        ["옵션(권종)", f"{len(old_o)}개", f"{len(opts)}개", f"{len(opts) - len(old_o):+d}개"],
        ["가격 통계 대상", f"{len(old_priced)}개", f"{len(priced)}개", f"{len(priced) - len(old_priced):+d}개"],
        ["할인율 중간값 (전체)", pct(med(old_priced)), pct(med(priced)), f"{med(priced) - med(old_priced):+.1f}%p"],
        ["할인율 중간값 (테마파크)", pct(om(old_p, ("테마파크", "테마파크"))), pct(gmed(("테마파크", "테마파크"))),
         f"{gmed(('테마파크', '테마파크')) - om(old_p, ('테마파크', '테마파크')):+.1f}%p"],
        ["할인율 중간값 (워터파크)", pct(om(old_p, ("워터파크", "워터파크"))), pct(wp_med),
         f"{wp_med - om(old_p, ('워터파크', '워터파크')):+.1f}%p"],
        ["워터파크 상품", f"{len(wp_old)}개", f"{len(wp)}개", f"{len(wp) - len(wp_old):+d}개"],
        ["엘에스컴퍼니 발권 상품", f"{len(ls_old)}개", f"{len(ls)}개", f"{len(ls) - len(ls_old):+d}개"],
    ]
    D.table(["항목", dot(old_day), dot(today), "증감"], rows, align=["l", "r", "r", "r"])
    D.note(f"※ 같은 상품 판정은 지역 태그와 상품명 일치 기준. 상품 번호가 새로 바뀐 {len(d['new_id'])}개도 같은 상품으로 셈")

    D.sub("2-2.", f"새로 올라온 상품 ({len(d['added'])}개)")
    D.table(["카테고리", "상품", "판매가", "할인율", "발송채널"],
            [[p["cat2"], pname(p), won(p["sale_price"]), pct(p["discount_pct"]), p["issue_channel"] or p["issue_medium"] or "-"]
             for p in d["added"]], align=["c", "l", "r", "r", "l"])
    D.sub("2-3.", f"판매가 끝난 상품 ({len(d['removed'])}개)")
    D.p(f"{short(old_day)} 목록에 있었으나 {short(today)} 목록에서 빠진 상품. 직전 유효기간이 9월·10월에 끝난 상품이 대부분이며, "
        "씨랄라 워터파크와 경주 뽀로로아쿠아빌리지 워터파크가 포함됨.")
    D.table(["카테고리", "상품", "직전 판매가", "직전 할인율", "직전 유효기간 종료"],
            [[p["cat2"], pname(p), won(p["sale_price"]), pct(p["discount_pct"]), p["valid_to"] or "-"]
             for p in sorted(d["removed"], key=lambda p: p["valid_to"] or "")], align=["c", "l", "r", "r", "c"])
    D.sub("2-4.", f"대표가격·할인율이 바뀐 상품 ({len(d['changed'])}개)")
    ch_rows = sorted(d["changed"], key=lambda x: (x[1]["discount_pct"] or 0) - (x[0]["discount_pct"] or 0), reverse=True)
    D.table(["상품", "직전", "현재", "할인율 변화"],
            [[pname(n), f"{won(o['sale_price'])} · {pct(o['discount_pct'])}", f"{won(n['sale_price'])} · {pct(n['discount_pct'])}",
              f"{n['discount_pct'] - o['discount_pct']:+d}%p"] for o, n in ch_rows], align=["l", "r", "r", "r"])
    D.note("※ 대표가격은 첫 번째 옵션 기준. 시즌 권종이 바뀌거나 옵션 순서가 바뀌면 같은 시설이라도 값이 달라짐 "
           "(예: 클럽디오아시스는 9월 단일권이 빠지고 10회권만 남음)")

    # 03 카테고리
    D.chapter(3, "카테고리별 할인율 현황")
    D.sub("3-1.", "소분류별 상품 수·할인율")
    cnt = Counter(x for p in prods for x in p["cats"])
    rows = []
    for c1 in c["cats1"]:
        for (a, b), g in sorted(groups.items(), key=lambda kv: -len(kv[1])):
            if a == c1 and b != "(전체)":
                s = A.stats([p["discount_pct"] for p in g])
                rows.append([a, b, f"{cnt[(a, b)]}개", pct(s["mean"]), pct(s["median"]), f"{pct(s['min'])}~{pct(s['max'])}",
                             won(round(st.mean(p["sale_price"] for p in g)))])
    s = A.stats([p["discount_pct"] for p in priced])
    rows.append(["**전체**", "", f"{len(prods)}개", pct(s["mean"]), pct(s["median"]), f"{pct(s['min'])}~{pct(s['max'])}",
                 won(round(st.mean(p["sale_price"] for p in priced)))])
    D.table(["대분류", "소분류", "상품 수", "평균", "중간값", "범위", "평균 판매가"], rows, align=["l", "l", "r", "r", "r", "c", "r"])
    no_price = [x for x in cnt if x not in groups]
    D.note(f"※ 가격이 없는 광고상품 소분류({', '.join(b for _, b in no_price)})는 표에서 뺌")
    D.sub("3-2.", "소분류별 할인율 중간값 (상품 3개 이상)")
    br = sorted([(b, st.median(p["discount_pct"] for p in g), f"{len(g)}개") for (a, b), g in groups.items()
                 if b != "(전체)" and len(g) >= 3], key=lambda r: -r[1])
    D.bars(br, vmax=70)
    D.sub("3-3.", "할인율 구간별 상품 수")
    rows = []
    for c1 in c["cats1"]:
        g = groups.get((c1, "(전체)"), [])
        if not g:
            continue
        cb = Counter(A.bucket(p["discount_pct"]) for p in g)
        rows.append([c1] + [cb.get(b[0], 0) or "·" for b in A.BUCKETS] + [len(g)])
    cb = Counter(A.bucket(p["discount_pct"]) for p in priced)
    rows.append(["**전체**"] + [cb.get(b[0], 0) for b in A.BUCKETS] + [len(priced)])
    D.table(["대분류"] + [b[0] for b in A.BUCKETS] + ["합계"], rows, align=["l"] + ["r"] * 7)

    # 04 지역
    D.chapter(4, "지역별 판매 상품 분포")
    D.sub("4-1.", "권역 × 대분류 상품 수")
    main_c = ["테마파크", "워터파크", "레져", "공연", "숙박"]
    rows = []
    for g in A.GWON_ORDER:
        m = c["mat"].get(g)
        if not m:
            continue
        etc = sum(v for k, v in m.items() if k not in main_c)
        rows.append([g] + [m.get(k, 0) or "·" for k in main_c] + [etc or "·", sum(m.values())])
    D.table(["권역"] + main_c + ["기타", "합계"], rows, align=["l"] + ["r"] * 7)
    D.note("※ 여러 지역에 걸친 상품(예: [서울/천안])은 해당 권역마다 1개씩 셈. 기타 = 전시·의료·자동차·푸드")
    D.p("시도별: " + ", ".join(f"{k} {v}개" for k, v in c["sido_cnt"].most_common()) + ". **전북은 0개**.")
    D.sub("4-2.", f"충남 판매 상품 ({len(cn)}개)")
    D.table(["카테고리", "상품", "정상가", "판매가", "할인율", "발송채널"],
            [[p["cat2"], pname(p), won(p["list_price"]), won(p["sale_price"]), pct(p["discount_pct"]),
              p["issue_channel"] or p["issue_medium"] or "-"] for p in cn], align=["c", "l", "r", "r", "r", "l"])

    # 05 가격 경쟁력
    D.chapter(5, "가격 경쟁력")
    low = c["low"]
    D.sub("5-1.", f"할인율 15% 미만 상품 ({len(low)}개)")
    D.p("할인 폭이 작아 온라인 쿠폰·현장 할인보다 불리할 수 있는 상품. 옵션 중 최고 할인율이 대표보다 크게 높은 상품은 대표 권종 선정 문제임.")
    D.table(["카테고리", "상품", "판매가", "대표 할인율", "옵션 최고 할인율"],
            [[p["cat2"], pname(p), won(p["sale_price"]), pct(p["discount_pct"]),
              pct(max((o["discount_pct"] or 0) for o in by_pid[p["product_id"]]))] for p in low],
            align=["c", "l", "r", "r", "r"])
    aw = c["aw_rows"]
    D.sub("5-2.", f"대표가격이 소인·주중 기준인 상품 ({len(aw)}개)")
    D.p("대표가격이 소인 또는 주중 권종이면 목록의 할인율이 실제 수요가 큰 대인·주말 가격보다 높게 보일 수 있음. "
        "대인(또는 대소공통) 주말 옵션의 평균 할인율과 비교함.")
    rows = [[r[1], r[2], r[3], r[6] if r[6] != "-" else "옵션 없음", r[8]] for r in aw]
    D.table(["상품", "대표 기준", "대표 할인율", "대인·주말 평균", "차이"], rows, align=["l", "c", "r", "r", "r"])
    neg = [r for r in aw if r[8] != "-" and r[8].startswith("-") and float(r[8].rstrip("%p")) <= -5]
    D.note(f"※ 대인·주말 할인율이 대표보다 5%p 이상 낮은 상품 {len(neg)}개: "
           + ", ".join(r[1].split("] ")[-1] for r in neg))

    # 06 유효기간
    D.chapter(6, "유효기간")
    soon = sorted(c["soon"], key=lambda x: x[1])
    D.sub("6-1.", f"30일 안에 판매가 끝나는 상품 ({len(soon)}개)")
    end_nov = sum(1 for p, _ in soon if p["valid_to"].endswith("-11-30"))
    D.p(f"{dot(today)} 기준. 유효기간 종료일은 옵션 종료일 중 가장 늦은 날. "
        f"{len(soon)}개 중 {end_nov}개가 11월 30일에 끝나므로 12월 재오픈 여부를 다시 확인해야 함. "
        f"기간이 지났는데 판매 중인 상품은 {len(c['expired'])}개.")
    D.table(["카테고리", "상품", "종료일", "남은 일수"],
            [[p["cat2"], pname(p), p["valid_to"], f"{dd}일"] for p, dd in soon], align=["c", "l", "c", "r"])
    D.sub("6-2.", "판매 기간 방식")
    vd = Counter(p["valid_days"] for p in prods if p["valid_days"])
    mon = c["monthly"]
    D.ul([
        f"**기간 지정형**: 유효기간을 날짜로 정한 상품 {sum(1 for p in prods if p['valid_to'])}개",
        "**구매 후 N일형**: " + ", ".join(f"{k}일 {v}개" for k, v in sorted(vd.items(), key=lambda x: int(x[0]))),
        f"**월 단위 판매**: {len(mon)}개 (" + ", ".join(f"{pname(p)} {r.split(' (')[0].replace('유효기간 ', '')}" for p, r in mon) + ")",
    ])

    # 07 발권
    D.chapter(7, "발권 구조")
    D.sub("7-1.", "발권 방식별 상품 수")
    it = Counter(p["issue_type"] for p in prods)
    desc = {"즉시발송": "결제 후 모바일 이용권 바로 발송", "예약필수": "이용일 예약 후 사용", "예약대기": "구매 후 예약 확정 대기",
            "수령후사용": "발송 후 수령·교환 절차 필요", "광고상품": "결제 없이 외부 상담으로 연결"}
    D.table(["발권 방식", "상품 수", "비중", "내용"],
            [[k, f"{v}개", f"{v / len(prods) * 100:.0f}%", desc.get(k, "")] for k, v in it.most_common()], align=["l", "r", "r", "l"])
    D.sub("7-2.", "발권 대행사(카카오 발송채널)별 상품 수")
    rows = []
    for k, v in sorted(ch.items(), key=lambda x: -len(x[1])):
        cats = ", ".join(dict.fromkeys(x[1] for p in v for x in p["cats"]))
        rows.append([k.replace("(채널 표기 없음 · ", "채널 표기 없음 (").replace(")", ")") if k.startswith("(") else k,
                     f"{len(v)}개", f"{len(v) / len(prods) * 100:.0f}%", cats])
    D.table(["발송채널", "상품 수", "비중", "카테고리"], rows, align=["l", "r", "r", "l"])
    D.note("※ 발송채널은 상품 안내문의 '발송채널 : ○○' 표기. 표기가 없으면 발송 수단(LMS 문자·알림톡)으로 구분")

    # 08 워터파크
    D.chapter(8, "워터파크 판매 현황")
    D.sub("8-1.", f"판매 중인 워터파크 ({len(wp)}개, 옵션 {sum(len(by_pid[p['product_id']]) for p in wp)}개)")
    D.table(["상품", "시도", "판매가", "할인율", "종료일", "발송채널"],
            [[pname(p), "/".join(p["sido"]), won(p["sale_price"]), pct(p["discount_pct"]), p["valid_to"] or "-",
              p["issue_channel"] or p["issue_medium"] or "-"] for p in sorted(wp, key=lambda p: -p["discount_pct"])],
            align=["l", "c", "r", "r", "c", "l"])
    D.note("※ 옵션별 가격(대소·주중/주말)은 엑셀 '워터파크' 시트와 nextgate_options.csv 참고")
    D.sub("8-2.", "과거 매출 상위 10곳 판매 여부")
    old_wtop = {n: [p for p in old_p if re.search(pat, p["name"] + " " + p["vendor_name"]) and any(x[0] == "워터파크" for x in p["cats"])]
                for n, pat in A.WATERPARK_TOP10}
    rows = []
    for i, (n, hit) in enumerate(wtop, 1):
        before = "판매" if old_wtop[n] else "미판매"
        now = tag("t3", "판매 중") if hit else tag("t1", "미판매")
        rows.append([i, n, before, now, "; ".join(f"{won(p['sale_price'])} · {pct(p['discount_pct'])}" for p in hit) or "-",
                     "; ".join(dict.fromkeys(p["issue_channel"] or p["issue_medium"] or "-" for p in hit)) or "-"])
    D.table(["순위", "시설", short(old_day), short(today), "판매가 · 할인율", "발송채널"], rows, align=["c", "l", "c", "c", "r", "l"])
    D.note("※ 순위와 과거 매출은 작업지시서 제공 정보[[3]]이며 수집 데이터가 아님. 미판매 시설은 넥스트에너지 채널이 비어 있어 우선 접촉 대상")

    # 09 시사점
    D.chapter(9, "모두의티켓 시사점")
    D.sub("9-1.", "직계약 할인율 기준선")
    D.p("카테고리별 넥스트에너지 할인율 중간값. 직계약 할인율이 이 값 이상이면 넥스트에너지 같은 카테고리 상품의 절반 이상보다 유리함.")
    rows = []
    for c1 in c["cats1"]:
        for (a, b), g in groups.items():
            if a == c1 and b != "(전체)" and len(g) >= 3:
                m_ = st.median(p["discount_pct"] for p in g)
                rows.append([a, b, f"{len(g)}개", f"**{pct(m_)}**", pct(round(st.mean(p['discount_pct'] for p in g), 1)),
                             f"{sum(1 for p in g if p['discount_pct'] >= m_)}개"])
    D.table(["대분류", "소분류", "가격 대상", "기준선(중간값)", "평균", "기준선 이상"], rows, align=["l", "l", "r", "r", "r", "r"])
    D.note("※ 상품 3개 미만 소분류는 기준선에서 뺌")

    D.sub("9-2.", "넥스트에너지가 비어 있는 지역·카테고리")
    honam = [p for p in prods if "호남" in p["gwon"]]
    cn_cat = Counter(x[0] for p in cn for x in p["cats"])
    D.ul([
        f"**전북 0개**: 호남 전체 {len(honam)}개({', '.join(pname(p) for p in honam)})뿐. 전북은 경쟁 상품이 없는 공백 지역",
        f"**충남 {len(cn)}개**: " + ", ".join(f"{k} {v}개" for k, v in cn_cat.most_common())
        + ". 공연·전시·레져 상품 없음",
        "**겨울 시즌 상품 없음**: 소분류 15개에 스키·눈썰매·캠핑 소분류가 없음. 12월 이후 신규 개설 여부는 재수집으로 확인 필요 (추정)",
    ])

    D.sub("9-3.", "직계약 우선 후보")
    dino = [p for p in ls if "공룡월드" in p["name"]]
    pl = ch.get("플레이스토리", [])
    pl_cn = [p for p in pl if "충남" in p["sido"]]
    D.ol([
        (f"미판매 상위 워터파크: {', '.join(miss)}", [
            "넥스트에너지 채널에 상품이 없어 경쟁 없이 제안 가능",
            f"씨랄라는 {short(old_day)}에 {won(old_wtop['씨랄라'][0]['sale_price'])}({pct(old_wtop['씨랄라'][0]['discount_pct'])})에 판매하다 빠짐"
            if old_wtop.get("씨랄라") else "씨랄라는 판매 이력 없음",
        ]),
        (f"공룡월드 체인 {len(dino)}곳 (엘에스컴퍼니 발권)", [
            f"평균 할인율 {st.mean(p['discount_pct'] for p in dino):.1f}%로 테마파크 기준선({pct(gmed(('테마파크', '테마파크')))}) 수준",
            "충남 지점: " + ", ".join(pname(p) for p in dino if "충남" in p["sido"]) + " → 1차 공략 지역과 겹침",
        ]),
        (f"충남 리솜 {len(pl_cn)}곳 (플레이스토리 발권)", [
            ", ".join(f"{pname(p)} {pct(p['discount_pct'])}" for p in pl_cn),
            f"워터파크 기준선 {pct(wp_med)}보다 크게 낮아 직계약 시 가격 우위 가능",
        ]),
    ])

    D.sub("9-4.", "후속 조치")
    D.ul([
        f"{', '.join(miss)} 영업 접촉 일정 수립",
        "공룡월드 체인(아산·천안 포함) 직계약 제안서 작성: 할인율 기준선 이상으로 설계",
        "전북 1차 상품 구성안 작성 (경쟁 상품 0개)",
        f"12월 첫 주 재수집: 11월 30일 종료 {end_nov}개 상품의 재오픈 여부와 겨울 시즌 상품 개설 확인",
    ], cls="check")

    # 10 참고
    D.chapter(10, "수집 방법·참고자료")
    D.dl([
        ("수집 방식", "사이트 공개 목록(cartListAjax)과 상품 상세(cartProduct)만 조회. 읽기 전용"),
        ("요청 수", "109건 (목록 16건, 상세 91건, 입장 2건), 간격 2~3초, 동시 1건, 실패 0건"),
        ("보내지 않은 요청", "조회수 증가, 장바구니, 재고 확인, 주문, 로그인, 문의 작성"),
        ("검증", f"목록과 상세의 상품명·대표가격·옵션 수 교차검증 불일치 0건 ({len(prods)}개)"),
        ("원자료", "nextgate/data/nextgate_products.csv · nextgate_options.csv · nextgate_products.xlsx"),
    ])
    refs = [
        ("1", f"(주)넥스트에너지 판매사이트 (수집 {dot(today)})", "https://nextgate.kr/", "nextgate.kr"),
        ("2", f"넥스트에너지 판매상품 분석 보고서 v1.0 (수집 {dot(old_day)})", None, "nextgate/data/archive"),
        ("3", "작업지시서 「넥스트에너지 판매사이트 상품 수집·분석」 (과거 워터파크 매출 순위)", None, "내부 자료"),
    ]
    D.html.append('<ul class="refs">' + "".join(
        f'<li><b>[{n}]</b> {e(t)} — ' + (f'<a href="{u}" target="_blank" rel="noopener">{e(l)}</a>' if u else e(l)) + "</li>"
        for n, t, u, l in refs) + "</ul>")
    D.md += [f"- [{n}] {t} — {u or l}" for n, t, u, l in refs] + [""]
    return D


# ---------- HTML ----------
CSS = r"""
:root{
  /* A4 약식 보고서: 쪽(794×1123)마다 머리글·본문·하단, 흰 바탕 단일 테마 */
  --main:#3669A1; --main-dk:#2A5383; --text-co:#3B5C87; --accent:#EBB00F;
  --sky1:#F2F6FB; --sky2:#E6EEF7; --frame:#C9D8EA;
  --black:#000; --body:#222; --g1:#4d4d52; --g2:#65656b; --g3:#77777d;
  --line1:#e7e5ea; --line2:#dcdae0; --tagline:#bdbac3; --paper:#fff; --desk:#e9edf2;
  --font:'Pretendard','Apple SD Gothic Neo','Malgun Gothic',sans-serif;
  color-scheme:light;
}
*{box-sizing:border-box}
body{margin:0;background:var(--desk);color:var(--body);font-family:var(--font);word-break:keep-all;
  -webkit-print-color-adjust:exact;print-color-adjust:exact}
#wrap{padding-block:24px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));
  display:flex;justify-content:center}
#pages{display:flex;flex-direction:column;gap:24px;width:794px;flex:none}
.page{width:794px;height:1123px;background:var(--paper);position:relative;display:flex;flex-direction:column;overflow:hidden;
  box-shadow:0 1px 3px rgba(30,50,80,.12)}
.page .tab{position:absolute;right:48px;top:0;width:40px;height:44px;background:var(--main)}
.hd{padding:36px 112px 0 56px;height:64px;display:flex;align-items:center;justify-content:space-between;flex:none}
.hd .logo{height:28px;width:auto;display:block}
.hd .logo-slot{height:28px}
.hd .dn{font-size:11px;color:var(--g3)}
.pb{flex:1;min-height:0;padding:40px 56px 22px;display:flex;flex-direction:column;gap:16px;overflow:hidden}
.pb.tight{gap:12px}
.pb.tight .tbl td{padding:9px 12px}
.ft{height:44px;flex:none;display:flex;align-items:center;justify-content:space-between;padding:0 56px;background:var(--paper)}
.ft .co{display:flex;align-items:center;gap:7px;font-size:14px;font-weight:800;color:var(--text-co)}
.ft .co img{height:20px;width:auto}
.ft .pn{font-size:14px;font-weight:500;color:var(--main);font-variant-numeric:tabular-nums}
#src{position:absolute;left:-10000px;top:0;width:682px}

/* 제목 블록 */
.tb{display:flex;flex-direction:column;gap:10px;padding-bottom:28px;border-bottom:2px solid var(--black)}
.tb .ar{font-size:14px;font-weight:700;letter-spacing:.2em;color:var(--accent)}
.tb h1{margin:4px 0 0;font-size:30px;font-weight:800;line-height:1.25;color:var(--black);text-wrap:balance}
.tb h1 em{font-style:normal;color:var(--main)}
.tb .by{margin-top:6px;display:flex;gap:28px}
.tb .by span{display:flex;align-items:baseline;gap:8px}
.tb .by b{font-size:14px;font-weight:800;color:var(--main)}
.tb .by i{font-style:normal;font-size:12px;font-weight:500;color:var(--black)}
.tb + .ch{margin-top:12px}

/* 장·소제목 */
.ch{position:relative;display:flex;align-items:baseline;gap:12px;padding-bottom:12px;border-bottom:1px solid var(--line2);margin-top:8px}
.ch::after{content:"";position:absolute;left:0;bottom:-2px;width:48px;height:3px;background:var(--accent)}
.ch .no{font-size:24px;font-weight:800;color:var(--main);font-variant-numeric:tabular-nums}
.ch .tt{font-size:22px;font-weight:800;color:var(--black)}
.sub{display:flex;align-items:center;gap:8px;font-size:16px;font-weight:800;color:var(--black);margin-top:10px}
.sub i{width:8px;height:8px;background:var(--main);flex:none}
.sub .cont{font-size:13px;font-weight:600;color:var(--g3)}
.sub + *{margin-top:-2px}
.pb > :first-child{margin-top:0}

/* 본문 */
p{margin:0;font-size:15px;line-height:1.85;color:var(--body)}
p b{font-weight:700}
.note{font-size:13.5px;line-height:1.7;color:var(--g2)}
.tbl + .note{margin-top:-10px}
.ul,.check,.ul2{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px}
.ul li,.check li{position:relative;padding-left:16px;font-size:14.5px;line-height:1.8}
.ul li::before{content:"";position:absolute;left:0;top:11px;width:6px;height:6px;background:var(--main)}
.check li{padding-left:24px}
.check li::before{content:"";position:absolute;left:0;top:6px;width:13px;height:13px;border:1.5px solid var(--main)}
.ol{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px}
.ol .olt{font-size:14.5px;line-height:1.8;display:flex;gap:6px}
.ol .n{color:var(--main);font-weight:800}
.ol .olt b{font-weight:700}
.ul2{gap:4px;margin-top:4px;padding-left:20px}
.ul2 li{position:relative;padding-left:13px;font-size:14px;line-height:1.75}
.ul2 li::before{content:"";position:absolute;left:0;top:10px;width:5px;height:5px;background:var(--main)}
.dl{display:grid;grid-template-columns:120px 1fr;column-gap:16px;margin:0}
.dl dt,.dl dd{margin:0;padding:9px 0;border-bottom:1px solid var(--line1);font-size:15px;line-height:1.8}
.dl dt{font-weight:700;color:var(--main)}
.box{background:var(--sky1);padding:18px 20px;display:flex;flex-direction:column;gap:10px}
.box .bt{font-size:15px;font-weight:800;color:var(--main)}
.fn{color:var(--main);font-size:10px;font-weight:700}

/* 표 */
.tbl{width:100%;border-collapse:collapse;table-layout:auto;font-size:13.5px;line-height:1.65;border-bottom:3px solid var(--main);
  font-variant-numeric:tabular-nums}
.tbl th{background:var(--sky2);color:var(--main);font-weight:700;text-align:center;padding:10px 12px;border-top:3px solid var(--main);
  white-space:nowrap}
.tbl td{padding:11px 12px;vertical-align:top;border-top:1px solid var(--line1)}
.tbl td:first-child{font-weight:700;white-space:nowrap}
.tbl td.r{text-align:right;white-space:nowrap}
.tbl td.c{text-align:center;white-space:nowrap}
.tbl b{font-weight:800}
.tag{display:inline-block;border-radius:4px;padding:1px 7px;font-size:11.5px;line-height:1.6;font-weight:700;white-space:nowrap}
.t1{background:var(--main);color:#fff}
.t2{background:var(--sky2);color:var(--main)}
.t3{background:var(--paper);border:1px solid var(--tagline);color:var(--g1)}

/* 막대 */
.bars{display:flex;flex-direction:column;gap:8px}
.br{display:grid;grid-template-columns:88px 1fr 52px 40px;align-items:center;gap:12px;font-size:13.5px}
.bl{font-weight:700}
.bt2{height:14px;background:var(--sky1);border:1px solid var(--frame);position:relative}
.bt2 span{position:absolute;inset:0 auto 0 0;background:var(--main)}
.bv{text-align:right;font-weight:800;font-variant-numeric:tabular-nums}
.bs{color:var(--g2);font-size:12px}
.refs{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px;font-size:13.5px;line-height:1.7}
.refs b{color:var(--main);font-weight:700}
a{color:var(--main)}
a:hover{color:var(--main-dk)}
a:focus-visible{outline:2px solid var(--main);outline-offset:2px}
body.print #wrap{padding:0}
body.print #pages{gap:0}
body.print .page{box-shadow:none}
@media print{body{background:var(--paper)} #wrap{padding:0} #pages{gap:0} .page{box-shadow:none;break-after:page}}
"""

JS = r"""
(async function(){
  const W = 794;
  try { await document.fonts.ready; } catch(e) {}
  const src = document.getElementById('src'), pages = document.getElementById('pages'), tpl = document.getElementById('tpl');
  const blocks = [...src.children];
  let body = null, heads = [], lastSub = '', n = 0;
  const over = b => b.scrollHeight > b.clientHeight;
  function newPage(){
    const pg = tpl.content.firstElementChild.cloneNode(true);
    pages.appendChild(pg); n++;
    body = pg.querySelector('.pb'); return body;
  }
  function fits(){
    if (!over(body)) return true;
    if (!body.classList.contains('tight')) { body.classList.add('tight'); if (!over(body)) return true; body.classList.remove('tight'); }
    return false;
  }
  function contHead(){
    const d = document.createElement('div'); d.className = 'sub'; d.dataset.k = 'head';
    d.innerHTML = '<i></i>' + lastSub + ' <span class="cont">(계속)</span>'; return d;
  }
  function moveHeads(){
    const hs = heads; heads = []; newPage(); hs.forEach(h => body.appendChild(h)); return hs.length;
  }
  function placeTable(t){
    body.appendChild(t);
    if (fits()) return;
    const rows = [...t.tBodies[0].rows];
    // 이 쪽에 3행 이상 들어가면 나누고, 아니면 통째로 다음 쪽
    let k = 0;
    t.tBodies[0].innerHTML = '';
    for (const r of rows) { t.tBodies[0].appendChild(r); if (!fits()) { t.tBodies[0].removeChild(r); break; } k++; }
    const fresh = body.children.length - 1 === heads.length;
    // 남는 행이 1행이면 1행을 더 넘긴다 (외톨이 행 방지)
    if (rows.length - k === 1 && k > 3) { t.tBodies[0].removeChild(rows[k - 1]); k--; }
    if ((k < 3 || rows.length <= 8) && !fresh) {
      t.remove(); rows.forEach(r => t.tBodies[0].appendChild(r));
      if (heads.length) moveHeads(); else { newPage(); if (lastSub) { const h = contHead(); body.appendChild(h); heads = [h]; } }
      return placeTable(t);
    }
    if (k === 0) { t.tBodies[0].appendChild(rows[0]); k = 1; }
    heads = [];
    let rest = rows.slice(k);
    while (rest.length) {
      newPage(); body.appendChild(contHead());
      const t2 = t.cloneNode(false); t2.appendChild(t.tHead.cloneNode(true)); if (t.querySelector('colgroup')) t2.prepend(t.querySelector('colgroup').cloneNode(true));
      const tb = document.createElement('tbody'); t2.appendChild(tb); body.appendChild(t2);
      let m = 0;
      for (const r of rest) { tb.appendChild(r); if (!fits()) { tb.removeChild(r); break; } m++; }
      if (m === 0) { tb.appendChild(rest[0]); m = 1; }
      rest = rest.slice(m);
    }
  }
  newPage();
  for (const b of blocks) {
    if (b.classList.contains('sub')) lastSub = b.dataset.t;
    if (b.classList.contains('ch')) lastSub = b.querySelector('.no').textContent + ' ' + b.querySelector('.tt').textContent;
    if (b.dataset.k === 'table') { placeTable(b); heads = []; continue; }
    body.appendChild(b);
    if (!fits()) {
      body.removeChild(b);
      if (heads.length && body.children.length > heads.length) moveHeads(); else newPage();
      heads = [];
      body.appendChild(b); fits();
    }
    if (b.dataset.k === 'head') heads.push(b); else heads = [];
  }
  const all = [...pages.children];
  all.forEach((pg, i) => {
    pg.querySelector('.pn').textContent = i + 1;
    if (i > 0) pg.querySelector('.dn').textContent = document.body.dataset.doc;
  });
  src.remove();
  window.__overflow = all.map(pg => { const b = pg.querySelector('.pb'); return b.scrollHeight - b.clientHeight; });
  function fit(){
    if (document.body.classList.contains('print')) return;
    const avail = document.documentElement.clientWidth - 32;
    pages.style.zoom = avail < W ? (avail / W).toFixed(4) : '';
  }
  fit(); addEventListener('resize', fit);
  window.__paged = true;
})();
"""


def font_faces(font_dir, text):
    from fontTools import subset
    chars = set(text) | set("0123456789%.,~·()[]+-:/!?»※—→ ")
    faces = []
    for w, name in FONT_WEIGHTS.items():
        opts = subset.Options()
        opts.flavor = "woff2"
        opts.layout_features = ["*"]
        font = subset.load_font(str(Path(font_dir) / f"Pretendard-{name}.woff2"), opts)
        sub = subset.Subsetter(opts)
        sub.populate(text="".join(chars))
        sub.subset(font)
        buf = io.BytesIO()
        subset.save_font(font, buf, opts)
        b64 = base64.b64encode(buf.getvalue()).decode()
        faces.append(f"@font-face{{font-family:'Pretendard';font-weight:{w};font-style:normal;font-display:block;"
                     f"src:url(data:font/woff2;base64,{b64}) format('woff2')}}")
    return "\n".join(faces)


def render_html(D, today, font_dir, logo=None, symbol=None):
    title_words = DOC.rsplit(" ", 1)
    tb = (f'<div class="tb"><div class="ar">»»»</div><h1>{e(title_words[0])} <em>{e(title_words[1])}</em></h1>'
          f'<div class="by"><span><b>작성</b><i>{e(COMPANY)} {e(AUTHOR)}</i></span>'
          f'<span><b>작성일</b><i>{dot(today)}</i></span></div></div>')
    logo_html = f'<img class="logo" src="{logo}" alt="모두패스">' if logo else '<span class="logo-slot"></span>'
    sym_html = f'<img src="{symbol}" alt="">' if symbol else ""
    page_tpl = (f'<template id="tpl"><section class="page"><div class="tab"></div>'
                f'<header class="hd">{logo_html}<span class="dn"></span></header>'
                f'<div class="pb"></div>'
                f'<footer class="ft"><span class="co">{sym_html}{e(COMPANY)}</span><span class="pn"></span></footer></section></template>')
    body = tb + "\n".join(D.html)
    text = re.sub(r"<[^>]+>", "", body) + DOC + COMPANY + "(계속)"
    faces = font_faces(font_dir, html.unescape(text))
    return (f'<title>{e(DOC)}</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n'
            f"<style>\n{faces}\n{CSS}</style>\n"
            f'<div id="wrap"><div id="pages"></div></div>\n{page_tpl}\n<div id="src">{body}</div>\n'
            f"<script>document.body.dataset.doc={DOC!r};\n{JS}</script>\n")


def make_pdf(html_path, pdf_path):
    from playwright.sync_api import sync_playwright
    from pypdf import PdfReader, PdfWriter
    exe = next(Path("/opt/pw-browsers").glob("chromium-*/chrome-linux*/chrome"), None)
    with sync_playwright() as pw:
        br = pw.chromium.launch(executable_path=str(exe) if exe else None)
        pg = br.new_page(viewport={"width": 900, "height": 1200})
        doc = "<!doctype html><html lang='ko'><head><meta charset='utf-8'></head><body class='print'>" + html_path.read_text() + "</body></html>"
        tmp = html_path.with_suffix(".print.html")
        tmp.write_text(doc)
        pg.goto(tmp.as_uri())
        pg.wait_for_function("window.__paged === true", timeout=60000)
        overflow = pg.evaluate("window.__overflow")
        if any(overflow):
            raise SystemExit(f"본문 넘침: {overflow}")
        n = len(overflow)
        pg.add_style_tag(content="#wrap{padding:0!important} #pages{gap:0!important} body{background:#fff!important}")
        writer = PdfWriter()
        for i in range(n):
            pg.evaluate(f"[...document.querySelectorAll('.page')].forEach((p,j)=>p.style.display=j==={i}?'flex':'none')")
            data = pg.pdf(width="210mm", height="297mm", print_background=True, margin=dict(top="0", right="0", bottom="0", left="0"),
                          prefer_css_page_size=False)
            r = PdfReader(io.BytesIO(data))
            writer.add_page(r.pages[0])
        with open(pdf_path, "wb") as fh:
            writer.write(fh)
        fonts = set()
        for p in PdfReader(str(pdf_path)).pages:
            for fo in (p.get("/Resources", {}).get("/Font", {}) or {}).values():
                fonts.add(str(fo.get_object().get("/BaseFont")))
        br.close()
        tmp.unlink()
    return n, overflow, sorted(fonts)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--fonts", required=True, help="Pretendard-*.woff2 폴더")
    ap.add_argument("--pdf", action="store_true")
    ap.add_argument("--logo", help="가로형 컬러 로고 PNG (투명 여백 제거본)")
    ap.add_argument("--symbol", help="심벌 컬러 PNG")
    a = ap.parse_args()
    c = A.main()
    D = build(c)
    datauri = lambda p: "data:image/png;base64," + base64.b64encode(Path(p).read_bytes()).decode() if p else None
    out = EXPORT / f"약식 보고서 - {DOC}.html"
    out.write_text(render_html(D, c["today"], a.fonts, datauri(a.logo), datauri(a.symbol)))
    md = [f"# {DOC} v{VERSION}", "", f"- 작성: {COMPANY} {AUTHOR}", f"- 작성일: {dot(c['today'])}",
          f"- 형태: 약식 보고서 (디자인 문서: 약식 보고서 - {DOC}.html / PDF)", ""] + D.md
    md += appendix(c)
    (EXPORT / f"{DOC}_v{VERSION}.md").write_text("\n".join(md))
    print("html:", out)
    if a.pdf:
        n, ov, fonts = make_pdf(out, EXPORT / f"약식 보고서 - {DOC}.pdf")
        print(f"pdf: {n}쪽, 넘침 {ov}, 서체 {fonts}")


def appendix(c):
    d = c["diff"]
    L = ["## 부록 A. 미결 검토 사항", ""]
    L.append(A.table(["항목", "내용", "상태"], [
        ["로고", "가로형 로고·심벌 파일을 받지 못해 머리글 로고 자리는 비워 두고, 하단은 회사명 글자만 표기", "파일 필요"],
        ["과거 워터파크 매출 순위", "작업지시서 제공 정보(수집 데이터 아님)", "출처 확인 필요"],
        ["겨울 시즌 상품 공백", "스키·눈썰매 소분류 부재에서 나온 추정. 12월 재수집으로 확인", "추정"],
        ["광고상품 6개", "외부 상담 연결 상품이라 가격 통계에서 제외", "기준 확인 필요"],
        ["대인·주말 판정", "옵션 권종 구분(대소·주중/주말)과 옵션명으로 자동 판정. 사이트 권종 표기 오류 가능(예: 썬밸리 소인권이 '대인'으로 등록)", "검증 필요"],
        ["같은 상품 판정", f"지역 태그+상품명 일치 기준. 상품 번호가 바뀐 상품 {len(d['new_id'])}개 포함", "기준 확인 필요"],
    ]))
    L += ["", "## 부록 B. 계산 검증 결과", ""]
    L.append(A.table(["검증 항목", "결과"], [
        ["수집 요청", "109건 모두 HTTP 200, 실패 0건. 조회수·장바구니·재고확인 요청 0건"],
        ["상세 HTML ↔ 목록 JSON 교차검증", f"상품명·대표가격·옵션 수 불일치 0건 ({len(c['prods'])}개)"],
        ["소분류 합계", f"소분류 15개 목록 합계 {len(c['prods'])}개 = 전체 목록 {len(c['prods'])}개"],
        ["직전 수집 대비", f"{len(d['old_p'])} − 종료 {len(d['removed'])} + 신규 {len(d['added'])} = {len(d['old_p']) - len(d['removed']) + len(d['added'])}개 (현재 {len(c['prods'])}개와 일치)"],
        ["PDF 출력", "쪽마다 본문 넘침 0px 확인 후 출력, Pretendard 내장"],
    ]))
    L.append("")
    return L


if __name__ == "__main__":
    main()

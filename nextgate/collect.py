"""nextgate.kr 상품 수집 (읽기 전용).

원칙
- 읽기만 한다. 장바구니·구매·재고확인·조회수·로그인 요청은 보내지 않는다(FORBIDDEN 가드).
- 요청 간격 2~3초, 동시 1개, 실패 시 재시도 최대 2회.
- 진행 상태를 raw/state.json에 저장해 중단 후 이어서 실행할 수 있다.

사용
  python3 collect.py samples   # 샘플 4개 상세 + 테마파크 목록 → samples/
  python3 collect.py full      # 전체 목록 + 소분류 18개 + 상세 전체 → raw/
"""
import json
import random
import re
import sys
import time
from datetime import datetime
from pathlib import Path

import requests

BASE = "https://nextgate.kr/"
CD = "1707897200"  # 사이트 로고 링크(/?CD=1707897200)의 행사코드
UA = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/140.0 Safari/537.36")
ALLOWED = {"", "eventCodeAjax", "cartListAjax", "cartProduct"}
FORBIDDEN = re.compile(r"viewCount|miniCart|cartReset|checkStock|cartOrder|order|"
                       r"payment|login|oauth|qna|purchase", re.I)
MAX_RETRY = 2

ROOT = Path(__file__).resolve().parent
RAW = ROOT / "raw"
SAMPLES = ROOT / "samples"
STATE = RAW / "state.json"
SAMPLE_IDS = {  # 샘플 상품 (목록 JSON에서 확인한 idx_eventProduct)
    "한국민속촌": "328990",
    "볼베어파크": "330001",
    "2호선세입자": "328418",
    "스파도고_캐빈파크": "328481",
}


class Client:
    def __init__(self):
        self.s = requests.Session()
        self.s.headers.update({"User-Agent": UA, "Accept-Language": "ko-KR,ko;q=0.9"})
        self.last = 0.0
        self.count = 0
        self.log = []

    def _wait(self):
        gap = random.uniform(2.0, 3.0)
        elapsed = time.time() - self.last
        if elapsed < gap:
            time.sleep(gap - elapsed)

    def request(self, method, path, data=None, xhr=False):
        if path not in ALLOWED or FORBIDDEN.search(path):
            raise RuntimeError(f"허용되지 않은 요청: {path}")
        url = BASE + path
        headers = {"Referer": BASE}
        if xhr:
            headers["X-Requested-With"] = "XMLHttpRequest"
        for attempt in range(MAX_RETRY + 1):
            self._wait()
            self.last = time.time()
            self.count += 1
            try:
                r = self.s.request(method, url, data=data, headers=headers, timeout=30)
                self.log.append({"t": datetime.now().isoformat(timespec="seconds"), "m": method,
                                 "path": path, "data": data, "status": r.status_code,
                                 "len": len(r.content)})
                if r.status_code == 200:
                    return r
            except requests.RequestException as e:
                self.log.append({"t": datetime.now().isoformat(timespec="seconds"), "m": method,
                                 "path": path, "data": data, "error": str(e)})
            if attempt < MAX_RETRY:
                print(f"  재시도 {attempt + 1}/{MAX_RETRY}: {path} {data}")
        return None

    def enter(self):
        self._wait()
        self.last = time.time()
        self.count += 1
        r = self.s.get(BASE, params={"CD": CD}, headers={"Referer": BASE}, timeout=30)
        self.log.append({"t": datetime.now().isoformat(timespec="seconds"), "m": "GET",
                         "path": f"?CD={CD}", "status": r.status_code, "len": len(r.content)})
        if r.status_code != 200 or len(r.content) < 1000:
            raise RuntimeError("메인 입장 실패 (행사코드 페이지가 비어 있음)")
        if self.request("POST", "eventCodeAjax", {"CD": CD}, xhr=True) is None:
            raise RuntimeError("eventCodeAjax 실패")
        return r.text

    def list(self, cat="", sub="", search_div=""):
        r = self.request("POST", "cartListAjax",
                         {"searchDiv": search_div, "categoryDiv": cat,
                          "categorySubDiv": sub, "searchWord": ""}, xhr=True)
        return None if r is None else r.json()

    def detail(self, pid):
        r = self.request("POST", "cartProduct", {"idx_eventProduct": pid})
        if r is None:
            return None
        if f'var idx_eventProduct = "{pid}"' not in r.text:
            raise RuntimeError(f"상세 페이지 형식이 예상과 다름: {pid}")
        return r.text


def sub_categories(main_html):
    pairs = re.findall(r"categorySubSearch\('([^']*)',\s*'([^']*)'\)", main_html)
    seen, out = set(), []
    for p in pairs:
        if p not in seen:
            seen.add(p)
            out.append(p)
    return out


def safe(name):
    return re.sub(r"[^\w가-힣·&-]+", "_", name)


def load_state():
    if STATE.exists():
        return json.loads(STATE.read_text())
    return {"lists_done": [], "details_done": [], "failed": {}, "started_at": None}


def save_state(st):
    STATE.write_text(json.dumps(st, ensure_ascii=False, indent=1))


def write_log(c, name):
    (RAW / "logs").mkdir(parents=True, exist_ok=True)
    p = RAW / "logs" / f"{name}_{datetime.now():%Y%m%d_%H%M%S}.json"
    p.write_text(json.dumps(c.log, ensure_ascii=False, indent=1))
    print(f"요청 {c.count}건, 로그: {p.relative_to(ROOT)}")


def run_samples():
    SAMPLES.mkdir(exist_ok=True)
    c = Client()
    main = c.enter()
    (SAMPLES / "main.html").write_text(main)
    data = c.list("테마파크", "테마파크")
    if data is None:
        raise RuntimeError("테마파크 목록 실패")
    (SAMPLES / "테마파크_목록.json").write_text(json.dumps(data, ensure_ascii=False, indent=1))
    print(f"테마파크 목록: {len(data)}개")
    for name, pid in SAMPLE_IDS.items():
        html = c.detail(pid)
        if html is None:
            print(f"실패: {name} {pid}")
            continue
        (SAMPLES / f"{name}_{pid}.html").write_text(html)
        print(f"상세 저장: {name} ({pid})")
    write_log(c, "samples")


def run_full():
    (RAW / "list").mkdir(parents=True, exist_ok=True)
    (RAW / "detail").mkdir(parents=True, exist_ok=True)
    st = load_state()
    st["started_at"] = st["started_at"] or datetime.now().isoformat(timespec="seconds")
    c = Client()
    try:
        main = c.enter()
        (RAW / "main.html").write_text(main)
        subs = sub_categories(main)
        print(f"소분류 {len(subs)}개")
        (RAW / "list" / "subcategories.json").write_text(json.dumps(subs, ensure_ascii=False))

        if "__all__" not in st["lists_done"]:
            data = c.list()
            if data is None:
                raise RuntimeError("전체 목록 실패")
            (RAW / "list" / "all.json").write_text(json.dumps(data, ensure_ascii=False, indent=1))
            st["lists_done"].append("__all__")
            save_state(st)
            print(f"전체 목록: {len(data)}개")

        for cat, sub in subs:
            key = f"{cat}|{sub}"
            if key in st["lists_done"]:
                continue
            data = c.list(cat, sub)
            if data is None:
                st["failed"][f"list:{key}"] = "요청 실패"
            else:
                fname = f"{safe(cat)}__{safe(sub)}.json"
                (RAW / "list" / fname).write_text(json.dumps(data, ensure_ascii=False, indent=1))
                idx_path = RAW / "list" / "index.json"
                idx = json.loads(idx_path.read_text()) if idx_path.exists() else {}
                idx[fname] = [cat, sub]
                idx_path.write_text(json.dumps(idx, ensure_ascii=False, indent=1))
                st["lists_done"].append(key)
                print(f"  {cat} > {sub}: {len(data)}개")
            save_state(st)

        ids = []
        for f in sorted((RAW / "list").glob("*.json")):
            if f.name in ("subcategories.json", "index.json"):
                continue
            for x in json.loads(f.read_text()):
                if x["idx_eventProduct"] not in ids:
                    ids.append(x["idx_eventProduct"])
        todo = [i for i in ids if i not in st["details_done"]]
        print(f"상세: 전체 {len(ids)}개, 남은 {len(todo)}개")
        for n, pid in enumerate(todo, 1):
            html = c.detail(pid)
            if html is None:
                st["failed"][f"detail:{pid}"] = "요청 실패"
            else:
                (RAW / "detail" / f"{pid}.html").write_text(html)
                st["details_done"].append(pid)
                st["failed"].pop(f"detail:{pid}", None)
            save_state(st)
            if n % 10 == 0:
                print(f"  {n}/{len(todo)}")
        st["finished_at"] = datetime.now().isoformat(timespec="seconds")
        save_state(st)
    finally:
        write_log(c, "full")
    print(f"실패: {len(st['failed'])}건")


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else ""
    if mode == "samples":
        run_samples()
    elif mode == "full":
        run_full()
    else:
        print(__doc__)

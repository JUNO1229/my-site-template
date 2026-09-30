"""단계 1: 구조 파악. 읽기 전용, 조회수/장바구니 요청 차단."""
import json, time, re
from playwright.sync_api import sync_playwright

BLOCK = re.compile(r"viewCountUp|miniCart|cartReset|cartAdd|cartInsert|order|payment|login", re.I)
log = []

def on_route(route):
    req = route.request
    if BLOCK.search(req.url):
        log.append({"blocked": True, "method": req.method, "url": req.url, "post": req.post_data})
        return route.abort()
    if req.resource_type in ("image", "font", "media"):
        return route.abort()
    return route.continue_()

def on_response(resp):
    req = resp.request
    if req.resource_type in ("xhr", "fetch", "document"):
        entry = {"method": req.method, "url": req.url, "post": req.post_data,
                 "status": resp.status, "ctype": resp.headers.get("content-type")}
        try:
            body = resp.text()
            entry["len"] = len(body)
            fn = f"raw/probe/{len(log):03d}.txt"
            open(fn, "w").write(body)
            entry["file"] = fn
        except Exception as e:
            entry["err"] = str(e)
        log.append(entry)

with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/opt/pw-browsers/chromium-1194/chrome-linux/chrome", headless=True)
    pg = b.new_page()
    pg.route("**/*", on_route)
    pg.on("response", on_response)
    pg.goto("https://nextgate.kr/", wait_until="networkidle")
    time.sleep(3)
    open("raw/probe/main.html", "w").write(pg.content())
    links = pg.eval_on_selector_all("a[href^='javascript:categorySubSearch']", "els=>els.map(e=>[e.getAttribute('href'), e.innerText.trim()])")
    json.dump(links, open("raw/probe/cat_links.json", "w"), ensure_ascii=False, indent=1)
    log.append({"mark": "CLICK category"})
    target = next((l for l in links if "워터파크" in l[0]), links[0] if links else None)
    if target:
        pg.click(f"a[href=\"{target[0]}\"]", force=True)
        pg.wait_for_load_state("networkidle"); time.sleep(3)
        open("raw/probe/after_click.html", "w").write(pg.content())
        log.append({"url_after": pg.url})
    b.close()
json.dump(log, open("raw/probe/netlog.json", "w"), ensure_ascii=False, indent=1)
print(json.dumps([{k: (v[:300] if isinstance(v, str) else v) for k, v in e.items()} for e in log], ensure_ascii=False, indent=1))

/* 체험판 HTML 을 실제 브라우저에서 눌러 봅니다 */
"use strict";
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const ROOT = path.join(__dirname, "..");

if (!fs.existsSync(path.join(ROOT, "원스탑서비스-체험판.html")))
  { console.error("먼저 node build-demo.js 를 실행해 주세요."); process.exit(1); }
const HTML = fs.readFileSync(path.join(ROOT, "원스탑서비스-체험판.html"));
const srv = http.createServer((q, s) => {
  s.writeHead(200, { "content-type": "text/html; charset=utf-8" }); s.end(HTML);
});

let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log("  ✓", m)) : (fail++, console.log("  ✗", m)); };

(async () => {
  await new Promise((r) => srv.listen(8099, r));
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text()); });

  await page.goto("http://127.0.0.1:8099/");
  await page.waitForTimeout(500);

  const login = async (id, pw) => {
    await page.fill("#lid", id);
    await page.fill("#lpw", pw);
    await page.click('[data-act="login"]');
    await page.waitForTimeout(400);
  };
  const logout = async () => {
    const back = page.locator('[data-act="back"]').first();
    if (await back.count()) { await back.click(); await page.waitForTimeout(350); }
    const b = page.locator('[data-act="logout"]:visible').first();
    if (!await b.count()) throw new Error("로그아웃 버튼을 찾지 못했다");
    await b.click(); await page.waitForTimeout(400);
    await page.waitForSelector("#lid", { timeout: 5000 });
  };
  /* 공고 이름으로 상세 화면을 엽니다 */
  const openPost = async (name) => {
    await page.click('[data-act="tab"][data-v="apply"]');
    await page.waitForTimeout(350);
    const card = page.locator('[data-act="open"]').filter({ hasText: name });
    if (!await card.count()) throw new Error("공고를 찾지 못했다: " + name);
    await card.first().click();
    await page.waitForTimeout(350);
  };
  /* 담당자 탭 — 사이드바와 가로칩 두 벌이 있어 보이는 쪽을 누릅니다 */
  const atab = async (v) => {
    await page.locator(`[data-act="atab"][data-v="${v}"]:visible`).first().click();
    await page.waitForTimeout(450);
  };
  const applyNow = async (phone) => {
    await page.fill("#dph", phone);
    await page.click('[data-act="apply"]');
    await page.waitForTimeout(500);
  };
  const txt = () => page.textContent("#app");

  console.log("\n[1] 로그인 화면");
  ok((await txt()).includes("사회사업실 원스탑 서비스"), "제목이 보인다");
  ok((await txt()).includes("체험판입니다"), "체험판 안내가 보인다");
  await page.click('[data-act="toggleacc"]');
  await page.waitForTimeout(200);
  ok((await txt()).includes("admin / 1234"), "담당자 계정이 보인다");
  ok((await txt()).includes("의무 미충족"), "의무 미충족 표시가 보인다");
  await page.click('[data-act="fill"][data-v="강영식"]');
  await page.waitForTimeout(500);
  ok((await txt()).includes("강영식"), "계정을 누르면 바로 들어간다");
  await logout();

  console.log("\n[2] 잘못된 비밀번호");
  await page.fill("#lid", "강영식");
  await page.fill("#lpw", "0000");
  await page.click('[data-act="login"]');
  await page.waitForTimeout(300);
  ok((await txt()).includes("맞지 않습니다"), "틀린 비밀번호를 막는다");

  console.log("\n[3] 직원 로그인 — 강영식(간호부 10병동)");
  await login("강영식", "9493");
  let t = await txt();
  ok(t.includes("강영식"), "이름이 보인다");
  ok(t.includes("어르신 와플나눔 봉사"), "모집 공고가 보인다");

  console.log("\n[4] 신청하기");
  await openPost("어르신 와플나눔 봉사");
  ok((await txt()).includes("서전주요양원"), "상세 화면이 열린다 (정원 5 · 병동 3)");
  await applyNow("010-5278-9493");
  t = await txt();
  ok(/접수|신청.*완료|승인 대기/.test(t), "신청이 접수된다");
  ok(!t.includes("할당 인원이 초과"), "본인 신청에 병동 초과가 뜨지 않는다");

  console.log("\n[5] 한 달 한 건");
  await page.click('[data-act="back"]');
  await page.waitForTimeout(350);
  await page.click('[data-act="tab"][data-v="my"]');
  await page.waitForTimeout(350);
  ok((await txt()).includes("와플나눔"), "내 실적에 신청이 보인다");
  ok((await txt()).includes("점"), "누적 점수가 보인다");

  console.log("\n[6] 같은 병동 4명 신청 — 4번째는 누락");
  await logout();
  for (const [no, pw] of [["고성호", "4197"], ["권은지", "9236"]]) {
    await login(no, pw);
    await openPost("어르신 와플나눔 봉사");
    await applyNow("010-0000-0000");
    await logout();
  }
  await login("김태현", "9791");
  await openPost("어르신 와플나눔 봉사");
  await applyNow("010-3478-9791");
  ok((await txt()).includes("초과"), "4번째 10병동 직원은 부서 초과 안내를 받는다");
  await logout();

  console.log("\n[6-2] 다른 병동은 정상 접수 · 한 달 한 건");
  await login("홍도윤", "9137");
  await openPost("어르신 와플나눔 봉사");
  await applyNow("010-6737-9137");
  ok(!(await txt()).includes("초과"), "3병동 직원은 정상 접수된다");
  await page.click('[data-act="back"]');
  await page.waitForTimeout(350);
  const more = page.locator('[data-act="open"]').filter({ hasText: "보훈환자 배식봉사" });
  ok(await more.count() > 0, "다른 달 공고는 계속 신청할 수 있다");
  await logout();

  console.log("\n[7] 담당자 로그인");
  await login("admin", "1234");
  t = await txt();
  ok(t.includes("담당자"), "담당자 화면이 열린다");
  ok(t.includes("강영식"), "직원 신청이 담당자 화면에 보인다");

  console.log("\n[8] 신청 현황 · 승인");
  const tabs = await page.locator('[data-act="atab"]:visible').allTextContents();
  ok(tabs.length >= 4, "담당자 탭이 보인다 (" + tabs.map((x) => x.trim()).join(" / ") + ")");
  await atab("apps");
  t = await txt();
  ok(t.includes("강영식") && t.includes("고성호"), "신청자 명단이 보인다");
  const appr = page.locator('[data-act="status"][data-s="approved"]').first();
  if (await appr.count()) {
    await appr.click();
    await page.waitForTimeout(450);
    ok((await txt()).includes("승인"), "승인 버튼이 동작한다");
  } else ok(false, "승인 버튼을 찾지 못했다");

  console.log("\n[9] 직원 관리 탭");
  await atab("staff");
  t = await txt();
  ok(/직원|명단/.test(t), "직원 관리 화면이 열린다");
  ok(t.includes("심유진"), "직원 목록이 보인다");

  console.log("\n[10] 내려받기 — 체험판 안내 창");
  const dl = page.locator('[data-act="expemp"]').first();
  if (await dl.count()) {
    await dl.click();
    await page.waitForTimeout(400);
    ok(await page.locator(".dlgwrap").count() > 0, "내려받기가 안내 창으로 뜬다");
    await page.click("[data-close]");
    await page.waitForTimeout(200);
  } else ok(false, "직원명단 내려받기 버튼을 찾지 못했다");

  console.log("\n[11] 공고 등록 화면");
  await atab("post");
  ok((await txt()).includes("진행 중인 공고"), "모집 공고 화면이 보인다");
  ok((await txt()).includes("완료된 공고"), "완료된 공고 보기 버튼이 있다");

  console.log("\n[12] 가로 스크롤 / 화면 넘침");
  const over = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  ok(!over, "가로로 넘치지 않는다 (420px)");

  await page.screenshot({ path: path.join(ROOT, "tests", "shot-admin.png"), fullPage: false });
  await logout();
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(ROOT, "tests", "shot-login.png"), fullPage: false });
  await page.click('[data-act="toggleacc"]');
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(ROOT, "tests", "shot-accounts.png"), fullPage: true });

  console.log("\n[13] 자바스크립트 오류");
  const real = errs.filter((e) => !/favicon|ERR_/.test(e));
  ok(real.length === 0, "오류 없음" + (real.length ? " → " + real.slice(0, 4).join(" | ") : ""));

  await browser.close(); srv.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})();

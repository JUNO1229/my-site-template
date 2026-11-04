"use strict";
/* 서버를 실제로 띄우고 전체 흐름을 돌려본다 */
const fs = require("node:fs");
const path = require("node:path");

const DATA = path.join(__dirname, "..", "data");
if (fs.existsSync(DATA)) fs.rmSync(DATA, { recursive: true, force: true });

process.env.PORT = "38123";
const store = require("../lib/store");
const auth = require("../lib/auth");
const { server } = require("../server");

store.load();
{ // 담당자 계정 준비
  const db = store.get();
  const { salt, hash } = auth.hashPw("1234");
  db.admins.push({ id: "admin", name: "사회사업실 담당자", salt, hash, mustChange: true });
  store.save();
}

const BASE = "http://127.0.0.1:38123";
let bad = 0, n = 0;
const eq = (got, want, label) => {
  n++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    console.log(`✗ ${label}\n    기대 ${JSON.stringify(want)}\n    실제 ${JSON.stringify(got)}`);
    bad++;
  }
};
const yes = (cond, label) => { n++; if (!cond) { console.log(`✗ ${label}`); bad++; } };

/* 쿠키를 들고 다니는 간단한 클라이언트 */
function client() {
  let cookie = "";
  return async function call(pathname, body, opts = {}) {
    const init = { method: body === undefined ? "GET" : "POST", headers: {}, ...opts };
    if (cookie) init.headers.cookie = cookie;
    if (body !== undefined) {
      if (opts.raw) { init.body = body; }
      else { init.headers["content-type"] = "application/json"; init.body = JSON.stringify(body); }
    }
    const r = await fetch(BASE + pathname, init);
    const sc = r.headers.getSetCookie ? r.headers.getSetCookie() : [];
    for (const c of sc) cookie = c.split(";")[0];
    let j = {}; try { j = await r.json(); } catch {}
    return { status: r.status, ...j };
  };
}

const ymd = (n) => { const t = new Date(); t.setDate(t.getDate() + n);
  const p = (x) => String(x).padStart(2, "0");
  return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`; };
const when = (n, h) => `${ymd(n)}T${String(h).padStart(2, "0")}:00`;

(async () => {
  await new Promise((res) => server.listen(38123, "127.0.0.1", res));

  /* ── 담당자 로그인 ── */
  const A = client();
  let r = await A("/api/login", { id: "admin", pw: "틀림" });
  eq(r.status, 401, "담당자 — 틀린 비밀번호는 거절");
  r = await A("/api/login", { id: "admin", pw: "1234" });
  eq(r.ok, true, "담당자 로그인");
  eq(r.me.mustChange, true, "첫 로그인은 비밀번호 변경 필요");
  r = await A("/api/password", { cur: "1234", next: "hosp-2026" });
  if (!r.ok) console.log("   ↳ 응답:", JSON.stringify(r));
  eq(r.ok, true, "담당자 비밀번호 변경");

  /* ── 직원 명단 올리기 ── */
  const buf = fs.readFileSync("/mnt/user-data/outputs/테스트용_직원명단_가명.xlsx");
  r = await A("/api/admin/upload?kind=employees", buf,
    { raw: true, headers: { "x-filename": encodeURIComponent("테스트용_직원명단_가명.xlsx") } });
  eq(r.ok, true, "직원 명단 업로드(미리보기)");
  eq(r.count, 60, "60명을 읽음");
  eq(r.diff.added.length, 60, "전부 신규");
  yes(Array.isArray(r.check.mixed), "부서 표기 점검 결과 포함");
  const list = r.list;

  r = await A("/api/admin/apply-employees", { list, retire: false, makeAcc: true });
  eq(r.ok, true, "명단 반영");
  eq(r.added, 60, "신규 60명 반영");
  eq(r.issued.length, 60, "계정 60개 발급");
  const pwOf = Object.fromEntries(r.issued.map((x) => [x.empNo, x.pw]));
  yes(r.issued.every((x) => /^\d{4}$/.test(x.pw)), "초기 비밀번호는 연락처 뒷 4자리");

  /* 비밀번호가 평문으로 저장되지 않는지 */
  const raw = fs.readFileSync(path.join(DATA, "db.json"), "utf8");
  yes(!raw.includes(`"pw"`), "db.json에 평문 비밀번호 없음");
  yes(raw.includes('"salt"') && raw.includes('"hash"'), "비밀번호는 해시로 저장");
  const anyPw = Object.values(pwOf)[0];
  yes(!raw.includes(`"${anyPw}"`), "발급된 비밀번호가 파일에 그대로 없음");

  /* ── 봉사 내역 ── */
  const rec = fs.readFileSync("/mnt/user-data/outputs/테스트용_자원봉사내역_가명.xlsx");
  r = await A("/api/admin/upload?kind=records", rec,
    { raw: true, headers: { "x-filename": "r.xlsx" } });
  eq(r.ok, true, "봉사 내역 업로드");
  eq(r.count, 650, "650건");

  /* ── 공고 등록 ── */
  r = await A("/api/admin/posting", { action: "create", rows: [
    { org: "서전주요양원", name: "어르신 배식 봉사", when: when(10, 10), deadline: ymd(5),
      type: "외부", hours: 4, capacity: 2, deptLimit: 2 },
    { org: "전주시노인복지관", name: "다음달 봉사", when: when(40, 9), deadline: ymd(30),
      type: "외부", hours: 4, capacity: 5, deptLimit: 3 },
  ] });
  eq(r.ok, true, "공고 2건 등록");
  r = await A("/api/admin/posting", { action: "create", rows: [
    { org: "X", name: "마감일이 봉사일보다 늦음", when: when(5, 10), deadline: ymd(9),
      type: "외부", hours: 4, capacity: 5, deptLimit: 3 }] });
  eq(r.status, 400, "마감일이 봉사일보다 늦으면 거절");

  let all = await A("/api/admin/all");
  const post1 = all.postings.find((p) => p.name === "어르신 배식 봉사");
  const post2 = all.postings.find((p) => p.name === "다음달 봉사");

  /* ── 직원 로그인과 신청 ── */
  const ward = all.employees.filter((e) => e.dept === "간호부 10병동").slice(0, 4);
  yes(ward.length === 4, "간호부 10병동 4명 확보");

  const C = [];
  for (const e of ward) {
    const c = client();
    let x = await c("/api/login", { id: e.empNo, pw: pwOf[e.empNo] });
    eq(x.ok, true, `${e.name} 로그인`);
    eq(x.me.mustChange, true, `${e.name} 첫 로그인은 비밀번호 변경 필요`);
    x = await c("/api/password", { cur: pwOf[e.empNo], next: "mypw-" + e.empNo });
    eq(x.ok, true, `${e.name} 비밀번호 변경`);
    C.push({ c, e });
  }

  // 연락처 뒷 4자리는 막는다
  {
    const { c, e } = C[0];
    const x = await c("/api/password", { cur: "mypw-" + e.empNo, next: e.phone.replace(/\D/g, "").slice(-4) });
    eq(x.status, 400, "연락처 뒷 4자리로는 바꿀 수 없음");
  }

  // 정원 2 / 부서제한 2
  let x = await C[0].c("/api/apply", { postId: post1.id, phone: C[0].e.phone });
  eq(x.ok, true, "1번 신청 성공");
  eq(x.status, "pending", "1번은 승인대기");
  x = await C[1].c("/api/apply", { postId: post1.id, phone: C[1].e.phone });
  eq(x.status, "pending", "2번도 승인대기 (정원 2명까지)");
  x = await C[2].c("/api/apply", { postId: post1.id, phone: C[2].e.phone });
  eq(x.status, "excluded", "3번은 부서 할당 초과 → 누락");
  yes(String(x.message).includes("부서(병동)별 할당 인원이 초과"), "누락 안내 문구");

  // 같은 공고 재신청
  x = await C[0].c("/api/apply", { postId: post1.id, phone: C[0].e.phone });
  eq(x.status, 400, "같은 공고 재신청 거절");

  // 1인 1건 — 같은 달
  all = await A("/api/admin/all");
  const sameMonth = String(post1.when).slice(0, 7) === String(post2.when).slice(0, 7);
  x = await C[0].c("/api/apply", { postId: post2.id, phone: C[0].e.phone });
  if (sameMonth) eq(x.status, 400, "같은 달 다른 공고 거절");
  else eq(x.ok, true, "다른 달 공고는 신청 가능");

  // 다른 부서 직원으로 정원 채우기 → 예비
  const other = all.employees.filter((e) => e.dept !== "간호부 10병동").slice(0, 3);
  const O = [];
  for (const e of other) {
    const c = client();
    await c("/api/login", { id: e.empNo, pw: pwOf[e.empNo] });
    await c("/api/password", { cur: pwOf[e.empNo], next: "opw-" + e.empNo });
    O.push({ c, e });
  }
  x = await O[0].c("/api/apply", { postId: post1.id, phone: O[0].e.phone });
  eq(x.status, "reserve", "정원 찬 뒤 → 예비 1");
  x = await O[1].c("/api/apply", { postId: post1.id, phone: O[1].e.phone });
  eq(x.status, "reserve", "예비 2");
  x = await O[2].c("/api/apply", { postId: post1.id, phone: O[2].e.phone });
  eq(x.status, 400, "예비 2명 찬 뒤 → 접수 마감");

  /* ── 개인정보가 새지 않는지 ── */
  const me = await C[0].c("/api/me");
  eq(me.ok, true, "직원 본인 정보 조회");
  yes(!("employees" in me), "직원 응답에 전체 명단 없음");
  yes(!("accounts" in me), "직원 응답에 계정 정보 없음");
  yes(me.apps.every((a) => !("phone" in a)), "직원 응답에 다른 사람 연락처 없음");
  yes(me.records.every((rr) => String(rr.empNo) === String(C[0].e.empNo)), "본인 봉사 내역만 내려옴");
  const admOnly = await C[0].c("/api/admin/all");
  eq(admOnly.status, 403, "직원은 담당자 API 접근 불가");
  const noAuth = await client()("/api/admin/all");
  eq(noAuth.status, 401, "로그인 없이 담당자 API 접근 불가");

  /* ── 승인 ── */
  all = await A("/api/admin/all");
  const excluded = all.apps.find((a) => a.status === "excluded");
  r = await A("/api/admin/app-status", { ids: [excluded.id], status: "approved" });
  eq(r.ok, true, "누락 건 추가 승인");
  const pend = all.apps.filter((a) => a.status === "pending").map((a) => a.id);
  r = await A("/api/admin/app-status", { ids: pend, status: "approved" });
  eq(r.count, pend.length, "대기 일괄 승인");

  /* ── 퇴사 처리 ── */
  r = await A("/api/admin/employee", { action: "retire", empNo: C[3].e.empNo });
  eq(r.ok, true, "퇴사 처리");
  const dead = client();
  x = await dead("/api/login", { id: C[3].e.empNo, pw: "mypw-" + C[3].e.empNo });
  eq(x.status, 403, "퇴사자는 로그인 불가");
  all = await A("/api/admin/all");
  yes(all.records.some((rr) => String(rr.empNo) === String(C[3].e.empNo))
    || !all.records.length, "퇴사해도 봉사 내역은 남음");
  r = await A("/api/admin/employee", { action: "restore", empNo: C[3].e.empNo });
  x = await dead("/api/login", { id: C[3].e.empNo, pw: "mypw-" + C[3].e.empNo });
  eq(x.ok, true, "복직하면 다시 로그인 가능");

  /* ── 비밀번호 5회 실패 잠금 ── */
  const lock = client();
  for (let i = 0; i < 5; i++) await lock("/api/login", { id: C[0].e.empNo, pw: "틀림" });
  x = await lock("/api/login", { id: C[0].e.empNo, pw: "mypw-" + C[0].e.empNo });
  eq(x.status, 429, "5회 실패하면 잠김");

  /* ── 비밀번호 초기화 ── */
  r = await A("/api/admin/employee", { action: "resetPw", empNo: C[0].e.empNo });
  yes(/^\d{4}$/.test(r.pw), "초기화하면 연락처 뒷 4자리 비밀번호");
  const back = client();
  x = await back("/api/login", { id: C[0].e.empNo, pw: r.pw });
  eq(x.ok, true, "초기화 뒤 로그인 (잠금도 풀림)");
  eq(x.me.mustChange, true, "초기화하면 다시 변경 필요");

  /* ── 후원 ── */
  x = await O[0].c("/api/donate", { item: "새 수건 20장" });
  eq(x.ok, true, "후원 등록");
  all = await A("/api/admin/all");
  eq(all.donations.length, 1, "담당자 화면에 후원 1건");

  /* ── 접속 기록 ── */
  const logdir = path.join(DATA, "log");
  yes(fs.existsSync(logdir) && fs.readdirSync(logdir).length > 0, "접속 기록 파일 생성");
  const log = fs.readFileSync(path.join(logdir, fs.readdirSync(logdir)[0]), "utf8");
  yes(log.includes('"login"') && log.includes('"apply"'), "로그인·신청 기록 남음");
  yes(!log.includes("mypw-"), "기록에 비밀번호 없음");

  /* ── 백업 ── */
  store.backup();
  yes(fs.readdirSync(path.join(DATA, "backup")).length > 0, "백업 파일 생성");

  /* ── 정적 파일 ── */
  const page = await fetch(BASE + "/");
  eq(page.status, 200, "첫 화면 열림");
  yes((await page.text()).includes("원스탑 서비스"), "화면에 제목 있음");
  const nope = await fetch(BASE + "/../server.js");
  yes(nope.status === 404 || nope.status === 400, "상위 폴더 접근 차단");

  server.close();
  console.log(bad ? `\n✗ ${n}건 중 ${bad}건 실패` : `\n✓ 서버 ${n}건 모두 통과`);
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error("테스트 중 오류:", e); process.exit(1); });

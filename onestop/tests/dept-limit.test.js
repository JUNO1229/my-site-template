"use strict";
/* 부서(병동)별 제한 검사 — 건별 · 월별 · 둘 다 · 제한 없음 · 옛 공고
   엑셀 샘플 없이 혼자 돌아갑니다:  node tests/dept-limit.test.js */
const { spawn } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const R = require("../lib/rules");

const PORT = 38125;
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), "deptlimit-"));
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log(`  ${c ? "✓" : "✗"} ${m}`); };

const jar = () => {
  let cookie = "";
  return async (p, body) => {
    const r = await fetch(`http://127.0.0.1:${PORT}${p}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { cookie, "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const c = r.headers.get("set-cookie"); if (c) cookie = c.split(";")[0];
    return r.json();
  };
};

(async () => {
  console.log("\n[1] 규칙 함수 (옛 공고 호환)");
  ok(R.perLimit({}) === 3, "건별 값이 없는 옛 공고는 3명");
  ok(R.perLimit({ deptLimit: 2 }) === 2, "건별 2명");
  ok(R.perLimit({ deptLimit: 0 }) === 0, "건별 0 = 쓰지 않음");
  ok(R.monthLimit({}) === 0, "월별 값이 없으면 쓰지 않음");
  ok(R.monthLimit({ deptMonthLimit: 4 }) === 4, "월별 4명");
  ok(R.limitIn(undefined, 3) === 3 && R.limitIn(0, 3) === 0 && R.limitIn("0", 3) === 0 && R.limitIn(false, 3) === 0, "저장 값 변환");

  const srv = spawn(process.execPath, [path.join(__dirname, "..", "server.js")],
    { env: { ...process.env, PORT: String(PORT), DATA_DIR: DATA }, stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 1500));
  try {
    const A = jar();
    await A("/api/admin-enter", {});

    // 직원: 부서 X 3명, Y 1명, Z 4명, W 3명, Q 5명 (이름·연락처 뒷 4자리로 로그인)
    const staff = {};
    let n = 0;
    for (const [dept, cnt] of [["간호부 1병동", 3], ["간호부 2병동", 1], ["간호부 3병동", 4], ["간호부 4병동", 3], ["간호부 5병동", 5]]) {
      staff[dept] = [];
      for (let i = 1; i <= cnt; i++) {
        n++;
        const name = `검사${String.fromCharCode(64 + staff[dept].length + 1)}${dept.slice(4, 5)}직원`;
        const phone = `010-7000-${String(1000 + n)}`;
        const r = await A("/api/admin/employee", { action: "create", name, dept, phone });
        if (!r.ok) throw new Error("직원 등록 실패: " + JSON.stringify(r));
        const U = jar();
        const lg = await U("/api/login", { id: name, pw: phone.slice(-4) });
        if (!lg.ok) throw new Error("로그인 실패: " + JSON.stringify(lg));
        staff[dept].push(U);
      }
    }
    const [X, Y, Z, W, Q] = Object.values(staff);

    const post = async (name, when, over) => {
      const row = { org: "시험기관", name, when, deadline: "2027-01-10", type: "외부", hours: 4, capacity: 10, ...over };
      const r = await A("/api/admin/posting", { action: "create", rows: [row] });
      if (!r.ok) throw new Error("공고 등록 실패: " + JSON.stringify(r));
      const all = await A("/api/admin/all");
      return all.postings.find((p) => p.name === name);
    };
    const apply = async (U, p) => U("/api/apply", { postId: p.id });
    const MSG = R.MSG_DEPT_FULL;

    console.log("\n[2] 월별 제한만 — 같은 달 다른 공고까지 합쳐서 센다");
    const P1 = await post("3월-가", "2027-03-15T10:00", { deptLimit: 0, deptMonthLimit: 0 });
    const P2 = await post("3월-나", "2027-03-16T10:00", { deptLimit: 0, deptMonthLimit: 0 });
    const P3 = await post("3월-월별2", "2027-03-17T10:00", { deptLimit: 0, deptMonthLimit: 2 });
    ok(R.perLimit(P3) === 0 && R.monthLimit(P3) === 2, "저장: 건별 끔(0) · 월별 2명");
    let r = await apply(X[0], P1); ok(r.ok && r.status === "pending", "1병동 첫째 → 3월-가 접수");
    r = await apply(X[1], P2); ok(r.ok && r.status === "pending", "1병동 둘째 → 3월-나 접수");
    r = await apply(X[2], P3); ok(r.ok && r.status === "excluded" && r.message === MSG, "1병동 셋째 → 3월-월별2 : 이달 1병동이 이미 2명 → 누락 + 기존 안내 문구");
    r = await apply(Y[0], P3); ok(r.ok && r.status === "pending", "2병동은 같은 공고에 접수(병동별로 센다)");

    console.log("\n[3] 건별 제한만");
    const P4 = await post("4월-건별1", "2027-04-10T10:00", { deptLimit: 1, deptMonthLimit: 0 });
    r = await apply(X[0], P4); ok(r.ok && r.status === "pending", "1병동 첫째 접수");
    r = await apply(X[1], P4); ok(r.ok && r.status === "excluded" && r.message === MSG, "1병동 둘째 → 건별 1명 초과로 누락");

    console.log("\n[4] 둘 다 켬 — 둘 다 지켜야 접수");
    const P5 = await post("5월-둘다", "2027-05-12T10:00", { deptLimit: 2, deptMonthLimit: 3 });
    const P6 = await post("5월-제한없음", "2027-05-13T10:00", { deptLimit: 0, deptMonthLimit: 0 });
    r = await apply(Z[0], P6); ok(r.status === "pending", "3병동 1명 → 5월-제한없음");
    r = await apply(Z[1], P5); ok(r.status === "pending", "3병동 2명째 → 5월-둘다 (건별 0/2, 월별 1/3 통과)");
    r = await apply(Z[2], P5); ok(r.status === "pending", "3병동 3명째 → 5월-둘다 (건별 1/2, 월별 2/3 통과)");
    r = await apply(Z[3], P5); ok(r.status === "excluded", "3병동 4명째 → 건별 2/2 초과(월별 3/3도 초과)");
    const P7 = await post("6월-둘다", "2027-06-12T10:00", { deptLimit: 2, deptMonthLimit: 2 });
    const P8 = await post("6월-제한없음", "2027-06-13T10:00", { deptLimit: 0, deptMonthLimit: 0 });
    r = await apply(W[0], P8); ok(r.status === "pending", "4병동 첫째 → 6월-제한없음");
    r = await apply(W[1], P8); ok(r.status === "pending", "4병동 둘째 → 6월-제한없음");
    r = await apply(W[2], P7); ok(r.status === "excluded", "4병동 셋째 → 건별은 0/2 로 통과해도 월별 2/2 로 누락");

    console.log("\n[5] 둘 다 끔 = 제한 없음");
    const P9 = await post("7월-제한없음", "2027-07-14T10:00", { deptLimit: 0, deptMonthLimit: 0, capacity: 10 });
    let allOk = true;
    for (const U of Q) { const x = await apply(U, P9); if (!(x.ok && x.status === "pending")) allOk = false; }
    ok(allOk, "5병동 5명 모두 접수");

    console.log("\n[6] 직원 화면용 값");
    const me = await X[0]("/api/me");
    const mp = me.postings.find((p) => p.id === P3.id);
    ok(mp && mp.deptLimit === 0 && mp.deptMonthLimit === 2 && mp.myDeptMonth === 2, "내려가는 값: 건별 0 · 월별 2 · 이달 우리 부서 2명");
    const mp5 = me.postings.find((p) => p.id === P5.id);
    ok(mp5 && mp5.deptLimit === 2 && mp5.deptMonthLimit === 3, "둘 다 켠 공고: 건별 2 · 월별 3");

    console.log("\n[7] 수정으로 바꾸기");
    const up = await A("/api/admin/posting", { action: "update", id: P4.id,
      row: { org: "시험기관", name: "4월-건별1", when: "2027-04-10T10:00", deadline: "2027-01-10", type: "외부", hours: 4, capacity: 10, deptLimit: 0, deptMonthLimit: 5 } });
    const all2 = await A("/api/admin/all"); const p4 = all2.postings.find((p) => p.id === P4.id);
    ok(up.ok && R.perLimit(p4) === 0 && R.monthLimit(p4) === 5, "수정: 건별 끔 · 월별 5명으로 바뀜");
  } catch (e) {
    fail++; console.log("  ✗ 검사 중 오류:", e.message);
  } finally {
    srv.kill();
    fs.rmSync(DATA, { recursive: true, force: true });
  }
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})();

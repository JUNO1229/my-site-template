"use strict";
/* ══════════════════════════════════════════════════════════════
   사회사업실 원스탑 서비스 — 원내 서버
   효사랑가족요양병원 2병원 · 원큐사회사업실

   설치할 것이 없습니다. Node.js만 있으면 바로 돌아갑니다.
     실행   node server.js
     주소   http://<이 PC의 IP>:3000
   ══════════════════════════════════════════════════════════════ */

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");

const store = require("./lib/store");
const auth = require("./lib/auth");
const R = require("./lib/rules");
const { readTable } = require("./lib/xlsx");

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC = path.join(__dirname, "public");
const LOGDIR = path.join(store.DATA, "log");

/* ══════════ 접속 기록 ══════════ */
function writeLog(entry) {
  try {
    if (!fs.existsSync(LOGDIR)) fs.mkdirSync(LOGDIR, { recursive: true });
    const day = new Date().toISOString().slice(0, 10);
    fs.appendFileSync(path.join(LOGDIR, `access-${day}.log`),
      JSON.stringify({ at: new Date().toISOString(), ...entry }) + "\n", "utf8");
  } catch { /* 기록 실패가 서비스를 멈추게 하지 않는다 */ }
}

/* ══════════ 응답 도우미 ══════════ */
const json = (res, code, body, headers = {}) => {
  const s = JSON.stringify(body);
  res.writeHead(code, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    ...headers,
  });
  res.end(s);
};
const ok = (res, body = {}, headers) => json(res, 200, { ok: true, ...body }, headers);
const err = (res, code, message) => json(res, code, { ok: false, error: message });

function readBody(req, limit = 12 * 1024 * 1024) {
  // Vercel 은 본문을 미리 읽어 req.body 에 담아 줍니다
  if (req.body !== undefined) {
    const b = req.body;
    return Promise.resolve(Buffer.isBuffer(b) ? b : Buffer.from(typeof b === "string" ? b : JSON.stringify(b)));
  }
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > limit) { reject(new Error("파일이 너무 큽니다. 12MB 이하로 올려 주세요.")); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

const cookieOf = (req, name) => {
  const raw = req.headers.cookie || "";
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
};
const setCookie = (token) =>
  `oq=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${auth.SESSION_HOURS * 3600}`;
const clearCookie = () => "oq=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0";

/* ══════════ 첫 실행 준비 ══════════ */
function bootstrapAdmin() {
  const db = store.get();
  if (!db.admins.length) {
    const { salt, hash } = auth.hashPw("1234");
    db.admins.push({ id: "admin", name: "사회사업실 담당자", salt, hash, mustChange: false });
    store.save();
    console.log("\n  담당자 계정을 만들었습니다 →  아이디 admin / 비밀번호 1234");
    console.log("  첫 로그인에서 비밀번호를 반드시 바꿔 주세요.\n");
  }
}

/* ══════════ 인증 ══════════ */
function whoami(req) {
  const p = auth.verify(cookieOf(req, "oq"));
  if (!p) return null;
  const db = store.get();
  if (p.role === "admin") {
    const a = db.admins.find((x) => x.id === p.id);
    return a ? { role: "admin", id: a.id, name: a.name, mustChange: !!a.mustChange } : null;
  }
  const e = db.employees.find((x) => String(x.empNo) === String(p.id));
  if (!e || !R.isActive(e)) return null;
  const acc = db.accounts.find((x) => String(x.empNo) === String(p.id));
  return { role: "staff", ...e, mustChange: false };
}
const needStaff = (req, res) => {
  const me = whoami(req);
  if (!me) { err(res, 401, "로그인이 필요합니다."); return null; }
  return me;
};
const needAdmin = (req, res) => {
  const me = whoami(req);
  if (!me) { err(res, 401, "로그인이 필요합니다."); return null; }
  if (me.role !== "admin") { err(res, 403, "담당자만 쓸 수 있습니다."); return null; }
  return me;
};

/* ══════════ 직원에게 내보낼 공고 (개인정보 없음) ══════════ */
function postingsFor(db, me) {
  return db.postings.filter(R.isOpen)
    .sort((a, b) => String(a.when).localeCompare(String(b.when)))
    .map((p) => ({
      id: p.id, org: p.org, name: p.name, when: p.when, deadline: p.deadline,
      type: p.type, hours: p.hours, capacity: p.capacity, deptLimit: p.deptLimit,
      seat: R.seatCount(db.apps, p.id),
      reserve: R.reserveCount(db.apps, p.id),
      myDept: R.deptCount(db.apps, p.id, me.dept),
    }));
}
function myView(db, me) {
  const mine = db.apps.filter((a) => String(a.empNo) === String(me.empNo))
    .sort((a, b) => String(b.appliedAt).localeCompare(String(a.appliedAt)))
    .map((a) => {
      const p = db.postings.find((x) => x.id === a.postId);
      return {
        id: a.id, status: a.status, appliedAt: a.appliedAt,
        org: p?.org || "삭제된 공고", name: p?.name || "-", when: p?.when || "",
      };
    });
  const takenMonths = {};
  for (const a of db.apps) {
    if (String(a.empNo) !== String(me.empNo) || !R.LIVE.includes(a.status)) continue;
    const p = db.postings.find((x) => x.id === a.postId);
    if (p) takenMonths[R.monthKey(p.when)] = { postId: p.id, name: p.name };
  }
  return {
    me: { empNo: me.empNo, name: me.name, dept: me.dept, phone: me.phone },
    postings: postingsFor(db, me),
    apps: mine,
    takenMonths,
    records: db.records.filter((r) => String(r.empNo) === String(me.empNo))
      .sort((a, b) => String(b.date).localeCompare(String(a.date))),
    summary: R.summarize(db.records, me.empNo),
    donations: db.donations.filter((d) => String(d.empNo) === String(me.empNo))
      .sort((a, b) => String(b.at).localeCompare(String(a.at))),
  };
}

/* ══════════ 라우팅 ══════════ */
const routes = {};
const on = (method, p, fn) => { routes[`${method} ${p}`] = fn; };

/* ── 로그인 ── */
on("POST", "/api/login", async (req, res) => {
  const { id, pw } = JSON.parse((await readBody(req)).toString("utf8") || "{}");
  const db = store.get();
  const key = String(id || "").trim();
  const ip = req.socket.remoteAddress;

  // 담당자
  const adm = db.admins.find((a) => a.id.toLowerCase() === key.toLowerCase());
  if (adm) {
    const left = auth.lockedFor(adm);
    if (left) return err(res, 429, `비밀번호를 여러 번 틀렸습니다. ${left}분 뒤에 다시 시도해 주세요.`);
    if (!auth.checkPw(pw, adm.salt, adm.hash)) {
      auth.noteFail(adm); store.save();
      writeLog({ event: "login_fail", role: "admin", id: key, ip });
      return err(res, 401, "비밀번호가 맞지 않습니다.");
    }
    auth.noteOk(adm); store.save();
    writeLog({ event: "login", role: "admin", id: adm.id, ip });
    return ok(res, { me: { role: "admin", id: adm.id, name: adm.name, mustChange: !!adm.mustChange } },
      { "set-cookie": setCookie(auth.makeSession("admin", adm.id)) });
  }

  // 직원 — 이름 + 비밀번호(연락처 뒷 4자리)
  const sameName = (e) => R.normName(e.name) === R.normName(key); // 공백·괄호 차이는 무시
  const cands = db.employees.filter(sameName)
    .map((e) => ({ emp: e, acc: db.accounts.find((a) => String(a.empNo) === String(e.empNo)) }))
    .filter((c) => c.acc);
  const fail = () => {
    for (const c of cands) auth.noteFail(c.acc);
    if (cands.length) store.save();
    writeLog({ event: "login_fail", role: "staff", id: key, ip });
    return err(res, 401, "이름 또는 비밀번호가 맞지 않습니다.");
  };
  if (!cands.length) return fail();
  const left = Math.min(...cands.map((c) => auth.lockedFor(c.acc) || 0));
  if (left && cands.every((c) => auth.lockedFor(c.acc)))
    return err(res, 429, `비밀번호를 여러 번 틀렸습니다. ${left}분 뒤에 다시 시도해 주세요.`);
  const hit = cands.filter((c) => !auth.lockedFor(c.acc) && auth.checkPw(pw, c.acc.salt, c.acc.hash));
  if (!hit.length) return fail();
  const live = hit.filter((c) => R.isActive(c.emp));
  if (!live.length) return err(res, 403, "퇴사 처리된 계정입니다. 사회사업실로 문의해 주세요.");
  if (live.length > 1)
    return err(res, 409, "같은 이름과 비밀번호를 가진 직원이 여러 명입니다. 사회사업실로 문의해 주세요.");
  const { emp, acc } = live[0];
  auth.noteOk(acc); store.save();
  writeLog({ event: "login", role: "staff", id: emp.empNo, ip });
  return ok(res, { me: { role: "staff", empNo: emp.empNo, name: emp.name, dept: emp.dept, phone: emp.phone, mustChange: false } },
    { "set-cookie": setCookie(auth.makeSession("staff", emp.empNo)) });
});

/* 담당자 바로 들어가기 — 사번·비밀번호 없이 (시험 단계용) */
on("POST", "/api/admin-enter", async (req, res) => {
  const adm = store.get().admins[0];
  if (!adm) return err(res, 404, "담당자 계정이 없습니다.");
  if (adm.mustChange) { adm.mustChange = false; store.save(); }
  writeLog({ event: "login", role: "admin", id: adm.id, how: "direct", ip: req.socket.remoteAddress });
  return ok(res, { me: { role: "admin", id: adm.id, name: adm.name, mustChange: false } },
    { "set-cookie": setCookie(auth.makeSession("admin", adm.id)) });
});

on("POST", "/api/logout", async (req, res) => ok(res, {}, { "set-cookie": clearCookie() }));

on("GET", "/api/me", async (req, res) => {
  const me = whoami(req);
  if (!me) return err(res, 401, "로그인이 필요합니다.");
  if (me.role === "admin") return ok(res, { me });
  return ok(res, { me: { role: "staff", ...me }, ...myView(store.get(), me) });
});

on("POST", "/api/password", async (req, res) => {
  const me = needStaff(req, res); if (!me) return;
  const { cur, next } = JSON.parse((await readBody(req)).toString("utf8") || "{}");
  const db = store.get();
  const target = me.role === "admin"
    ? db.admins.find((a) => a.id === me.id)
    : db.accounts.find((a) => String(a.empNo) === String(me.empNo));
  if (!target) return err(res, 404, "계정을 찾을 수 없습니다.");
  if (!auth.checkPw(cur, target.salt, target.hash)) return err(res, 400, "지금 비밀번호가 맞지 않습니다.");
  const np = String(next || "");
  if (np.length < 4) return err(res, 400, "새 비밀번호는 4자리 이상으로 정해 주세요.");
  if (auth.checkPw(np, target.salt, target.hash)) return err(res, 400, "지금 쓰는 비밀번호와 다르게 정해 주세요.");
  if (me.role === "staff" && np.length <= 4 && R.digits(np) === R.digits(me.phone).slice(-4))
    return err(res, 400, "연락처 뒷 4자리는 다른 사람이 쉽게 알 수 있습니다. 다른 번호로 정해 주세요.");
  Object.assign(target, auth.hashPw(np), { mustChange: false });
  store.save();
  writeLog({ event: "password_change", role: me.role, id: me.empNo || me.id });
  return ok(res);
});

/* ── 직원 ── */
on("POST", "/api/apply", async (req, res) => {
  const me = needStaff(req, res); if (!me) return;
  if (me.role !== "staff") return err(res, 403, "직원 계정으로 신청해 주세요.");
  const { postId, phone } = JSON.parse((await readBody(req)).toString("utf8") || "{}");
  const db = store.get();
  const post = db.postings.find((p) => p.id === postId);
  const d = R.decideApply(db, post, me);
  if (d.error) return err(res, 400, d.error);

  const rec = {
    id: crypto.randomUUID(), postId: post.id, empNo: me.empNo, name: me.name,
    dept: me.dept, phone: String(phone || me.phone || "").trim(),
    appliedAt: new Date().toISOString(), status: d.status,
  };
  db.apps.push(rec);
  if (R.digits(rec.phone).length >= 9 && R.digits(rec.phone) !== R.digits(me.phone)) {
    const e = db.employees.find((x) => String(x.empNo) === String(me.empNo));
    if (e) e.phone = rec.phone;
  }
  store.save();
  writeLog({ event: "apply", id: me.empNo, postId: post.id, status: d.status });
  return ok(res, { status: d.status, order: d.order, message: d.message, ...myView(db, me) });
});

on("POST", "/api/donate", async (req, res) => {
  const me = needStaff(req, res); if (!me) return;
  if (me.role !== "staff") return err(res, 403, "직원 계정으로 등록해 주세요.");
  const { item } = JSON.parse((await readBody(req)).toString("utf8") || "{}");
  if (!String(item || "").trim()) return err(res, 400, "후원물품을 적어 주세요.");
  const db = store.get();
  db.donations.push({
    id: crypto.randomUUID(), empNo: me.empNo, name: me.name, dept: me.dept,
    phone: me.phone || "", item: String(item).trim(), at: new Date().toISOString(),
  });
  store.save();
  writeLog({ event: "donate", id: me.empNo });
  return ok(res, myView(db, me));
});

/* ── 담당자 ── */
on("GET", "/api/admin/all", async (req, res) => {
  const me = needAdmin(req, res); if (!me) return;
  const db = store.get();
  return ok(res, {
    employees: db.employees,
    accounts: db.accounts.map((a) => ({
      empNo: a.empNo, mustChange: !!a.mustChange, lastLogin: a.lastLogin || null,
      locked: auth.lockedFor(a) > 0,
    })),
    records: db.records,
    postings: db.postings,
    apps: db.apps,
    donations: db.donations,
    scores: R.scoreMap(db.records),
    deptCheck: R.deptCheck(db.employees.filter(R.isActive)),
    admins: db.admins.map((a) => ({ id: a.id, name: a.name })),
  });
});

on("POST", "/api/admin/posting", async (req, res) => {
  const me = needAdmin(req, res); if (!me) return;
  const body = JSON.parse((await readBody(req)).toString("utf8") || "{}");
  const db = store.get();
  const { action } = body;

  if (action === "create") {
    const rows = Array.isArray(body.rows) ? body.rows : [];
    for (const r of rows) {
      if (!String(r.org || "").trim() || !String(r.name || "").trim() || !r.when || !r.deadline)
        return err(res, 400, "기관·자원봉사명·일시·모집 마감일을 모두 입력해 주세요.");
      if (R.deadlineEnd(r.deadline) > new Date(r.when))
        return err(res, 400, "모집 마감일이 봉사 일시보다 늦습니다.");
    }
    for (const r of rows) {
      db.postings.push({
        id: crypto.randomUUID(), org: String(r.org).trim(), name: String(r.name).trim(),
        when: r.when, deadline: r.deadline, type: r.type === "내부" ? "내부" : "외부",
        hours: Number(r.hours) || 0, capacity: Number(r.capacity) || 0,
        deptLimit: Number(r.deptLimit) || 3, closed: false, createdAt: new Date().toISOString(),
      });
    }
    store.save();
    writeLog({ event: "posting_create", id: me.id, count: rows.length });
    return ok(res, { count: rows.length });
  }

  const p = db.postings.find((x) => x.id === body.id);
  if (!p) return err(res, 404, "공고를 찾을 수 없습니다.");

  if (action === "update") {
    const r = body.row || {};
    if (!String(r.org || "").trim() || !String(r.name || "").trim() || !r.when || !r.deadline)
      return err(res, 400, "기관·자원봉사명·일시·모집 마감일을 모두 입력해 주세요.");
    if (R.deadlineEnd(r.deadline) > new Date(r.when))
      return err(res, 400, "모집 마감일이 봉사 일시보다 늦습니다.");
    Object.assign(p, {
      org: String(r.org).trim(), name: String(r.name).trim(), when: r.when, deadline: r.deadline,
      type: r.type === "내부" ? "내부" : "외부", hours: Number(r.hours) || 0,
      capacity: Number(r.capacity) || 0, deptLimit: Number(r.deptLimit) || 3,
    });
  } else if (action === "toggle") {
    p.closed = !p.closed;
  } else if (action === "delete") {
    db.postings = db.postings.filter((x) => x.id !== p.id);
    db.apps = db.apps.filter((a) => a.postId !== p.id);
  } else return err(res, 400, "알 수 없는 요청입니다.");

  store.save();
  writeLog({ event: `posting_${action}`, id: me.id, postId: body.id });
  return ok(res);
});

on("POST", "/api/admin/app-status", async (req, res) => {
  const me = needAdmin(req, res); if (!me) return;
  const { ids, status } = JSON.parse((await readBody(req)).toString("utf8") || "{}");
  if (!["pending", "approved", "reserve", "excluded", "rejected"].includes(status))
    return err(res, 400, "알 수 없는 상태입니다.");
  const db = store.get();
  const set = new Set((Array.isArray(ids) ? ids : [ids]).map(String));
  let n = 0;
  for (const a of db.apps) {
    if (!set.has(String(a.id))) continue;
    a.status = status; a.decidedAt = new Date().toISOString(); a.decidedBy = me.id; n++;
  }
  store.save();
  writeLog({ event: "app_status", id: me.id, count: n, status });
  return ok(res, { count: n });
});

on("POST", "/api/admin/employee", async (req, res) => {
  const me = needAdmin(req, res); if (!me) return;
  const body = JSON.parse((await readBody(req)).toString("utf8") || "{}");
  const db = store.get();
  const { action } = body;

  if (action === "create") {
    const { empNo, name, dept, phone } = body;
    if (!String(name || "").trim() || !String(dept || "").trim() || R.digits(phone).length < 9)
      return err(res, 400, "이름·부서·연락처를 모두 입력해 주세요.");
    const no = String(empNo || "").trim() || R.autoEmpNo(name, phone); // 사번을 모르면 자동으로 붙임
    // 같은 사람이 두 줄로 생기지 않게 — 이름·연락처가 같으면 막고, 이름만 같으면 확인을 받는다
    const probe = { empNo: no, name, phone };
    const dupSure = db.employees.find((e) => R.isSure(probe, e));
    if (dupSure) return err(res, 400, `이미 같은 직원이 있습니다 — ${dupSure.name} · ${dupSure.dept || "부서없음"} · ${dupSure.phone}. 정보를 고치려면 목록에서 [수정]을 눌러 주세요.`);
    const dupName = db.employees.filter((e) => R.normName(e.name) === R.normName(name));
    if (dupName.length && !body.force)
      return json(res, 409, { ok: false, needConfirm: true,
        error: `같은 이름의 직원이 이미 있습니다 — ${dupName.map((e) => `${e.name} · ${e.dept || "부서없음"} · ${e.phone}`).join(" / ")}. 다른 사람이면 계속 추가하세요.` });
    if (db.employees.some((e) => String(e.empNo) === no))
      return err(res, 400, "이미 있는 직원입니다. (사번 또는 이름·연락처가 같음)");
    db.employees.push({ empNo: no, name: String(name).trim(), dept: String(dept).trim(),
      phone: String(phone).trim(), status: "active", updatedAt: new Date().toISOString() });
    const pw = auth.pwFromPhone(phone);
    db.accounts.push({ empNo: no, ...auth.hashPw(pw), mustChange: false });
    store.save();
    writeLog({ event: "employee_create", id: me.id, target: no });
    return ok(res, { empNo: no, pw });
  }

  const e = db.employees.find((x) => String(x.empNo) === String(body.empNo));
  if (!e) return err(res, 404, "직원을 찾을 수 없습니다.");

  if (action === "update") {
    const { name, dept, phone } = body;
    if (!String(name || "").trim()) return err(res, 400, "이름을 입력해 주세요.");
    if (!String(dept || "").trim()) return err(res, 400, "부서를 입력해 주세요.");
    if (R.digits(phone).length < 9) return err(res, 400, "연락처를 정확히 입력해 주세요.");
    const clash = db.employees.find((x) => x !== e && R.isSure({ empNo: "", name, phone }, x));
    if (clash) return err(res, 400, `같은 이름·연락처의 직원이 이미 있습니다 — ${clash.name} · ${clash.dept || "부서없음"}. 중복을 합치려면 [중복 직원 찾기]를 이용해 주세요.`);
    Object.assign(e, { name: String(name).trim(), dept: String(dept).trim(),
      phone: String(phone).trim(), updatedAt: new Date().toISOString() });
  } else if (action === "retire" || action === "restore") {
    e.status = action === "retire" ? "retired" : "active";
    e.updatedAt = new Date().toISOString();
  } else if (action === "delete") {
    db.employees = db.employees.filter((x) => String(x.empNo) !== String(e.empNo));
    db.accounts = db.accounts.filter((x) => String(x.empNo) !== String(e.empNo));
  } else if (action === "resetPw") {
    const pw = auth.pwFromPhone(e.phone);
    const acc = db.accounts.find((a) => String(a.empNo) === String(e.empNo));
    if (acc) Object.assign(acc, auth.hashPw(pw), { mustChange: false, failCount: 0, lockedUntil: 0 });
    else db.accounts.push({ empNo: e.empNo, ...auth.hashPw(pw), mustChange: false });
    store.save();
    writeLog({ event: "reset_pw", id: me.id, target: e.empNo });
    return ok(res, { pw });
  } else return err(res, 400, "알 수 없는 요청입니다.");

  store.save();
  writeLog({ event: `employee_${action}`, id: me.id, target: body.empNo });
  return ok(res);
});

/* 엑셀 올리기 — 미리보기와 반영을 나눠서 처리 */
/* 이미 들어 있는 명단의 중복 찾기 */
on("GET", "/api/admin/employee-dups", async (req, res) => {
  const me = needAdmin(req, res); if (!me) return;
  const db = store.get();
  const cnt = (list) => { const m = new Map(); for (const x of list) m.set(String(x.empNo), (m.get(String(x.empNo)) || 0) + 1); return m; };
  const rc = cnt(db.records), ac = cnt(db.apps);
  const acc = new Map(db.accounts.map((a) => [String(a.empNo), a]));
  const groups = R.findDupGroups(db.employees).map((g) => ({
    level: g.level,
    members: g.members.map((e) => ({
      empNo: e.empNo, name: e.name, dept: e.dept, phone: e.phone, status: e.status || "active",
      auto: R.isAutoNo(e), records: rc.get(String(e.empNo)) || 0, apps: ac.get(String(e.empNo)) || 0,
      account: acc.has(String(e.empNo)), lastLogin: (acc.get(String(e.empNo)) || {}).lastLogin || null,
    })),
  }));
  return ok(res, { groups });
});

/* 같은 사람 한 명으로 합치기 — 남길 직원 하나에 나머지를 합친다 */
on("POST", "/api/admin/employee-merge", async (req, res) => {
  const me = needAdmin(req, res); if (!me) return;
  const { keep, merge, values } = JSON.parse((await readBody(req)).toString("utf8") || "{}");
  const db = store.get();
  const byNo = new Map(db.employees.map((e) => [String(e.empNo), e]));
  const K = byNo.get(String(keep));
  const M = (Array.isArray(merge) ? merge : []).map((n) => byNo.get(String(n))).filter(Boolean);
  if (!K || !M.length || M.includes(K)) return err(res, 400, "남길 직원과 합칠 직원을 다시 골라 주세요.");
  const v = values || {};
  await store.snapshot("before-merge");

  const now = new Date().toISOString();
  const realNo = [K, ...M].find((e) => !R.isAutoNo(e));       // 진짜 사번이 있으면 그것을 씀
  for (const f of ["name", "dept", "phone"]) {
    const all = [K, ...M].map((e) => String(e[f] ?? "").trim()).filter(Boolean);
    const distinct = [...new Set(all)];
    if (distinct.length > 1 && !distinct.includes(String(v[f] ?? "").trim()))
      return err(res, 400, `${{ name: "이름", dept: "부서", phone: "연락처" }[f]}을(를) 어느 값으로 할지 골라 주세요.`);
    K[f] = distinct.length > 1 ? String(v[f]).trim() : (distinct[0] || "");
  }
  const keepAcc = db.accounts.find((a) => String(a.empNo) === String(K.empNo));
  for (const m of M) {
    const mAcc = db.accounts.find((a) => String(a.empNo) === String(m.empNo));
    if (mAcc && !keepAcc) mAcc.empNo = String(K.empNo);           // 계정이 없던 쪽이면 이어받음
    else if (mAcc) db.accounts = db.accounts.filter((a) => a !== mAcc);
    for (const list of [db.records, db.apps, db.donations])
      for (const x of list) if (String(x.empNo) === String(m.empNo)) { x.empNo = String(K.empNo); }
    if (R.isActive(m)) K.status = "active";
    db.employees = db.employees.filter((e) => e !== m);
  }
  if (realNo && realNo !== K) renameEmp(db, K.empNo, realNo.empNo); // 이미 사라진 쪽의 번호이므로 충돌 없음
  K.updatedAt = now;
  store.save();
  writeLog({ event: "employee_merge", id: me.id, keep: K.empNo, merged: M.map((m) => m.empNo) });
  return ok(res, { empNo: K.empNo, merged: M.length });
});

on("POST", "/api/admin/upload", async (req, res) => {
  const me = needAdmin(req, res); if (!me) return;
  const kind = new URL(req.url, "http://x").searchParams.get("kind");
  const filename = decodeURIComponent(req.headers["x-filename"] || "upload.xlsx");
  let rows;
  try {
    rows = readTable(await readBody(req), filename);
  } catch (e) { return err(res, 400, `읽지 못했습니다. ${e.message}`); }

  const db = store.get();
  try {
    if (kind === "employees") {
      const { list, dupCount } = R.parseEmployees(rows);
      if (!list.length) return err(res, 400, "읽을 수 있는 직원이 없습니다.");
      const { diff, review } = R.reviewEmployees(db.employees, list);
      return ok(res, {
        preview: true, filename, count: list.length, dupCount,
        diff, review,
        check: R.deptCheck(list),
        list,
      });
    }
    if (kind === "records") {
      const list = R.parseRecords(rows);
      // 사번 칸이 비어 있으면 이름으로 직원을 찾아 맞춘다 (같은 이름이 둘 이상이면 맞추지 않음)
      const byName = new Map();
      for (const e of db.employees) {
        const k = String(e.name).replace(/\s/g, "");
        byName.set(k, byName.has(k) ? null : e);
      }
      for (const r of list) if (!r.empNo) r.empNo = byName.get(String(r.name).replace(/\s/g, ""))?.empNo || "";
      const known = new Set(db.employees.map((e) => String(e.empNo)));
      await store.snapshot("before-records"); // 통째로 교체하기 전에 한 벌 남김
      db.records = list;
      const mg = migrate();
      store.save();
      writeLog({ event: "upload_records", id: me.id, count: list.length, assigned: mg.assigned });
      const nowKnown = new Set(db.employees.map((e) => String(e.empNo)));
      return ok(res, { count: list.length, orphan: list.filter((r) => !nowKnown.has(r.empNo)).length,
        assigned: mg.assigned, mergedNos: mg.merged, ambiguous: mg.ambiguous });
    }
    return err(res, 400, "알 수 없는 자료 종류입니다.");
  } catch (e) { return err(res, 400, e.message); }
});

/* 사번을 바꿀 때 봉사 내역·신청·후원·계정의 사번도 함께 바꿔서 기록이 끊기지 않게 한다 */
function renameEmp(db, oldNo, newNo) {
  const o = String(oldNo), n = String(newNo);
  if (o === n) return true;
  if (db.employees.some((e) => String(e.empNo) === n)) return false;
  for (const list of [db.employees, db.accounts, db.records, db.apps, db.donations])
    for (const x of list) if (String(x.empNo) === o) x.empNo = n;
  return true;
}

/* 미리보기에서 확인한 내용을 실제로 반영 — 중복 확인·값 충돌 선택까지 받아서 합친다 */
on("POST", "/api/admin/apply-employees", async (req, res) => {
  const me = needAdmin(req, res); if (!me) return;
  const { list, retire, makeAcc, res: dec } = JSON.parse((await readBody(req)).toString("utf8") || "{}");
  if (!Array.isArray(list) || !list.length) return err(res, 400, "반영할 자료가 없습니다.");
  const same = (dec && dec.same) || {}, pick = (dec && dec.pick) || {};
  const db = store.get();
  const { rows } = R.planEmployees(db.employees, list);

  // 1) 확인이 빠진 곳이 없는지 먼저 검사 (아무것도 바꾸기 전에)
  for (const r of rows) {
    if (!r.sure && r.suspects.length && same[r.key] === undefined)
      return err(res, 400, `중복 확인이 끝나지 않았습니다. (${r.inc.name})`);
  }
  await store.snapshot("before-employees"); // 되돌릴 수 있게 한 벌 남김

  const byNo = new Map(db.employees.map((e) => [String(e.empNo), e]));
  const final = new Map();           // 올린 줄의 사번 → 최종 직원
  const matched = new Set();
  const added = [];
  let merged = 0, changed = 0;
  const now = new Date().toISOString();
  const backup = JSON.stringify(db);  // 중간에 막히면 되돌리기 위한 사본

  try {
    for (const r of rows) {
      let target = r.sure || null;
      if (!target && r.suspects.length && same[r.key]) {
        const ref = String(same[r.key]);
        const c = r.suspects.find((x) => x.ref === ref);
        if (!c) throw new Error(`잘못된 선택입니다. (${r.inc.name})`);
        target = ref.startsWith("e:") ? byNo.get(ref.slice(2)) : final.get(ref.slice(2));
      }
      if (!target) {
        const e = { ...r.inc, status: "active", updatedAt: now };
        byNo.set(String(e.empNo), e); db.employees.push(e); final.set(r.key, e); added.push(e);
        continue;
      }
      // 같은 사람으로 합치기 — 값이 다른 칸은 담당자가 고른 대로
      const picks = pick[r.key] || {};
      let touched = false;
      for (const c of R.fieldConflicts(target, r.inc)) {
        if (picks[c.k] !== "old" && picks[c.k] !== "new")
          throw new Error(`값이 다른 항목의 확인이 끝나지 않았습니다. (${r.inc.name} · ${c.label})`);
        if (picks[c.k] === "new") {
          if (c.k === "empNo") {
            const before = String(target.empNo);
            if (!renameEmp(db, before, r.inc.empNo)) throw new Error(`이미 쓰는 사번입니다. (${r.inc.empNo})`);
            byNo.delete(before); byNo.set(String(target.empNo), target);
          } else target[c.k] = r.inc[c.k];
          touched = true;
        }
      }
      for (const [k] of R.FIELDS) { // 비어 있던 칸은 새 값으로 채움
        if (k === "empNo") continue;
        if (!String(target[k] ?? "").trim() && String(r.inc[k] ?? "").trim()) { target[k] = r.inc[k]; touched = true; }
      }
      // 기존이 자동 번호이고 새 파일에 진짜 사번이 있으면 진짜 사번을 쓴다
      if (R.isAutoNo(target) && !R.isAutoNo(r.inc) && String(target.empNo) !== String(r.inc.empNo)) {
        const before = String(target.empNo);
        if (renameEmp(db, before, r.inc.empNo)) { byNo.delete(before); byNo.set(String(target.empNo), target); touched = true; }
      }
      if (!R.isActive(target)) touched = true;
      target.status = "active"; target.updatedAt = now;
      matched.add(String(target.empNo)); final.set(r.key, target); merged++; if (touched) changed++;
    }
  } catch (e) {
    db.employees = JSON.parse(backup).employees; // 아무것도 바뀌지 않게 되돌림
    for (const k of ["accounts", "records", "apps", "donations"]) db[k] = JSON.parse(backup)[k];
    return err(res, 400, e.message);
  }

  let retired = 0;
  if (retire) for (const e of db.employees) {
    if (!matched.has(String(e.empNo)) && !added.includes(e) && R.isActive(e)) { e.status = "retired"; e.updatedAt = now; retired++; }
  }

  const issued = [];
  if (makeAcc) {
    const have = new Set(db.accounts.map((a) => String(a.empNo)));
    for (const e of added) {
      if (have.has(String(e.empNo))) continue;
      const pw = auth.pwFromPhone(e.phone);
      db.accounts.push({ empNo: String(e.empNo), ...auth.hashPw(pw), mustChange: false });
      issued.push({ empNo: e.empNo, name: e.name, dept: e.dept, pw });
    }
  }
  const mg = migrate(); // 봉사 내역에 적힌 사번을 새 명단의 직원에게 가져옴
  store.save();
  writeLog({ event: "apply_employees", id: me.id, added: added.length, merged, changed, retired, assigned: mg.assigned });
  return ok(res, { added: added.length, merged, changed, retired, back: 0, issued, assigned: mg.assigned });
});

on("POST", "/api/admin/donation-delete", async (req, res) => {
  const me = needAdmin(req, res); if (!me) return;
  const { id } = JSON.parse((await readBody(req)).toString("utf8") || "{}");
  const db = store.get();
  db.donations = db.donations.filter((d) => d.id !== id);
  store.save();
  writeLog({ event: "donation_delete", id: me.id, target: id });
  return ok(res);
});

/* ══════════ 정적 파일 ══════════ */
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml",
  ".ico": "image/x-icon", ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8", ".json": "application/json; charset=utf-8",
};
function serveStatic(req, res, pathname) {
  let rel = pathname === "/" ? "/index.html" : pathname;
  rel = rel.replace(/\.\./g, "");
  const file = path.join(PUBLIC, rel);
  if (!file.startsWith(PUBLIC) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    return res.end("찾을 수 없는 주소입니다.");
  }
  res.writeHead(200, {
    "content-type": MIME[path.extname(file)] || "application/octet-stream",
    // 글꼴은 바뀌지 않으므로 오래 보관하게 해서 매번 다시 받지 않게 한다
    "cache-control": file.endsWith(".woff2") ? "public, max-age=31536000, immutable" : "no-cache",
    "x-content-type-options": "nosniff",
  });
  fs.createReadStream(file).pipe(res);
}

/* ══════════ 서버 ══════════ */
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://x");
  const key = `${req.method} ${u.pathname}`;
  try {
    if (routes[key]) return await routes[key](req, res);
    if (u.pathname.startsWith("/api/")) return err(res, 404, "없는 기능입니다.");
    if (req.method === "GET") return serveStatic(req, res, u.pathname);
    return err(res, 405, "허용되지 않는 방식입니다.");
  } catch (e) {
    console.error("[오류]", key, e);
    if (!res.headersSent) err(res, 500, e.message || "서버에서 오류가 났습니다.");
  }
});

function localIPs() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const n of list || []) if (n.family === "IPv4" && !n.internal) out.push(n.address);
  }
  return out;
}

if (require.main === module) {
  store.load();
  bootstrapAdmin();
  migrate();
  store.backup();
  setInterval(() => store.backup(), 6 * 3600 * 1000);

  server.listen(PORT, "0.0.0.0", () => {
    const db = store.get();
    console.log("\n═══════════════════════════════════════════════");
    console.log("  사회사업실 원스탑 서비스 — 켜졌습니다");
    console.log("═══════════════════════════════════════════════");
    console.log("  이 PC에서      http://localhost:" + PORT);
    for (const ip of localIPs()) console.log("  다른 기기에서   http://" + ip + ":" + PORT);
    console.log("───────────────────────────────────────────────");
    console.log(`  직원 ${db.employees.length}명 · 공고 ${db.postings.length}건 · 신청 ${db.apps.length}건`);
    console.log("  끄려면 이 창에서 Ctrl + C 를 누르세요.");
    console.log("═══════════════════════════════════════════════\n");
  });
}

/** 직원 명단에 사번이 없으면, 봉사 내역 파일에 있는 사번을 가져와 그 직원의 사번으로 삼는다.
    · 이름이 같은 내역의 사번이 딱 하나이고, 직원도 그 이름으로 한 명뿐일 때만 자동으로 정한다.
    · 동명이인처럼 갈리는 경우는 건드리지 않고 알려 준다(ambiguous).
    · 내역의 사번은 절대 바꾸지 않는다. 바뀌는 것은 직원 쪽 번호뿐이다. */
const isAutoStr = (no) => /\D-\d+$/.test(String(no ?? ""));
function migrate() {
  const db = store.get();
  let cleaned = 0, assigned = 0, merged = 0;
  const ambiguous = [];
  for (const r of db.records) {            // "218790 김미영--QPS실장-[]" → "218790"
    const c = R.cleanEmpNo(r.empNo);
    if (c !== r.empNo) { r.empNo = c; cleaned++; }
  }
  const taken = new Set(db.employees.map((e) => String(e.empNo)));
  const nums = new Map();                  // 이름 → 내역에 적힌 사번들
  const byPhone = new Map();               // 전화번호(숫자) → { 사번 → 그 사번 내역에 적힌 이름들 }
  for (const r of db.records) {
    const no = String(r.empNo || ""), k = R.normName(r.name);
    if (!no || isAutoStr(no) || !k) continue;
    if (!nums.has(k)) nums.set(k, new Set());
    nums.get(k).add(no);
    const ph = R.digits(r.phone);
    if (ph.length >= 9) {
      if (!byPhone.has(ph)) byPhone.set(ph, new Map());
      const m = byPhone.get(ph);
      if (!m.has(no)) m.set(no, { names: new Set(), last: "" });
      const x = m.get(no);
      x.names.add(k);
      if (String(r.date || "") > x.last) x.last = String(r.date || "");
    }
  }
  const autos = new Map();                 // 이름 → 사번 없는 직원들
  for (const e of db.employees) {
    if (!isAutoStr(e.empNo)) continue;
    const k = R.normName(e.name);
    if (!autos.has(k)) autos.set(k, []);
    autos.get(k).push(e);
  }
  // 1) 전화번호가 같고 이름도 같으면 같은 사람 — 동명이인도 여기서 구분됨.
  //    한 사람에게 사번이 여러 개(재입사 등)면 가장 최근 내역의 사번을 쓰고, 이전 사번의 내역도 그 사번으로 모은다.
  for (const list of autos.values()) {
    for (const e of [...list]) {
      const ph = R.digits(e.phone), m = byPhone.get(ph); if (!m) continue;
      const k = R.normName(e.name);
      const cand = [...m].filter(([no, x]) => x.names.has(k) && !taken.has(no))
        .sort((p, q) => String(q[1].last).localeCompare(String(p[1].last)));
      if (!cand.length) continue;
      const pick = cand[0][0], older = cand.slice(1).map(([no]) => no);
      if (!renameEmp(db, e.empNo, pick)) continue;
      for (const r of db.records)
        if (older.includes(String(r.empNo)) && R.digits(r.phone) === ph && R.normName(r.name) === k) r.empNo = pick;
      taken.add(pick); assigned++; if (older.length) merged += older.length; list.splice(list.indexOf(e), 1);
    }
  }
  // 2) 전화번호로 못 정한 직원은 이름이 하나뿐일 때만
  for (const [k, list] of autos) {
    if (!list.length) continue;
    const cand = [...(nums.get(k) || [])].filter((no) => !taken.has(no));
    if (!cand.length) continue;
    if (list.length === 1 && cand.length === 1) {
      if (renameEmp(db, list[0].empNo, cand[0])) { taken.add(cand[0]); assigned++; }
    } else ambiguous.push({ name: list[0].name, employees: list.length, numbers: cand });
  }
  if (cleaned || assigned) {
    store.save();
    console.log(`[정리] 내역 사번 ${cleaned}건 정리 · 직원 사번 ${assigned}명을 내역에서 가져옴`);
  }
  return { cleaned, assigned, merged, ambiguous };
}

let ready = false;
/** Vercel 함수 진입점 (api/index.js 가 부름) */
async function handler(req, res) {
  try {
    if (store.REMOTE) await store.pull(); // 요청마다 최신 자료를 불러옴
    else if (!ready) { store.load(); ready = true; }
    bootstrapAdmin();
    migrate();
    if (store.REMOTE) { // 응답을 내보내기 직전에 바뀐 자료를 저장
      const end = res.end.bind(res);
      res.end = (...a) => { store.flush().catch((e) => console.error("[저장 실패]", e)).finally(() => end(...a)); return res; };
    }
  } catch (e) {
    console.error("[시작 실패]", e);
    res.statusCode = 500; res.setHeader("content-type", "application/json; charset=utf-8");
    return res.end(JSON.stringify({ ok: false, error: "자료 저장소에 연결하지 못했습니다." }));
  }
  return server.emit("request", req, res);
}

module.exports = { server, routes, handler };

"use strict";
/* 업무 규칙 — 반드시 서버에서 판정합니다.
   화면에서 막는 것은 안내일 뿐이고, 실제 접수 가부는 여기서 결정합니다. */

const ANNUAL_DUTY = 1;        // 연간 의무 점수
const RESERVE_LIMIT = 2;      // 정원 외 예비 인원
const POINT_PER_CASE = 10000; // 휴무·off·근무시간 외 봉사 1건당

const MSG_DEPT_FULL = "죄송합니다. 부서(병동)별 할당 인원이 초과되었습니다. 다음기회에 접수바랍니다.";
const MSG_CLOSED = "정원과 예비 인원이 모두 찼습니다. 다음 기회에 접수 바랍니다.";

const digits = (v) => String(v ?? "").replace(/\D/g, "");
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const isActive = (e) => (e?.status || "active") !== "retired";

/** 점수 — 인정횟수가 있으면 그 값이 곧 점수, 없으면 시간으로 환산 */
function scoreOf(r) {
  const c = Number(r.count);
  if (!Number.isNaN(c) && r.count !== "" && r.count !== null && r.count !== undefined) return c;
  const h = Number(r.hours) || 0;
  return String(r.type).includes("내부") ? (h / 2) * 0.5 : h / 4;
}

const monthKey = (when) => String(when || "").slice(0, 7);
const monthLabel = (when) => {
  const m = monthKey(when);
  return m ? `${Number(m.slice(5, 7))}월` : "";
};

function deadlineEnd(d) {
  if (!d) return null;
  const t = new Date(`${d}T23:59:59`);
  return isNaN(t) ? null : t;
}
const deadlinePassed = (d) => {
  const t = deadlineEnd(d);
  return !!t && t < new Date();
};
const isDone = (p) => !!p.closed || (!!p.when && new Date(p.when) < new Date());
const isOpen = (p) => !p.closed && !deadlinePassed(p.deadline) && (!p.when || new Date(p.when) >= new Date());

/* ── 집계 : 정원은 대기+승인, 부서는 예비까지 포함 ── */
const LIVE = ["pending", "approved", "reserve"];
const seatCount = (apps, pid) =>
  apps.filter((a) => a.postId === pid && ["pending", "approved"].includes(a.status)).length;
const reserveCount = (apps, pid) =>
  apps.filter((a) => a.postId === pid && a.status === "reserve").length;
const deptCount = (apps, pid, dept) =>
  apps.filter((a) => a.postId === pid && LIVE.includes(a.status) && a.dept === dept).length;

/* ── 부서(병동)별 제한 — 두 가지를 함께 쓸 수 있습니다(복수 선택) ──
   건별 : 이 공고에서 같은 부서가 최대 N명        — post.deptLimit      (0 = 쓰지 않음, 비어 있으면 옛 공고라 3)
   월별 : 봉사일이 속한 달의 모든 공고를 합쳐 N명 — post.deptMonthLimit (0·없음 = 쓰지 않음)
   둘 다 켜 두면 둘 다 지켜야 접수됩니다. 초과 안내 문구는 같습니다(MSG_DEPT_FULL). */
const perLimit = (p) => (p.deptLimit === 0 || p.deptLimit === "0" ? 0 : Number(p.deptLimit) || 3);
const monthLimit = (p) => Number(p.deptMonthLimit) || 0;
/** 화면에서 받은 한도 값을 저장용으로: 0·false = 쓰지 않음, 비어 있으면 기본값 */
const limitIn = (v, def) => (v === 0 || v === "0" || v === false ? 0 : Number(v) || def);
/** 같은 달(봉사일 기준)의 모든 공고에서 이 부서가 잡은 인원. 예비도 셉니다(deptCount 와 같은 이유) */
const deptMonthCount = (db, post, dept) => {
  const mk = monthKey(post.when);
  const ids = new Set(db.postings.filter((p) => monthKey(p.when) === mk).map((p) => p.id));
  return db.apps.filter((a) => ids.has(a.postId) && LIVE.includes(a.status) && a.dept === dept).length;
};

/**
 * 접수 판정. 거절이면 {error}, 접수면 {status, order}
 */
function decideApply(db, post, emp) {
  if (!post) return { error: "해당 자원봉사를 찾을 수 없습니다." };
  if (post.closed) return { error: "모집이 마감된 자원봉사입니다." };
  if (deadlinePassed(post.deadline)) return { error: "모집 마감일이 지났습니다." };
  if (post.when && new Date(post.when) < new Date()) return { error: "이미 지난 자원봉사입니다." };

  // 같은 공고에 이미 신청했는가
  const dup = db.apps.find((a) => a.postId === post.id
    && String(a.empNo) === String(emp.empNo) && LIVE.includes(a.status));
  if (dup) return { error: "이미 신청하신 자원봉사입니다." };

  // 1인 1건 — 봉사를 실시하는 달 기준
  const mk = monthKey(post.when);
  for (const a of db.apps) {
    if (String(a.empNo) !== String(emp.empNo) || !LIVE.includes(a.status)) continue;
    const p = db.postings.find((x) => x.id === a.postId);
    if (p && monthKey(p.when) === mk) {
      return { error: `${monthLabel(post.when)}에는 이미 신청한 자원봉사가 있습니다(${p.name}). 한 달에 한 건만 신청할 수 있습니다.` };
    }
  }

  const seat = seatCount(db.apps, post.id);
  const res = reserveCount(db.apps, post.id);
  const dn = deptCount(db.apps, post.id, emp.dept);
  const per = perLimit(post), mon = monthLimit(post);
  const deptOver = (per > 0 && dn >= per) || (mon > 0 && deptMonthCount(db, post, emp.dept) >= mon);
  const full = seat >= Number(post.capacity || 0);

  if (deptOver) return { status: "excluded", order: 0, message: MSG_DEPT_FULL };
  if (full && res >= RESERVE_LIMIT) return { error: MSG_CLOSED };
  if (full) return { status: "reserve", order: res + 1 };
  return { status: "pending", order: seat + 1 };
}

/** 한 사람의 실적 요약 */
function summarize(records, empNo) {
  const mine = records.filter((r) => String(r.empNo) === String(empNo));
  const year = new Date().getFullYear();
  const ty = mine.filter((r) => String(r.date).startsWith(String(year)));
  const sum = (arr, f) => arr.reduce((a, r) => a + (Number(f(r)) || 0), 0);
  const sc = (arr) => arr.reduce((a, r) => a + scoreOf(r), 0);
  return {
    year,
    cases: mine.length,
    totalHours: round2(sum(mine, (r) => r.hours)),
    yearHours: round2(sum(ty, (r) => r.hours)),
    yearScore: round2(sc(ty)),
    totalScore: round2(sc(mine)),
    totalPoints: sum(mine, (r) => r.points),
    requested: mine.filter((r) => String(r.pointStatus).startsWith("신청")).length,
  };
}

/** 사번별 올해/누적 점수 */
function scoreMap(records) {
  const m = {};
  const y = String(new Date().getFullYear());
  for (const r of records) {
    const k = String(r.empNo);
    if (!m[k]) m[k] = { year: 0, total: 0 };
    const s = scoreOf(r);
    m[k].total += s;
    if (String(r.date).startsWith(y)) m[k].year += s;
  }
  for (const k of Object.keys(m)) { m[k].year = round2(m[k].year); m[k].total = round2(m[k].total); }
  return m;
}

/* ── 부서 표기 점검 ── */
function wardNo(dept) {
  const m = String(dept || "").match(/(\d+)\s*(?:병동|[Ww])?\s*$/);
  return m ? String(Number(m[1])) : null;
}
function deptCheck(list) {
  const seen = new Map(), noName = new Set();
  for (const e of list) {
    const d = String(e.dept || "").trim();
    if (!d) continue;
    if (/^\d+\s*(병동|[Ww])?$/.test(d)) noName.add(d);
    const w = wardNo(d);
    if (!w) continue;
    if (!seen.has(w)) seen.set(w, new Set());
    seen.get(w).add(d);
  }
  const mixed = [];
  for (const [ward, set] of seen) if (set.size > 1) mixed.push({ ward, forms: [...set] });
  return { mixed: mixed.sort((a, b) => Number(a.ward) - Number(b.ward)), noName: [...noName] };
}

/** 업로드 파일과 현재 명단 비교 */
function buildDiff(current, incoming) {
  const cur = new Map(current.map((e) => [String(e.empNo), e]));
  const inc = new Map(incoming.map((e) => [String(e.empNo), e]));
  const added = [], changed = [], same = [], missing = [], back = [];
  for (const [no, e] of inc) {
    const old = cur.get(no);
    if (!old) { added.push(e); continue; }
    const fields = [];
    if ((old.name || "") !== (e.name || "")) fields.push(["이름", old.name, e.name]);
    if ((old.dept || "") !== (e.dept || "")) fields.push(["부서", old.dept, e.dept]);
    if (digits(old.phone) !== digits(e.phone)) fields.push(["연락처", old.phone, e.phone]);
    if (!isActive(old)) back.push({ ...e, old });
    if (fields.length) changed.push({ ...e, old, fields });
    else if (isActive(old)) same.push(e);
  }
  for (const [no, e] of cur) if (!inc.has(no) && isActive(e)) missing.push(e);
  return { added, changed, same, missing, back };
}

/** 봉사 내역 엑셀의 사번 칸은 "218790 김미영--QPS실장-[]" 처럼 이름·직책이 붙어 올 수 있어, 맨 앞 숫자만 사번으로 씁니다 */
const cleanEmpNo = (v) => {
  const s = String(v ?? "").trim();
  const m = s.match(/^(\d{3,})(?=\D|$)/);
  return m ? m[1] : s;
};

/** 사번을 모를 때 쓰는 내부 번호 — 같은 사람이면 항상 같은 값이라 명단을 다시 올려도 겹치지 않는다 */
const autoEmpNo = (name, phone) =>
  `${String(name).replace(/\s/g, "")}-${digits(phone).slice(-8)}`;


/* ══════════ 직원 명단 합치기 (중복 확인) ══════════
   같은 사람이 여러 번 올라와도 한 명으로 모읍니다.
   · 확실  : 사번이 같거나, 이름과 연락처가 모두 같음 → 자동으로 같은 사람
   · 의심  : 이름만 같거나 연락처만 같음 → 담당자가 "같은 사람 / 다른 사람"을 고름
   · 값 충돌 : 같은 사람인데 이름·부서·연락처·사번이 서로 다름 → 담당자가 기존/새 값을 고름 */
const normName = (v) => String(v ?? "").replace(/[^\p{L}\p{N}]/gu, "").toLowerCase();
const isAutoNo = (e) => String(e.empNo) === autoEmpNo(e.name, e.phone);
const FIELDS = [["name", "이름"], ["dept", "부서"], ["phone", "연락처"], ["empNo", "사번"]];

function isSure(a, b) {
  if (String(a.empNo) === String(b.empNo)) return true;
  return normName(a.name) !== "" && normName(a.name) === normName(b.name)
    && digits(a.phone).length >= 9 && digits(a.phone) === digits(b.phone);
}
function suspectWhy(a, b) {
  if (normName(a.name) && normName(a.name) === normName(b.name)) return "이름이 같음";
  if (digits(a.phone).length >= 9 && digits(a.phone) === digits(b.phone)) return "연락처가 같음";
  return "";
}
/** 같은 사람인데 값이 서로 다른 칸 */
function fieldConflicts(old, inc) {
  const out = [];
  for (const [k, label] of FIELDS) {
    const a = String(old[k] ?? "").trim(), b = String(inc[k] ?? "").trim();
    if (!a || !b) continue;                                          // 한쪽이 비었으면 채우기만 함
    if (k === "empNo" && (isAutoNo(old) || isAutoNo(inc))) continue;  // 자동 번호는 진짜 사번에 양보
    const same = k === "phone" ? digits(a) === digits(b) : k === "name" ? normName(a) === normName(b) : a === b;
    if (!same) out.push({ k, label, old: a, new: b });
  }
  return out;
}
/** 이미 들어 있는 명단 안에서 같은 사람으로 보이는 묶음을 찾는다 (확실 → 의심 순) */
function findDupGroups(emps) {
  const n = emps.length, parent = emps.map((_, i) => i);
  const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  const sure = new Set();
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const a = emps[i], b = emps[j];
    const isS = normName(a.name) !== "" && normName(a.name) === normName(b.name)
      && digits(a.phone).length >= 9 && digits(a.phone) === digits(b.phone);
    if (isS || suspectWhy(a, b)) {
      parent[find(i)] = find(j);
      if (isS) { sure.add(i); sure.add(j); }
    }
  }
  const groups = new Map();
  emps.forEach((e, i) => { const r = find(i); (groups.get(r) || groups.set(r, { members: [], sure: false }).get(r)).members.push(e); if (sure.has(i)) groups.get(r).sure = true; });
  return [...groups.values()].filter((g) => g.members.length > 1)
    .map((g) => ({ level: g.sure ? "sure" : "suspect", members: g.members }))
    .sort((a, b) => (a.level === b.level ? 0 : a.level === "sure" ? -1 : 1)
      || a.members[0].name.localeCompare(b.members[0].name, "ko"));
}

/** 올린 줄마다 "누구와 같은 사람인지"를 찾는다 */
function planEmployees(current, incoming) {
  const rows = incoming.map((inc) => ({ key: String(inc.empNo), inc, sure: null, suspects: [] }));
  const claimed = new Set();
  for (const r of rows) {
    const hit = current.find((p) => !claimed.has(String(p.empNo)) && isSure(r.inc, p));
    if (hit) { r.sure = hit; claimed.add(String(hit.empNo)); }
  }
  rows.forEach((r, i) => {
    if (r.sure) return;
    for (const p of current) {
      if (claimed.has(String(p.empNo))) continue;
      const why = suspectWhy(r.inc, p);
      if (why) r.suspects.push({ ref: "e:" + p.empNo, e: p, why });
    }
    for (let j = 0; j < i; j++) {
      const q = rows[j];
      const why = suspectWhy(r.inc, q.inc);
      if (why && !q.sure) r.suspects.push({ ref: "i:" + q.key, e: q.inc, why });
    }
  });
  return { rows, claimed };
}
/** 미리보기용 요약 + 담당자가 확인할 항목 */
function reviewEmployees(current, incoming) {
  const { rows, claimed } = planEmployees(current, incoming);
  const added = [], changed = [], same = [], back = [];
  const review = { suspects: [], conflicts: [] };
  const asked = new Set();
  for (const r of rows) {
    if (!r.sure) {
      added.push(r.inc);
      if (r.suspects.length) {
        r.suspects.forEach((c) => { if (c.ref.startsWith("e:")) asked.add(c.ref.slice(2)); });
        review.suspects.push({
          key: r.key, inc: r.inc,
          candidates: r.suspects.map((c) => ({ ref: c.ref, e: c.e, why: c.why, conflicts: fieldConflicts(c.e, r.inc) })),
        });
      }
      continue;
    }
    const old = r.sure, conf = fieldConflicts(old, r.inc);
    const fields = conf.map((c) => [c.label, c.old, c.new]);
    for (const [k, label] of FIELDS) {
      if (k !== "empNo" && !String(old[k] ?? "").trim() && String(r.inc[k] ?? "").trim()) fields.push([label, "", r.inc[k]]);
    }
    if (!isActive(old)) back.push({ ...r.inc, old });
    if (conf.length) review.conflicts.push({ key: r.key, inc: r.inc, target: old, conflicts: conf });
    if (fields.length) changed.push({ ...r.inc, old, fields });
    else if (isActive(old)) same.push(r.inc);
  }
  const missing = current.filter((e) => !claimed.has(String(e.empNo)) && !asked.has(String(e.empNo)) && isActive(e));
  return { diff: { added, changed, same, missing, back }, review };
}

/* ── 업로드 표 → 항목 ── */
const ALIAS = {
  empNo: ["사번", "사원번호", "직원번호", "사번입력"],
  name: ["이름", "성명", "직원명", "직원이름"],
  dept: ["부서병동", "부서", "소속", "병동", "부서명"],
  phone: ["연락처", "휴대폰", "핸드폰", "전화번호", "전화"],
  date: ["봉사일", "봉사일자", "활동일", "일자", "날짜"],
  content: ["봉사내용", "활동내용", "내용"],
  type: ["봉사구분", "구분", "봉사유형", "대분류"],
  hours: ["봉사시간", "활동시간", "시간"],
  count: ["인정횟수", "횟수", "건수"],
  points: ["지급포인트", "포인트", "지급액"],
  pointStatus: ["포인트신청여부", "신청여부", "포인트신청"],
};
function mapHeaders(headers) {
  const H = headers.map((h) => String(h ?? "").replace(/[\s()[\]/·.]/g, "").trim());
  const used = new Set(), idx = {};
  for (const [field, names] of Object.entries(ALIAS)) {
    let found = -1;
    for (const a of names) {
      const i = H.findIndex((h, j) => !used.has(j) && h === a);
      if (i >= 0) { found = i; break; }
    }
    if (found < 0) for (const a of names) {
      const i = H.findIndex((h, j) => !used.has(j) && h && h.includes(a));
      if (i >= 0) { found = i; break; }
    }
    if (found >= 0) { idx[field] = found; used.add(found); }
  }
  return idx;
}
/** 머리글 행을 찾는다 (앞에 제목·설명 줄이 있어도 됨) */
function findHeader(rows) {
  const HEAD = ["사번", "사원번호", "이름", "성명", "사번입력", "직원이름", "직원명"];
  const hi = rows.findIndex((r) =>
    r.some((c) => HEAD.includes(String(c).replace(/[\s()[\]/·.]/g, "").trim())));
  if (hi < 0) throw new Error("머리글 행을 찾지 못했습니다. '이름' 열이 있는지 확인해 주세요.");
  return { headers: rows[hi], body: rows.slice(hi + 1) };
}
function cellDate(v) {
  if (!v) return "";
  const s = String(v).trim();
  // 엑셀 날짜 번호(예: 45602.0) → 2024-11-06
  if (/^\d{5}(\.\d+)?$/.test(s)) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(s)) * 86400000);
    return d.toISOString().slice(0, 10);
  }
  const m = s.match(/(\d{4})[.\-/년\s]+(\d{1,2})[.\-/월\s]+(\d{1,2})/);
  return m ? `${m[1]}-${String(m[2]).padStart(2, "0")}-${String(m[3]).padStart(2, "0")}` : s;
}

function parseEmployees(rows) {
  const { headers, body } = findHeader(rows);
  const m = mapHeaders(headers);
  if (m.name === undefined) throw new Error("'이름' 열이 필요합니다.");
  const map = new Map();
  let dup = 0;
  for (const r of body) {
    const name = String(r[m.name] ?? "").trim();
    if (!name) continue;
    const phone = String(r[m.phone] ?? "").trim();
    const empNo = String(r[m.empNo] ?? "").trim() || autoEmpNo(name, phone); // 사번 칸이 없어도 됨
    if (map.has(empNo)) dup++;
    map.set(empNo, {
      empNo, name,
      dept: String(r[m.dept] ?? "").trim(),
      phone,
      status: "active",
    });
  }
  return { list: [...map.values()], dupCount: dup };
}

function parseRecords(rows) {
  const { headers, body } = findHeader(rows);
  const m = mapHeaders(headers);
  if (m.empNo === undefined && m.name === undefined) throw new Error("'이름' 열(또는 '사번' 열)이 필요합니다.");
  const out = [];
  for (const r of body) {
    const empNo = cleanEmpNo(r[m.empNo]);
    if (!empNo && !String(r[m.name] ?? "").trim()) continue;
    const cnt = r[m.count];
    out.push({
      empNo,
      name: String(r[m.name] ?? "").trim(),
      date: cellDate(r[m.date]),
      content: String(r[m.content] ?? "").trim(),
      type: String(r[m.type] ?? "외부").trim() || "외부",
      hours: Number(r[m.hours]) || 0,
      count: cnt === "" || cnt === undefined ? "" : Number(cnt),
      phone: String(r[m.phone] ?? "").trim(),
      points: Number(String(r[m.points] ?? "").replace(/[^\d.-]/g, "")) || 0,
      pointStatus: String(r[m.pointStatus] ?? "").trim(),
    });
  }
  return out;
}

module.exports = {
  ANNUAL_DUTY, RESERVE_LIMIT, POINT_PER_CASE, MSG_DEPT_FULL, MSG_CLOSED, LIVE,
  digits, autoEmpNo, cleanEmpNo, round2, isActive, scoreOf, monthKey, monthLabel,
  deadlineEnd, deadlinePassed, isDone, isOpen,
  seatCount, reserveCount, deptCount, perLimit, monthLimit, limitIn, deptMonthCount, decideApply, summarize, scoreMap,
  wardNo, deptCheck, buildDiff, planEmployees, reviewEmployees, findDupGroups, isSure, suspectWhy, fieldConflicts, isAutoNo, normName, FIELDS, parseEmployees, parseRecords,
};

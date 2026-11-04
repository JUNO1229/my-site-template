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
  const deptOver = dn >= Number(post.deptLimit || 3);
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

/** 사번을 모를 때 쓰는 내부 번호 — 같은 사람이면 항상 같은 값이라 명단을 다시 올려도 겹치지 않는다 */
const autoEmpNo = (name, phone) =>
  `${String(name).replace(/\s/g, "")}-${digits(phone).slice(-8)}`;

/* ── 업로드 표 → 항목 ── */
const ALIAS = {
  empNo: ["사번", "사원번호", "직원번호"],
  name: ["이름", "성명", "직원명"],
  dept: ["부서병동", "부서", "소속", "병동", "부서명"],
  phone: ["연락처", "휴대폰", "핸드폰", "전화번호", "전화"],
  date: ["봉사일", "봉사일자", "활동일", "일자", "날짜"],
  content: ["봉사내용", "활동내용", "내용"],
  type: ["봉사구분", "구분", "봉사유형"],
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
  const hi = rows.findIndex((r) =>
    r.some((c) => ["사번", "사원번호", "이름", "성명"].includes(String(c).trim())));
  if (hi < 0) throw new Error("머리글 행을 찾지 못했습니다. '이름' 열이 있는지 확인해 주세요.");
  return { headers: rows[hi], body: rows.slice(hi + 1) };
}
function cellDate(v) {
  if (!v) return "";
  const s = String(v).trim();
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
    const empNo = String(r[m.empNo] ?? "").trim();
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
      points: Number(String(r[m.points] ?? "").replace(/[^\d.-]/g, "")) || 0,
      pointStatus: String(r[m.pointStatus] ?? "").trim(),
    });
  }
  return out;
}

module.exports = {
  ANNUAL_DUTY, RESERVE_LIMIT, POINT_PER_CASE, MSG_DEPT_FULL, MSG_CLOSED, LIVE,
  digits, autoEmpNo, round2, isActive, scoreOf, monthKey, monthLabel,
  deadlineEnd, deadlinePassed, isDone, isOpen,
  seatCount, reserveCount, deptCount, decideApply, summarize, scoreMap,
  wardNo, deptCheck, buildDiff, parseEmployees, parseRecords,
};

/* ══════════════════════════════════════════════════════════════
   사회사업실 원스탑 서비스 — 화면
   ══════════════════════════════════════════════════════════════ */
"use strict";

const ANNUAL_DUTY = 1, RESERVE_LIMIT = 2, POINT_PER_CASE = 10000;
const EZWEL = "https://hpmoa.ezwel.com/pc/product/main/welfare-mall";
const MISSION = "어르신은 건강하게, 가족은 편안하게, 직원은 즐겁게";
const MSG_DEPT_FULL = "죄송합니다. 부서(병동)별 할당 인원이 초과되었습니다. 다음기회에 접수바랍니다.";

const STATUS = {
  pending:  { label: "승인 대기", tone: "amber", desc: "접수되었습니다. 담당자가 승인하면 확정됩니다. 아직 확정된 것은 아닙니다." },
  approved: { label: "승인 완료", tone: "",      desc: "참여가 확정되었습니다. 일정에 맞춰 참여해 주세요." },
  reserve:  { label: "예비",     tone: "amber", desc: "정원이 차서 예비 순번입니다. 앞 순번에서 취소가 생기면 담당자가 연락드립니다." },
  excluded: { label: "누락",     tone: "warn",  desc: "부서(병동)별 할당 인원이 초과되어 접수되지 않았습니다. 다음 기회에 접수 바랍니다." },
  rejected: { label: "반려",     tone: "warn",  desc: "이번 자원봉사는 참여가 어렵게 되었습니다. 궁금한 점은 사회사업실로 문의해 주세요." },
};

/* ══════════ 도우미 ══════════ */
const $ = (s, r) => (r || document).querySelector(s);
const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g,
  (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const digits = (v) => String(v == null ? "" : v).replace(/\D/g, "");
const norm = (v) => String(v == null ? "" : v).replace(/\s/g, "").trim();
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const won = (n) => (Number(n) || 0).toLocaleString("ko-KR");
const pad = (n) => String(n).padStart(2, "0");

function fmtWhen(iso) {
  if (!iso) return "일시 미정";
  const d = new Date(iso);
  if (isNaN(d)) return String(iso);
  const w = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
  return `${d.getFullYear()}. ${pad(d.getMonth() + 1)}. ${pad(d.getDate())}(${w}) ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fmtStamp(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return "";
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fmtShort(iso) {
  const d = new Date(iso);
  return isNaN(d) ? "" : `${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fmtDay(ymd) {
  const p = String(ymd || "").split("-");
  return p.length === 3 ? `${Number(p[1])}월 ${Number(p[2])}일` : String(ymd || "");
}
function plusDays(n) {
  const t = new Date(); t.setDate(t.getDate() + n);
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
}
function nextMonthWhen(when) {
  const d = new Date(when);
  if (isNaN(d)) return "";
  const day = d.getDate();
  const t = new Date(d.getFullYear(), d.getMonth() + 1, 1, d.getHours(), d.getMinutes());
  const last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
  t.setDate(Math.min(day, last));
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}T${pad(t.getHours())}:${pad(t.getMinutes())}`;
}
const monthKey = (w) => String(w || "").slice(0, 7);
const monthLabel = (w) => (monthKey(w) ? `${Number(monthKey(w).slice(5, 7))}월` : "");
function deadlineEnd(d) { const t = new Date(`${d}T23:59:59`); return isNaN(t) ? null : t; }
function deadlinePassed(d) { const t = d && deadlineEnd(d); return !!t && t < new Date(); }
function daysLeft(d) {
  if (!d) return null;
  const t = deadlineEnd(d); if (!t) return null;
  const a = new Date(); a.setHours(0, 0, 0, 0);
  const b = new Date(t); b.setHours(0, 0, 0, 0);
  return Math.round((b - a) / 86400000);
}
/* 사번이 아직 없는 직원에게는 내부 구분용 번호("이름-숫자")가 붙어 있습니다. 화면에는 "-"로 보이고,
   봉사 내역 파일에서 사번을 가져오면 진짜 사번으로 바뀝니다. */
const isAutoNo = (no) => /\D-\d+$/.test(String(no ?? ""));
const noText = (no) => (isAutoNo(no) ? "-" : String(no ?? ""));
const isActive = (e) => (e.status || "active") !== "retired";
const isDone = (p) => !!p.closed || (!!p.when && new Date(p.when) < new Date());
function scoreOf(r) {
  const c = Number(r.count);
  if (!Number.isNaN(c) && r.count !== "" && r.count != null) return c;
  const h = Number(r.hours) || 0;
  return String(r.type).includes("내부") ? (h / 2) * 0.5 : h / 4;
}
function wardNo(dept) {
  const m = String(dept || "").match(/(\d+)\s*(?:병동|[Ww])?\s*$/);
  return m ? String(Number(m[1])) : null;
}

/* 확인 대화상자 — 브라우저 기본 confirm 을 쓰지 않습니다 */
function ask(message, okLabel) {
  return new Promise((resolve) => {
    const wrap = document.createElement("div");
    wrap.className = "dlgwrap";
    wrap.innerHTML = `<div class="dlg" role="dialog" aria-modal="true">
      <h3>확인</h3><p>${esc(message)}</p>
      <div class="btns"><button class="btn g" data-no>취소</button>
      <button class="btn dg" data-yes>${esc(okLabel || "계속")}</button></div></div>`;
    const done = (v) => { wrap.remove(); document.removeEventListener("keydown", key); resolve(v); };
    const key = (e) => { if (e.key === "Escape") done(false); };
    wrap.addEventListener("click", (e) => {
      if (e.target === wrap || e.target.closest("[data-no]")) done(false);
      else if (e.target.closest("[data-yes]")) done(true);
    });
    document.addEventListener("keydown", key);
    document.body.appendChild(wrap);
    wrap.querySelector("[data-yes]").focus();
  });
}

/* CSV 내려받기 — 엑셀에서 바로 열립니다 */
function downloadCsv(filename, rows) {
  if (!rows.length) { warn("내려받을 자료가 없습니다."); return; }
  const cell = (v) => {
    const s = String(v == null ? "" : v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = Object.keys(rows[0]);
  const body = [head.join(","), ...rows.map((r) => head.map((h) => cell(r[h])).join(","))].join("\r\n");
  const blob = new Blob(["﻿" + body], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

/* ══════════ 서버 호출 ══════════ */
async function api(path, body, opts = {}) {
  const init = { method: body === undefined ? "GET" : "POST", credentials: "same-origin", ...opts };
  if (body !== undefined && !opts.raw) {
    init.headers = { "content-type": "application/json", ...(init.headers || {}) };
    init.body = JSON.stringify(body);
  } else if (opts.raw) {
    init.body = body;
  }
  let r;
  try { r = await fetch(path, init); }
  catch { throw new Error("서버에 연결하지 못했습니다. 잠시 뒤 다시 시도해 주세요."); }
  let j = {};
  try { j = await r.json(); } catch { /* 본문 없음 */ }
  if (r.status === 401 && S.me) { S.me = null; render(); throw new Error("로그인이 풀렸습니다. 다시 로그인해 주세요."); }
  if (r.status === 403 && S.me && S.me.role === "admin") { // 같은 브라우저의 다른 탭에서 직원으로 로그인한 경우
    S.me = null; S.admin = null; S.err = "다른 계정으로 로그인되어 담당자 권한이 풀렸습니다. 다시 로그인해 주세요.";
    render(); throw new Error(S.err);
  }
  if (!r.ok || j.ok === false) {
    const e = new Error(j.error || `오류가 났습니다 (${r.status})`);
    e.needConfirm = !!j.needConfirm; // 서버가 "확인 후 계속"을 요청한 경우
    throw e;
  }
  return j;
}

/* ══════════ 상태 ══════════ */
const S = {
  me: null, view: null, admin: null,
  tab: "home", adminTab: "post",
  detail: null, busy: false, msg: null, err: "",
  // 담당자 화면
  rows: null, showDone: false, order: "score", filter: "all",
  editPost: null, pf: null, pre: null, preOpt: null,
  q: "", onlyActive: true, editEmp: null, ef: null, adding: false, nf: null,
};
const setMsg = (t, m) => { S.msg = m ? { t, m } : null; };

/* ══════════ 그리기 ══════════ */
/* ── 움직임 ──
   화면이 "바뀌었을 때"(다른 탭으로 가거나, 자료가 처음 들어왔을 때)만 #app 에 enter 를 붙여
   카드가 차례로 올라오게 합니다. 칩을 누르는 것처럼 같은 화면 안에서 다시 그릴 때는 붙이지 않습니다. */
let lastViewKey = "", enterTimer = 0;
function viewKey() {
  if (!S.me) return "login";
  if (S.me.mustChange) return "pw";
  const admin = S.me.role === "admin";
  return [S.me.role, admin ? S.adminTab : S.tab, S.detail || "", S.pre ? "pre" : "", (admin ? S.admin : S.view) ? 1 : 0].join("|");
}
const reducedMotion = () => window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

/* 점수·건수 숫자가 0에서 올라가며 보이게 (숫자만 있는 칸에 한해) */
function runCountUp(root) {
  if (reducedMotion()) return;
  root.querySelectorAll(".feature .big, .kpi .v").forEach((el) => {
    const n = el.firstChild;
    if (!n || n.nodeType !== 3) return;
    const raw = n.nodeValue.trim();
    if (!/^[\d,]+(\.\d+)?$/.test(raw)) return;
    const target = parseFloat(raw.replace(/,/g, ""));
    if (!(target > 0)) return;
    const dec = (raw.split(".")[1] || "").length, comma = raw.includes(",");
    const fmt = (v) => comma
      ? v.toLocaleString("ko-KR", { minimumFractionDigits: dec, maximumFractionDigits: dec }) : v.toFixed(dec);
    const t0 = performance.now(), dur = 700;
    n.nodeValue = fmt(0);
    const step = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      if (p < 1 && n.isConnected) { n.nodeValue = fmt(target * (1 - Math.pow(1 - p, 3))); requestAnimationFrame(step); }
      else n.nodeValue = raw;
    };
    requestAnimationFrame(step);
  });
}

function render() {
  const app = $("#app");
  const key = viewKey(), changed = key !== lastViewKey;
  lastViewKey = key;
  app.classList.toggle("enter", changed);
  if (!S.me) app.innerHTML = screenLogin();
  else if (S.me.mustChange) app.innerHTML = screenChangePw();
  else if (S.me.role === "admin") app.innerHTML = screenAdmin();
  else app.innerHTML = screenStaff();
  app.scrollTop = 0;
  if (changed) {
    runCountUp(app);
    clearTimeout(enterTimer);
    enterTimer = setTimeout(() => app.classList.remove("enter"), 1400);
  }
}

const Mission = () => `<div class="mission"><div class="m">MISSION</div><div class="s">${MISSION}</div></div>`;
const Empty = (icon, text) =>
  `<div class="empty"><div class="ring">${icon || I.box}</div><p>${esc(text)}</p></div>`;
const Note = (tone, html) => `<div class="note ${tone || ""}">${html}</div>`;
const MsgBox = () => {
  if (!S.msg) return "";
  const fresh = !S.msg.seen; S.msg.seen = true;   // 새로 뜬 안내만 한 번 미끄러져 들어옴
  return Note(S.msg.t, esc(S.msg.m)).replace('class="note ', `class="note${fresh ? " fx-in" : ""} `);
};
const NavHeader = (title, sub, back, right) => `
  <div class="hdr">
    ${back ? `<button class="back" data-act="${back}" aria-label="뒤로 가기">${I.back}</button>` : ""}
    <div style="min-width:0">
      <div class="ttl">${esc(title)}</div>
      ${sub ? `<div class="sub">${esc(sub)}</div>` : ""}
    </div>
    ${right ? `<div class="right">${right}</div>` : ""}
  </div>`;

/* ══════════ 로그인 ══════════ */
function screenLogin() {
  return `
  <div class="scroll-area"><div class="auth">
    <div class="brand">
      <img src="/emblem.png" alt="효사랑가족요양병원">
      <div class="t">사회사업실 원스탑 서비스</div>
      <div class="s">효사랑가족요양병원 2병원 · 원큐사회사업실</div>
    </div>
    <div class="box">
      <div class="f">
        <label for="lid">이름</label>
        <input id="lid" class="in${S.err ? " err" : ""}" placeholder="이름을 입력하세요" autocomplete="username">
      </div>
      <div class="f">
        <label for="lpw">비밀번호</label>
        <input id="lpw" class="in${S.err ? " err" : ""}" type="password"
          placeholder="연락처 뒷번호 4자리" autocomplete="current-password">
      </div>
      ${S.err ? `<div class="errmsg" role="alert">${esc(S.err)}</div>` : ""}
      <button class="cta" style="margin-top:4px" data-act="login"${S.busy ? " disabled" : ""}>
        ${S.busy ? "확인 중…" : "로그인"}</button>
      <button class="cta" style="margin-top:12px;background:var(--color-primary-end);color:var(--text-on-color)" data-act="adminenter"${S.busy ? " disabled" : ""}>
        담당자로 바로 들어가기</button>
      <p style="font-size:var(--fs-caption);color:var(--text-secondary);margin-top:12px;text-align:center">
        비밀번호를 모르시면 사회사업실로 문의해 주세요.</p>
    </div>
    ${Mission()}
  </div></div>`;
}

/* ══════════ 비밀번호 변경 ══════════ */
function screenChangePw() {
  const first = S.me.mustChange;
  return `
  <div class="scroll-area"><div class="auth">
    <div class="brand">
      <img src="/emblem.png" alt="">
      <div class="t">비밀번호 변경</div>
      <div class="s">${esc(S.me.name)}${S.me.dept ? " · " + esc(S.me.dept) : ""}</div>
    </div>
    <div class="box">
      ${first ? Note("amber", "처음 로그인하셨습니다. 쓰실 비밀번호를 직접 정해 주세요. 받으신 초기 비밀번호는 다른 사람도 알 수 있습니다.") : ""}
      <div class="f"><label for="cp0">지금 비밀번호</label>
        <input id="cp0" class="in" type="password" autocomplete="current-password"></div>
      <div class="f"><label for="cp1">새 비밀번호 <span class="hint">4자리 이상</span></label>
        <input id="cp1" class="in" type="password" autocomplete="new-password"></div>
      <div class="f"><label for="cp2">새 비밀번호 확인</label>
        <input id="cp2" class="in" type="password" autocomplete="new-password"></div>
      ${S.err ? `<div class="errmsg" role="alert">${esc(S.err)}</div>` : ""}
      <button class="cta" style="margin-top:4px" data-act="changepw"${S.busy ? " disabled" : ""}>
        ${S.busy ? "바꾸는 중…" : "비밀번호 바꾸기"}</button>
      <div style="text-align:center;margin-top:14px">
        <button class="linkb" data-act="logout">로그아웃</button></div>
    </div>
    ${Mission()}
  </div></div>`;
}

/* ══════════════════════════════════════════════════════════════
   직원 화면
   ══════════════════════════════════════════════════════════════ */
function screenStaff() {
  const v = S.view;
  if (!v) return `<div class="scroll-area"><div class="page"><div class="sk"></div><div class="sk"></div></div></div>`;
  if (S.detail) return screenDetail();

  const live = v.apps.filter((a) => ["pending", "approved", "reserve"].includes(a.status));
  const tabs = [
    { id: "home", label: "홈", icon: I.home },
    { id: "apply", label: "신청", icon: I.hand, n: v.postings.length },
    { id: "my", label: "내 실적", icon: I.chart, n: live.length },
    { id: "donate", label: "후원", icon: I.gift },
  ];
  const head = S.tab === "home"
    ? `<div class="hdr">
         <img class="avatar" src="/emblem.png" alt="">
         <div style="min-width:0">
           <div class="ttl">${esc(v.me.name)} 님</div>
           <div class="sub">${esc(v.me.dept)}</div>
         </div>
         <div class="right">
           <button class="iconbtn" data-act="gochangepw" aria-label="비밀번호 변경">${I.key}</button>
           <button class="iconbtn" data-act="logout" aria-label="로그아웃">${I.logout}</button>
         </div>
       </div>`
    : NavHeader({ apply: "자원봉사 신청", my: "내 신청 · 실적", donate: "바자회 물품 후원" }[S.tab],
        `${v.me.name} · ${v.me.dept}`, null,
        `<button class="iconbtn" data-act="logout" aria-label="로그아웃">${I.logout}</button>`);

  const body = S.tab === "home" ? staffHome(v, live)
    : S.tab === "apply" ? staffApply(v)
    : S.tab === "my" ? staffMy(v)
    : staffDonate(v);

  return `<div class="shell">
    ${head}
    <div class="scroll-area"><div class="page">${MsgBox()}${body}${Mission()}</div></div>
    <nav class="tabbar" aria-label="주요 메뉴">
      ${tabs.map((t) => `
        <button class="${S.tab === t.id ? "on" : ""}" data-act="tab" data-v="${t.id}"
          ${S.tab === t.id ? 'aria-current="page"' : ""}>
          ${t.icon}<span>${t.label}</span>
          ${t.n > 0 ? `<span class="cnt">${t.n}</span>` : ""}
        </button>`).join("")}
    </nav>
  </div>`;
}

function staffHome(v, live) {
  const s = v.summary;
  const met = s.yearScore >= ANNUAL_DUTY;
  const pct = Math.min(100, Math.round((s.yearScore / ANNUAL_DUTY) * 100));
  return `
    <div class="feature">
      <div class="lbl">${s.year} 의무 봉사</div>
      <div class="big">${s.yearScore}<small>/ ${ANNUAL_DUTY}점</small></div>
      <div class="pbar"><i style="width:${pct}%"></i></div>
      <div class="desc">${met
        ? "올해 의무 봉사시간을 충족했습니다."
        : `${round2(ANNUAL_DUTY - s.yearScore)}점 남았습니다. 외부봉사 4시간 또는 내부봉사 2건이면 채워집니다.`}</div>
      <div class="grid">
        <div><div class="k">올해 봉사</div><div class="v">${round2(s.yearHours)}시간</div></div>
        <div><div class="k">누적 건수</div><div class="v">${s.cases}건</div></div>
        <div><div class="k">누적 포인트</div><div class="v">${won(s.totalPoints)}P</div></div>
      </div>
    </div>
    ${live.length ? `
      <div class="sec"><h2>진행 중인 신청</h2>
        <button class="more" data-act="tab" data-v="my">전체보기</button></div>
      <div class="tlist">${live.map((a) => `
        <div class="tli"><div class="top">
          <div class="ibox tint">${I.check}</div>
          <div style="min-width:0;flex:1">
            <div class="org">${esc(a.org)}</div>
            <div class="nm">${esc(a.name)}</div>
            <div class="when">${esc(fmtWhen(a.when))}</div>
          </div></div>
          <div class="foot"><span class="badge ${a.status}">${STATUS[a.status].label}</span></div>
        </div>`).join("")}</div>` : ""}
    <div class="sec"><h2>모집 중인 자원봉사</h2>
      ${v.postings.length > 2 ? `<button class="more" data-act="tab" data-v="apply">전체보기</button>` : ""}</div>
    ${v.postings.length === 0 ? Empty(I.calendar, "현재 모집 중인 자원봉사가 없습니다.")
      : `<div class="tlist">${v.postings.slice(0, 2).map((p, i) => postingRow(v, p, i)).join("")}</div>`}`;
}

function postingRow(v, p, i) {
  const cap = Number(p.capacity) || 0;
  const full = p.seat >= cap;
  const closed = full && p.reserve >= RESERVE_LIMIT;
  const deptFull = p.myDept >= Number(p.deptLimit || 3);
  const t = v.takenMonths[monthKey(p.when)];
  const used = !!t && t.postId !== p.id;
  const mine = !!t && t.postId === p.id;
  const dl = daysLeft(p.deadline);
  let seats = "";
  for (let k = 0; k < cap; k++) seats += `<span class="${k < p.seat ? "on" : ""}"></span>`;
  for (let k = 0; k < RESERVE_LIMIT; k++) seats += `<span class="rz ${k < p.reserve ? "on" : ""}"></span>`;
  return `
    <button class="tli" data-act="open" data-v="${esc(p.id)}">
      <div class="top">
        <div class="ibox ${i % 2 ? "tint" : "dark"}">${p.type === "내부" ? I.home : I.hand}</div>
        <div style="min-width:0;flex:1">
          <div class="org">${esc(p.org)}</div>
          <div class="nm">${esc(p.name)}</div>
          <div class="when">${esc(fmtWhen(p.when))} · ${p.type === "내부" ? "내부" : "외부"} ${esc(p.hours)}시간</div>
        </div>
      </div>
      <div class="gauge" aria-hidden="true">${seats}</div>
      <div class="glbl">
        <span class="${full ? "g" : "r"}">정원 <b>${p.seat}/${cap}</b>${full ? " 마감" : ""}</span>
        <span class="${closed ? "x" : "r"}">예비 <b>${p.reserve}/${RESERVE_LIMIT}</b>${closed ? " 마감" : ""}</span>
        <span class="r">우리 부서 <b>${p.myDept}/${esc(p.deptLimit)}</b></span>
      </div>
      <div class="foot">
        ${p.deadline ? `<span class="badge" style="background:${dl <= 1 ? "var(--tint-danger)" : "var(--color-field)"};color:${dl <= 1 ? "var(--on-tint-danger)" : "var(--text-secondary)"}">마감 ${fmtDay(p.deadline)}${dl === 0 ? " · 오늘까지" : dl === 1 ? " · 내일까지" : ` · ${dl}일 남음`}</span>` : ""}
        ${mine ? `<span class="badge approved">신청함</span>` : ""}
        ${used ? `<span class="badge reserve">${monthLabel(p.when)} 신청 완료</span>` : ""}
        ${deptFull && !mine ? `<span class="badge rejected">부서 할당 초과</span>` : ""}
        ${!deptFull && closed && !mine ? `<span class="badge reserve">접수 마감</span>` : ""}
        ${!deptFull && !closed && full && !mine ? `<span class="badge pending">예비로 접수</span>` : ""}
      </div>
    </button>`;
}

function staffApply(v) {
  const taken = Object.values(v.takenMonths);
  return `
    ${Note("", "한 달에 한 건만 신청할 수 있습니다. 같은 병동에서 신청할 수 있는 인원도 정해져 있습니다.")}
    ${taken.length ? Note("amber", `이미 신청하신 달 — ${taken.map((t) => esc(t.name)).join(" · ")}. 다른 달의 자원봉사는 신청하실 수 있습니다.`) : ""}
    <div class="sec"><h2>모집 중인 자원봉사 ${v.postings.length}건</h2></div>
    ${v.postings.length === 0 ? Empty(I.calendar, "현재 모집 중인 자원봉사가 없습니다.")
      : `<div class="tlist">${v.postings.map((p, i) => postingRow(v, p, i)).join("")}</div>`}`;
}

function screenDetail() {
  const v = S.view;
  const p = v.postings.find((x) => x.id === S.detail);
  if (!p) {
    return `<div class="shell">${NavHeader("자원봉사", null, "back")}
      <div class="scroll-area"><div class="page">${Empty(null, "해당 자원봉사를 찾을 수 없습니다.")}</div></div></div>`;
  }
  if (S.done) {
    const st = STATUS[S.done.status];
    return `<div class="shell">${NavHeader("신청 결과", null, "back")}
      <div class="scroll-area"><div class="page">
        <div class="feature">
          <div class="lbl">${st.label}</div>
          <div class="big" style="font-size:var(--fs-title-l);line-height:1.35">${
            S.done.status === "excluded" ? "접수되지 않았습니다"
            : S.done.status === "reserve" ? `예비 ${S.done.order}번으로 접수`
            : `접수 ${S.done.order}번`}</div>
          <div class="desc">${esc(p.org)} · ${esc(p.name)}<br>${esc(fmtWhen(p.when))}</div>
        </div>
        ${Note(st.tone, S.done.status === "excluded" ? MSG_DEPT_FULL
          : S.done.status === "reserve"
            ? "정원이 찬 일정입니다. 앞 순번에서 취소가 생기면 담당자가 연락드립니다."
            : "담당자가 최종 승인하면 확정됩니다. 승인 전까지는 확정이 아닙니다.")}
        ${Mission()}
      </div></div>
      <div class="bottom"><div class="inner">
        <button class="cta" data-act="back">목록으로 돌아가기</button></div></div>
    </div>`;
  }

  const cap = Number(p.capacity) || 0;
  const full = p.seat >= cap;
  const closed = full && p.reserve >= RESERVE_LIMIT;
  const deptFull = p.myDept >= Number(p.deptLimit || 3);
  const t = v.takenMonths[monthKey(p.when)];
  const used = !!t && t.postId !== p.id;
  const mine = !!t && t.postId === p.id;
  const dl = daysLeft(p.deadline);
  const blocked = mine || used || (closed && !deptFull);

  return `<div class="shell">
    ${NavHeader("자원봉사 신청", null, "back")}
    <div class="scroll-area"><div class="page">
      <div class="feature">
        <div class="lbl">${esc(p.org)}</div>
        <div class="big" style="font-size:var(--fs-title-l);line-height:1.35">${esc(p.name)}</div>
        <div class="desc">${esc(fmtWhen(p.when))}<br>
          ${p.type === "내부" ? "내부봉사" : "외부봉사"} ${esc(p.hours)}시간${p.deadline ? ` · 신청 마감 ${fmtDay(p.deadline)}` : ""}</div>
        <div class="grid">
          <div><div class="k">정원</div><div class="v">${p.seat}/${cap}명</div></div>
          <div><div class="k">예비</div><div class="v">${p.reserve}/${RESERVE_LIMIT}명</div></div>
          <div><div class="k">우리 부서</div><div class="v">${p.myDept}/${esc(p.deptLimit)}명</div></div>
        </div>
      </div>
      ${dl !== null && dl <= 1 && !blocked ? Note("warn", `신청 마감이 ${dl === 0 ? "오늘" : "내일"}까지입니다.`) : ""}
      ${mine ? Note("", "이미 신청하신 자원봉사입니다. 진행 상태는 [내 실적]에서 확인하세요.") : ""}
      ${used ? Note("amber", `${monthLabel(p.when)}에는 이미 신청한 자원봉사가 있습니다(${esc(t.name)}). 한 달에 한 건만 신청할 수 있습니다.`) : ""}
      ${deptFull && !mine ? Note("warn", MSG_DEPT_FULL) : ""}
      ${!deptFull && closed && !mine ? Note("warn", "정원과 예비 인원이 모두 찼습니다. 다음 기회에 접수 바랍니다.") : ""}
      ${!deptFull && !closed && full && !mine ? Note("amber", `정원이 찼습니다. 신청하시면 예비 ${p.reserve + 1}번으로 접수됩니다.`) : ""}
      <div class="card">
        <h3>신청자 정보</h3>
        <p class="cap">담당자가 연락드릴 번호입니다. 바뀌었으면 고쳐 주세요.</p>
        <div class="frow">
          <div class="f"><label>이름</label>
            <input class="in" value="${esc(v.me.name)}" disabled></div>
          <div class="f"><label>부서(병동)</label>
            <input class="in" value="${esc(v.me.dept)}" disabled></div>
        </div>
        <div class="f" style="margin-bottom:0"><label for="dph">연락처</label>
          <input id="dph" class="in" inputmode="tel" value="${esc(v.me.phone || "")}" placeholder="010-0000-0000"></div>
      </div>
      ${S.err ? Note("warn", esc(S.err)) : ""}
      ${Mission()}
    </div></div>
    <div class="bottom"><div class="inner">
      <button class="cta" data-act="apply" data-v="${esc(p.id)}"${S.busy || blocked ? " disabled" : ""}>
        ${S.busy ? "접수하는 중…"
          : mine ? "이미 신청한 자원봉사입니다"
          : used ? `${monthLabel(p.when)}은 이미 신청하셨습니다`
          : closed && !deptFull ? "접수 마감"
          : deptFull ? "신청하기 (부서 할당 초과)"
          : full ? "예비로 신청하기" : "자원봉사 신청하기"}</button>
    </div></div>
  </div>`;
}

function staffMy(v) {
  const s = v.summary;
  const met = s.yearScore >= ANNUAL_DUTY;
  const pct = Math.min(100, Math.round((s.yearScore / ANNUAL_DUTY) * 100));
  return `
    <div class="feature">
      <div class="lbl">${s.year} 환산 점수</div>
      <div class="big">${s.yearScore}<small>/ ${ANNUAL_DUTY}점</small></div>
      <div class="pbar"><i style="width:${pct}%"></i></div>
      <div class="desc">${met ? "올해 의무 봉사시간(4시간 = 1점)을 충족했습니다."
        : `${round2(ANNUAL_DUTY - s.yearScore)}점 남았습니다.`}</div>
      <div class="grid">
        ${s.totalHours ? `<div><div class="k">누적 봉사시간</div><div class="v">${round2(s.totalHours)}시간</div></div>` : `<div><div class="k">누적 점수</div><div class="v">${s.totalScore}점</div></div>`}
        <div><div class="k">누적 건수</div><div class="v">${s.cases}건</div></div>
        <div><div class="k">누적 포인트</div><div class="v">${won(s.totalPoints)}P</div></div>
      </div>
    </div>
    <div class="sec"><h2>신청 현황${v.apps.length ? ` ${v.apps.length}건` : ""}</h2></div>
    ${v.apps.length === 0 ? Empty(I.clipboard, "신청한 자원봉사가 없습니다.")
      : `<div class="tlist">${v.apps.map((a) => {
          const st = STATUS[a.status] || STATUS.pending;
          return `<div class="tli">
            <div class="top">
              <div class="ibox ${a.status === "approved" ? "dark" : "tint"}">${I.clipboard}</div>
              <div style="min-width:0;flex:1">
                <div class="org">${esc(a.org)}</div>
                <div class="nm">${esc(a.name)}</div>
                <div class="when">${esc(fmtWhen(a.when))} · 접수 ${fmtStamp(a.appliedAt)}</div>
              </div></div>
            <div class="foot"><span class="badge ${a.status}">${st.label}</span></div>
            <div class="note ${st.tone}" style="margin-top:12px;margin-bottom:0">${st.desc}</div>
          </div>`; }).join("")}</div>`}
    <div class="sec"><h2>포인트</h2></div>
    <div class="card">
      <div class="kpis">
        <div class="kpi"><div class="k">누적 지급포인트</div><div class="v">${won(s.totalPoints)}<small>P</small></div></div>
        <div class="kpi"><div class="k">지급 신청 접수</div><div class="v">${s.requested}<small>건</small></div></div>
      </div>
      <div class="note amber" style="margin-top:12px;margin-bottom:0">
        휴무·off·근무시간 외에 봉사하면 건당 ${won(POINT_PER_CASE)}포인트가 지급됩니다.
        이 화면에서는 신청 접수 여부까지만 확인할 수 있고, 실제 지급 여부는
        <a href="${EZWEL}" target="_blank" rel="noreferrer">행복모아 이지웰</a>에서 본인이 확인해 주세요.
      </div>
    </div>
    <div class="sec"><h2>봉사 내역 ${s.cases}건</h2></div>
    ${v.records.length === 0 ? Empty(I.chart, "등록된 봉사 내역이 없습니다.") : `
      <div class="scrollx"><table class="tbl">
        <thead><tr><th>봉사일</th><th>봉사내용</th><th>구분</th><th>시간</th><th>인정</th><th>포인트</th><th>신청</th></tr></thead>
        <tbody>${v.records.map((r) => `<tr>
          <td style="white-space:nowrap">${esc(r.date)}</td>
          <td>${esc(r.content)}</td>
          <td><span class="badge ${String(r.type).includes("내부") ? "info" : "green"}">${esc(r.type || "외부")}</span></td>
          <td style="white-space:nowrap">${r.hours ? esc(r.hours) + "시간" : "-"}</td>
          <td>${esc(r.count)}</td>
          <td style="white-space:nowrap">${won(r.points)}P</td>
          <td>${esc(r.pointStatus || "-")}</td></tr>`).join("")}</tbody>
      </table></div>`}`;
}

function staffDonate(v) {
  return `
    <div class="card">
      <h3>후원 물품 등록</h3>
      <p class="cap">후원해 주실 물품을 알려주세요. 여러 번 등록하셔도 됩니다.</p>
      <div class="f"><label for="ditem">후원물품</label>
        <textarea id="ditem" class="in" placeholder="예) 새 수건 20장&#10;예) 커피믹스 3박스, 텀블러 5개"></textarea></div>
      ${S.err ? Note("warn", esc(S.err)) : ""}
      <button class="cta" data-act="donate"${S.busy ? " disabled" : ""}>${S.busy ? "등록하는 중…" : "후원 등록"}</button>
    </div>
    <div class="sec"><h2>내가 등록한 물품${v.donations.length ? ` ${v.donations.length}건` : ""}</h2></div>
    ${v.donations.length === 0 ? Empty(I.gift, "아직 등록한 물품이 없습니다.")
      : `<div class="tlist">${v.donations.map((d) => `
        <div class="tli"><div class="top">
          <div class="ibox tint">${I.gift}</div>
          <div style="min-width:0;flex:1">
            <div class="org">${String(d.at).slice(0, 10)}</div>
            <div class="nm" style="white-space:pre-wrap;-webkit-line-clamp:4">${esc(d.item)}</div>
          </div></div></div>`).join("")}</div>`}`;
}

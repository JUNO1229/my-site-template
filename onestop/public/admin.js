/* ══════════════════════════════════════════════════════════════
   담당자 화면
   ══════════════════════════════════════════════════════════════ */
"use strict";

const blankRow = () => ({
  key: Math.random().toString(36).slice(2, 9),
  org: "", name: "", when: "", deadline: plusDays(7),
  type: "외부", hours: 4, capacity: 5, deptLimit: 3,
});

function screenAdmin() {
  const A = S.admin;
  const pending = A ? A.apps.filter((a) => a.status === "pending").length : 0;
  const menu = [
    { id: "post", label: "모집 공고", icon: I.calendar },
    { id: "apps", label: "신청 현황 · 승인", icon: I.clipboard, n: pending },
    { id: "donate", label: "바자회 후원", icon: I.gift, n: A ? A.donations.length : 0 },
    { id: "staff", label: "직원 관리", icon: I.people },
    { id: "data", label: "자료 관리", icon: I.box },
  ];
  const body = !A ? `<div class="sk"></div><div class="sk"></div>`
    : S.adminTab === "post" ? adminPost(A)
    : S.adminTab === "apps" ? adminApps(A)
    : S.adminTab === "donate" ? adminDonate(A)
    : S.adminTab === "staff" ? adminStaff(A)
    : adminData(A);

  return `<div class="admin">
    <aside class="side">
      <div class="brand"><img src="/emblem.png" alt="">
        <div><div class="t">원스탑 서비스</div><div class="s">원큐사회사업실</div></div></div>
      <nav aria-label="담당자 메뉴">
        ${menu.map((m) => `<button class="${S.adminTab === m.id ? "on" : ""}" data-act="atab" data-v="${m.id}"
          ${S.adminTab === m.id ? 'aria-current="page"' : ""}>${m.icon}<span>${m.label}</span>
          ${m.n > 0 ? `<span class="n">${m.n}</span>` : ""}</button>`).join("")}
      </nav>
      <div class="foot"><div class="who">${esc(S.me.name)}</div>
        <button data-act="logout">로그아웃</button></div>
    </aside>
    <div class="main">
      ${NavHeader(menu.find((m) => m.id === S.adminTab).label, "사회사업실 담당자", null,
        `<button class="iconbtn" data-act="gochangepw" aria-label="비밀번호 변경">${I.key}</button>
         <button class="iconbtn" data-act="logout" aria-label="로그아웃">${I.logout}</button>`)}
      <div class="mtabs chips">
        ${menu.map((m) => `<button class="chip ${S.adminTab === m.id ? "on" : ""}" data-act="atab" data-v="${m.id}">
          ${m.label}${m.n > 0 ? ` ${m.n}` : ""}</button>`).join("")}
      </div>
      <div class="toolbar">
        <button class="btn g xs" data-act="reload">${I.refresh}<span style="margin-left:6px">새로고침</span></button>
        <span class="meta">${A
          ? `직원 ${A.employees.filter(isActive).length}명 · 공고 ${A.postings.length}건 · 신청 ${A.apps.length}건 · 후원 ${A.donations.length}건`
          : "불러오는 중…"}</span>
      </div>
      <div class="scroll-area"><div class="page">${MsgBox()}${body}${Mission()}</div></div>
    </div>
  </div>`;
}

const scoreCell = (sc) => {
  const y = sc ? sc.year : 0, t = sc ? sc.total : 0;
  return `<span style="white-space:nowrap"><b style="font-weight:600;color:${
    y >= ANNUAL_DUTY ? "var(--text-primary)" : "var(--color-danger)"}">${y}점</b>
    <span style="color:var(--text-secondary);font-size:var(--fs-caption)"> / 누적 ${t}</span></span>`;
};

function sortApps(A, list) {
  if (S.order !== "score") return list;
  return list.slice().sort((a, b) => {
    const ua = ((A.scores[String(a.empNo)] || {}).year || 0) < ANNUAL_DUTY ? 0 : 1;
    const ub = ((A.scores[String(b.empNo)] || {}).year || 0) < ANNUAL_DUTY ? 0 : 1;
    return ua - ub || a.seq - b.seq;
  });
}

function appRow(A, a, post) {
  const st = STATUS[a.status] || STATUS.pending;
  return `<tr>
    <td>${a.seq}</td>
    <td style="white-space:nowrap;color:var(--text-secondary)">${fmtStamp(a.appliedAt)}</td>
    ${post !== undefined ? `<td>${esc(post ? post.name : "삭제된 공고")}
      <div style="font-size:12px;color:var(--text-secondary)">${esc(post ? post.org : "")}</div></td>` : ""}
    <td style="white-space:nowrap">${esc(a.name)}</td>
    <td>${esc(a.empNo)}</td>
    <td style="white-space:nowrap">${esc(a.dept)}</td>
    <td>${scoreCell(A.scores[String(a.empNo)])}</td>
    <td style="white-space:nowrap">${esc(a.phone)}</td>
    <td><span class="badge ${a.status}">${st.label}</span></td>
    <td style="white-space:nowrap">
      ${a.status === "excluded"
        ? `<button class="btn xs" data-act="addapprove" data-v="${esc(a.id)}" data-n="${esc(a.name)}">추가 승인</button>`
        : `${a.status !== "approved" ? `<button class="btn xs" style="margin-right:6px" data-act="status" data-v="${esc(a.id)}" data-s="approved">승인</button>` : ""}
           ${a.status !== "rejected" ? `<button class="btn g xs" data-act="status" data-v="${esc(a.id)}" data-s="rejected">반려</button>` : ""}`}
    </td></tr>`;
}

/* ══════════ 모집 공고 ══════════ */
function adminPost(A) {
  if (!S.rows) S.rows = [blankRow()];
  const shown = A.postings.filter((p) => isDone(p) === S.showDone)
    .sort((a, b) => String(b.when).localeCompare(String(a.when)));

  const cards = shown.map((p) => {
    const base = A.apps.filter((a) => a.postId === p.id && a.status !== "rejected")
      .sort((a, b) => String(a.appliedAt).localeCompare(String(b.appliedAt)))
      .map((a, i) => ({ ...a, seq: i + 1 }));
    const list = sortApps(A, base);
    const seat = base.filter((a) => ["pending", "approved"].includes(a.status)).length;
    const byD = {};
    for (const a of base) if (a.status !== "excluded") byD[a.dept] = (byD[a.dept] || 0) + 1;
    const editing = S.editPost === p.id && S.pf;

    return `<div class="card" style="border-left:4px solid ${S.showDone ? "var(--color-sage)" : "var(--green-600)"}">
      <div class="sec" style="margin:0 0 12px"><div style="min-width:0">
        <div style="font-size:var(--fs-caption);color:var(--text-secondary)">${esc(p.org)}</div>
        <h3 style="margin-bottom:4px">${esc(p.name)}</h3>
        <div style="font-size:var(--fs-body-s);color:var(--text-secondary)">
          ${esc(fmtWhen(p.when))} · ${esc(p.type)} ${esc(p.hours)}시간 · 정원 ${seat}/${esc(p.capacity)}명 · 부서당 ${esc(p.deptLimit)}명
          ${p.closed ? `<span class="badge reserve" style="margin-left:8px">모집 마감</span>` : ""}
        </div>
        ${p.deadline ? `<div style="font-size:var(--fs-caption);color:var(--text-secondary);margin-top:3px">
          신청 마감 ${fmtDay(p.deadline)}${deadlinePassed(p.deadline) ? " · 지남" : ` · ${daysLeft(p.deadline)}일 남음`}</div>` : ""}
      </div></div>
      <div class="btns" style="margin-bottom:${list.length ? 14 : 0}px">
        <button class="btn g xs" data-act="pedit" data-v="${esc(p.id)}">${editing ? "접기" : "수정"}</button>
        <button class="btn g xs" data-act="pdup" data-v="${esc(p.id)}">복사해서 새 공고</button>
        <button class="btn g xs" data-act="pfinal" data-v="${esc(p.id)}">최종명단</button>
        <button class="btn ${p.closed ? "" : "g"} xs" data-act="ptoggle" data-v="${esc(p.id)}">
          ${p.closed ? "다시 모집하기" : "모집 마감"}</button>
        <button class="btn dg xs" data-act="pdel" data-v="${esc(p.id)}">삭제</button>
      </div>
      ${editing ? postForm(S.pf, "pf", true) : ""}
      ${list.length === 0
        ? `<p style="font-size:var(--fs-body-s);color:var(--text-secondary)">아직 신청자가 없습니다.</p>`
        : `<div class="scrollx"><table class="tbl">
            <thead><tr><th>접수</th><th>접수시각</th><th>이름</th><th>사번</th><th>부서(병동)</th>
              <th>올해 점수</th><th>연락처</th><th>상태</th><th>처리</th></tr></thead>
            <tbody>${list.map((a) => appRow(A, a)).join("")}</tbody></table></div>
           <p style="font-size:var(--fs-caption);color:var(--text-secondary);margin-top:8px">
             부서별 ${Object.entries(byD).map(([d, c]) => `${esc(d)} ${c}명`).join(" · ")}</p>`}
    </div>`;
  }).join("");

  return `
    <div class="sec">
      <h2>${S.showDone ? "완료된 공고" : "진행 중인 공고"} ${shown.length}건</h2>
      <button class="btn g xs" data-act="togdone">
        ${S.showDone ? `${I.back}<span style="margin-left:6px">진행 중 보기</span>`
          : `${I.box}<span style="margin-left:6px">완료된 공고 보기</span>`}</button>
    </div>
    ${Note("", S.showDone
      ? "모집을 마감했거나 일시가 지난 자원봉사입니다. 다시 모집하거나 복사해서 새로 올릴 수 있습니다."
      : "지금 직원 화면에 보이는 자원봉사입니다. 마감일이 지나면 직원 화면에서 자동으로 내려갑니다.")}
    <div class="chips" style="margin-bottom:16px">
      <span style="font-size:var(--fs-caption);color:var(--text-secondary);align-self:center">신청자 정렬</span>
      <button class="chip ${S.order === "score" ? "on" : ""}" data-act="order" data-v="score">의무 미충족 우선</button>
      <button class="chip ${S.order === "time" ? "on" : ""}" data-act="order" data-v="time">접수 순</button>
    </div>
    ${shown.length === 0
      ? Empty(I.calendar, S.showDone ? "완료된 공고가 없습니다." : "진행 중인 공고가 없습니다. 아래에서 새로 등록해 주세요.")
      : `<div class="tlist">${cards}</div>`}
    ${S.showDone ? "" : `
      <div class="sec"><h2>자원봉사 모집 공고 등록</h2></div>
      <div class="card">
        <p class="cap">일정마다 기관과 자원봉사명을 따로 적습니다. 서로 다른 기관의 일정을 한 번에 등록하실 수 있습니다.</p>
        ${S.rows.map((r, i) => `
          <div class="card" style="background:var(--color-field);box-shadow:none;margin-bottom:12px">
            <div class="sec" style="margin:0 0 12px">
              <h3 style="font-size:var(--fs-body-m);color:var(--text-secondary)">일정 ${i + 1}</h3>
              ${S.rows.length > 1 ? `<button class="linkb" style="color:var(--color-danger)" data-act="rowdel" data-v="${i}">삭제</button>` : ""}
            </div>
            ${postForm(r, "row" + i, false, i)}
          </div>`).join("")}
        <div class="btns">
          <button class="btn g" data-act="rowadd">${I.plus} 일정 추가</button>
          <button class="btn pt" data-act="psave">${S.rows.length > 1 ? `${S.rows.length}건 등록` : "공고 등록"}</button>
          <span style="flex:1"></span>
          <button class="btn g" data-act="rowreset">다시 작성</button>
        </div>
      </div>`}`;
}

/** 공고 입력 칸 — 등록과 수정이 같은 모양을 씁니다 */
function postForm(r, ns, isEdit, idx) {
  const w = isEdit ? ' style="background:#fff"' : ' style="background:#fff"';
  const d = (k) => `data-f="${ns}" data-k="${k}"${idx !== undefined ? ` data-i="${idx}"` : ""}`;
  return `
    <div class="frow">
      <div class="f"><label>자원봉사 기관</label>
        <input class="in"${w} ${d("org")} value="${esc(r.org)}" placeholder="예: 전주시노인복지관"></div>
      <div class="f"><label>자원봉사명</label>
        <input class="in"${w} ${d("name")} value="${esc(r.name)}" placeholder="예: 어르신 배식 봉사"></div>
    </div>
    <div class="frow">
      <div class="f"><label>자원봉사 일시</label>
        <input type="datetime-local" class="in"${w} ${d("when")} value="${esc(r.when)}"></div>
      <div class="f"><label>모집 마감일 <span class="hint">이 날 자정까지</span></label>
        <input type="date" class="in"${w} ${d("deadline")} value="${esc(r.deadline)}">
        ${isEdit ? "" : `<div class="chips" style="margin-top:8px">
          ${[2, 3, 5, 7].map((n) => `<button class="chip" style="min-height:34px;background:#fff"
            data-act="dl" data-i="${idx}" data-v="${n}">${n}일 뒤</button>`).join("")}</div>`}</div>
    </div>
    <div class="frow">
      <div class="f"><label>봉사 구분 · 시간</label>
        <div style="display:flex;gap:8px">
          <select class="in"${w} ${d("type")}>
            <option value="외부"${r.type === "외부" ? " selected" : ""}>외부봉사</option>
            <option value="내부"${r.type === "내부" ? " selected" : ""}>내부봉사</option>
          </select>
          <input type="number" min="0" step="0.5" class="in"${w} ${d("hours")} value="${esc(r.hours)}">
        </div></div>
      <div class="f" style="margin-bottom:0"><div class="frow">
        <div><label>정원</label>
          <input type="number" min="1" class="in"${w} ${d("capacity")} value="${esc(r.capacity)}"></div>
        <div><label>부서별 제한</label>
          <input type="number" min="1" class="in"${w} ${d("deptLimit")} value="${esc(r.deptLimit)}"></div>
      </div></div>
    </div>
    ${isEdit ? `
      ${Note("amber", "정원이나 부서 제한을 줄여도 이미 접수된 신청의 상태는 그대로입니다. 필요하면 신청 현황에서 직접 조정해 주세요.")}
      <div class="btns"><button class="btn pt" data-act="peditsave">저장</button>
        <button class="btn g" data-act="peditcancel">취소</button></div>` : ""}`;
}

/* ══════════ 신청 현황 ══════════ */
function adminApps(A) {
  const cnt = (s) => A.apps.filter((a) => a.status === s).length;
  let rows = A.apps.slice().sort((a, b) => String(a.appliedAt).localeCompare(String(b.appliedAt)));
  if (S.filter !== "all") rows = rows.filter((a) => a.status === S.filter);
  rows = rows.map((a, i) => ({ ...a, seq: i + 1 }));
  rows = sortApps(A, rows);
  const pm = Object.fromEntries(A.postings.map((p) => [p.id, p]));

  return `
    <div class="chips" style="margin-bottom:12px">
      ${[["all", `전체 ${A.apps.length}`], ["pending", `승인대기 ${cnt("pending")}`],
         ["approved", `승인 ${cnt("approved")}`], ["reserve", `예비 ${cnt("reserve")}`],
         ["excluded", `누락 ${cnt("excluded")}`], ["rejected", `반려 ${cnt("rejected")}`]]
        .map(([v, l]) => `<button class="chip ${S.filter === v ? "on" : ""}" data-act="filter" data-v="${v}">${l}</button>`).join("")}
    </div>
    <div class="chips" style="margin-bottom:16px">
      <button class="chip ${S.order === "score" ? "on" : ""}" data-act="order" data-v="score">의무 미충족 우선</button>
      <button class="chip ${S.order === "time" ? "on" : ""}" data-act="order" data-v="time">접수 순</button>
      <span style="flex:1"></span>
      <button class="btn xs" data-act="approveall">대기 일괄 승인</button>
      <button class="btn pt xs" data-act="expfinal">${I.down} 최종명단</button>
      <button class="btn g xs" data-act="expall">신청현황</button>
      <button class="btn g xs" data-act="expwb">활동내역 붙여넣기용</button>
    </div>
    ${rows.length === 0 ? Empty(I.clipboard, "해당하는 신청 내역이 없습니다.") : `
      <div class="scrollx"><table class="tbl">
        <thead><tr><th>접수</th><th>접수시각</th><th>자원봉사</th><th>이름</th><th>사번</th>
          <th>부서(병동)</th><th>올해 점수</th><th>연락처</th><th>상태</th><th>처리</th></tr></thead>
        <tbody>${rows.map((a) => appRow(A, a, pm[a.postId] || null)).join("")}</tbody>
      </table></div>`}`;
}

/* ══════════ 바자회 후원 ══════════ */
function adminDonate(A) {
  const rows = A.donations.slice().sort((a, b) => String(b.at).localeCompare(String(a.at)));
  const byDept = {};
  for (const d of rows) byDept[d.dept] = (byDept[d.dept] || 0) + 1;
  const top = Object.entries(byDept).sort((a, b) => b[1] - a[1]);
  return `
    <div class="sec"><h2>후원 ${rows.length}건 · 참여 부서 ${top.length}곳</h2>
      <button class="btn g xs" data-act="expdon">${I.down} 엑셀</button></div>
    ${top.length ? Note("", `최다 참여 — ${top.slice(0, 3).map(([d, c]) => `${esc(d)} ${c}건`).join(" · ")}`) : ""}
    ${rows.length === 0 ? Empty(I.gift, "아직 등록된 후원 물품이 없습니다.") : `
      <div class="scrollx"><table class="tbl">
        <thead><tr><th>등록일시</th><th>이름</th><th>사번</th><th>부서(병동)</th><th>후원물품</th><th>연락처</th><th></th></tr></thead>
        <tbody>${rows.map((d) => `<tr>
          <td style="white-space:nowrap">${fmtShort(d.at)}</td>
          <td>${esc(d.name)}</td><td>${esc(d.empNo)}</td>
          <td style="white-space:nowrap">${esc(d.dept)}</td>
          <td style="white-space:pre-wrap;min-width:200px">${esc(d.item)}</td>
          <td style="white-space:nowrap">${esc(d.phone)}</td>
          <td><button class="btn g xs" data-act="dondel" data-v="${esc(d.id)}">삭제</button></td>
        </tr>`).join("")}</tbody></table></div>`}`;
}

/* ══════════ 직원 관리 ══════════ */
function adminStaff(A) {
  if (S.pre) return staffPreview(A);

  const act = A.employees.filter(isActive).length;
  const ret = A.employees.length - act;
  const accMap = Object.fromEntries(A.accounts.map((a) => [String(a.empNo), a]));
  const depts = [...new Set(A.employees.map((e) => e.dept).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ko"));
  const k = norm(S.q);
  const list = A.employees
    .filter((e) => (S.onlyActive ? isActive(e) : true))
    .filter((e) => !k || norm(e.name).includes(k) || String(e.empNo).includes(k) || norm(e.dept).includes(k))
    .sort((a, b) => String(a.dept).localeCompare(String(b.dept), "ko") || String(a.name).localeCompare(String(b.name), "ko"));

  const w = A.deptCheck;
  return `
    <div class="card">
      <h3>직원 명단 올리기</h3>
      <p class="cap">사번·이름·부서(병동)·연락처 열이 있는 엑셀(.xlsx)이나 CSV를 올리면 됩니다.
        올리면 먼저 <b>무엇이 바뀌는지 보여드리고</b>, 확인하신 뒤에 반영됩니다.</p>
      <div class="drop">
        <p>현재 재직 ${act}명${ret ? ` · 퇴사 ${ret}명` : ""}</p>
        <input type="file" accept=".xlsx,.xls,.csv" data-act="upemp" aria-label="직원 명단 올리기">
      </div>
    </div>
    ${(w.mixed.length || w.noName.length) ? `
      <div class="card" style="border-left:4px solid var(--color-warning)">
        <h3>부서 표기를 정리해 주세요</h3>
        <p class="cap">지금 명단에 표기가 갈리는 부서가 있습니다. 이대로면 병동별 제한이 제대로 걸리지 않습니다.</p>
        ${w.mixed.map((m) => Note("amber", `<b>${esc(m.ward)}병동</b> — ${m.forms.map((f) => `「${esc(f)}」`).join(" / ")}`)).join("")}
        ${w.noName.length ? Note("amber", `부서명 없이 번호만 — ${w.noName.map((f) => `「${esc(f)}」`).join(" / ")}`) : ""}
      </div>` : ""}
    <div class="sec"><h2>직원 ${list.length}명</h2>
      <div class="btns">
        <button class="btn g xs" data-act="addtoggle">${I.plus} 한 명 추가</button>
        <button class="btn g xs" data-act="expemp">${I.down} 엑셀</button>
      </div></div>
    ${S.adding ? addForm(depts) : ""}
    <div class="frow" style="margin-bottom:12px">
      <div class="f" style="margin-bottom:0"><label for="sq">검색 <span class="hint">이름 · 사번 · 부서</span></label>
        <input id="sq" class="in" value="${esc(S.q)}" placeholder="예: 10병동" data-act="search"></div>
      <div class="f" style="margin-bottom:0;align-self:flex-end"><div class="chips">
        <button class="chip ${S.onlyActive ? "on" : ""}" data-act="onlyact" data-v="1">재직 ${act}명</button>
        <button class="chip ${S.onlyActive ? "" : "on"}" data-act="onlyact" data-v="0">전체 ${A.employees.length}명</button>
      </div></div>
    </div>
    ${list.length === 0 ? Empty(I.people, "조건에 맞는 직원이 없습니다.") : `
      <div class="scrollx"><table class="tbl">
        <thead><tr><th>사번</th><th>이름</th><th>부서(병동)</th><th>연락처</th>
          <th>계정</th><th>올해 점수</th><th>처리</th></tr></thead>
        <tbody>${list.map((e) => {
          const a = accMap[String(e.empNo)];
          const on = S.editEmp === String(e.empNo) && S.ef;
          return `<tr${isActive(e) ? "" : ' style="opacity:.55"'}>
            <td>${esc(e.empNo)}</td>
            <td style="white-space:nowrap">${esc(e.name)}
              ${isActive(e) ? "" : `<span class="badge reserve" style="margin-left:6px">퇴사</span>`}</td>
            <td style="white-space:nowrap">${esc(e.dept)}</td>
            <td style="white-space:nowrap">${esc(e.phone)}</td>
            <td>${a
              ? `<span class="badge ${a.locked ? "rejected" : a.mustChange ? "pending" : "green"}">${
                  a.locked ? "잠김" : a.mustChange ? "변경 필요" : "사용 중"}</span>`
              : `<span class="badge reserve">없음</span>`}</td>
            <td>${scoreCell(A.scores[String(e.empNo)])}</td>
            <td style="white-space:nowrap">
              <button class="btn g xs" style="margin-right:6px" data-act="eedit" data-v="${esc(e.empNo)}">${on ? "접기" : "수정"}</button>
              <button class="btn g xs" style="margin-right:6px" data-act="eretire" data-v="${esc(e.empNo)}">${isActive(e) ? "퇴사" : "복직"}</button>
              <button class="btn g xs" data-act="ereset" data-v="${esc(e.empNo)}">${I.key}<span style="margin-left:5px">비번</span></button>
            </td></tr>
            ${on ? `<tr><td colspan="7" style="background:var(--color-field)">
              <div class="frow">
                <div class="f"><label>이름</label>
                  <input class="in" style="background:#fff" data-f="ef" data-k="name" value="${esc(S.ef.name)}"></div>
                <div class="f"><label>연락처</label>
                  <input class="in" style="background:#fff" data-f="ef" data-k="phone" value="${esc(S.ef.phone)}"></div>
              </div>
              ${deptField(S.ef.dept, depts, "ef")}
              <div class="btns" style="margin-bottom:12px">
                <button class="btn pt" data-act="eeditsave" data-v="${esc(e.empNo)}">저장</button>
                <button class="btn g" data-act="eeditcancel">취소</button>
                <span style="flex:1"></span>
                <button class="btn dg" data-act="edel" data-v="${esc(e.empNo)}">완전 삭제</button>
              </div></td></tr>` : ""}`;
        }).join("")}</tbody></table></div>`}
    ${Note("amber", "<b>퇴사와 완전 삭제는 다릅니다.</b> 퇴사는 로그인만 막고 봉사 실적을 남깁니다. 완전 삭제는 명단에서 지웁니다. 잘못 올린 자료가 아니라면 <b>퇴사</b>를 쓰세요.")}`;
}

function deptField(value, depts, ns) {
  const isEtc = value === "__etc" || (!!value && !depts.includes(value));
  const etcVal = value === "__etc" ? "" : value;
  return `<div class="f">
    <label>부서(병동) <span class="hint">목록에서 고르면 표기가 통일됩니다</span></label>
    <select class="in" style="background:#fff" data-f="${ns}" data-k="dept">
      <option value="">부서를 선택하세요</option>
      ${depts.map((d) => `<option value="${esc(d)}"${d === value ? " selected" : ""}>${esc(d)}</option>`).join("")}
      <option value="__etc"${isEtc ? " selected" : ""}>목록에 없음 · 직접 입력</option>
    </select>
    ${isEtc ? `<input class="in" style="margin-top:8px;background:#fff" data-f="${ns}" data-k="dept"
      value="${esc(etcVal)}" placeholder="예: 간호부 10병동">` : ""}
  </div>`;
}

function addForm(depts) {
  const n = S.nf || (S.nf = { empNo: "", name: "", dept: "", phone: "" });
  return `<div class="card">
    <h3>직원 한 명 추가</h3>
    <p class="cap">신규 입사자처럼 명단에 없는 직원을 한 명만 넣을 때 씁니다. 임시 비밀번호가 발급됩니다.</p>
    <div class="frow">
      <div class="f"><label>사번</label>
        <input class="in" data-f="nf" data-k="empNo" value="${esc(n.empNo)}"></div>
      <div class="f"><label>이름</label>
        <input class="in" data-f="nf" data-k="name" value="${esc(n.name)}"></div>
    </div>
    <div class="frow">
      ${deptField(n.dept, depts, "nf")}
      <div class="f"><label>연락처</label>
        <input class="in" data-f="nf" data-k="phone" value="${esc(n.phone)}" placeholder="010-0000-0000"></div>
    </div>
    <div class="btns">
      <button class="btn pt" data-act="eadd">계정 만들기</button>
      <button class="btn g" data-act="addtoggle">닫기</button>
    </div></div>`;
}

/* ── 업로드 미리보기 ── */
function staffPreview(A) {
  const P = S.pre, d = P.diff, o = S.preOpt;
  const tbl = (head, rows) => {
    const show = rows.slice(0, 50);
    return `<div class="scrollx"><table class="tbl">
      <thead><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
      <tbody>${show.map((r) => `<tr>${r.map((c) => `<td style="white-space:nowrap">${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody>
    </table></div>${rows.length > show.length
      ? `<p style="font-size:var(--fs-caption);color:var(--text-secondary);margin-top:6px">앞의 ${show.length}명만 보여드립니다. 전체 ${rows.length}명.</p>` : ""}`;
  };
  return `
    <div class="sec"><h2>업로드 미리보기</h2>
      <button class="btn g xs" data-act="precancel">취소</button></div>
    ${Note("", `<b>${esc(P.filename)}</b>에서 ${P.count}명을 읽었습니다. 아래 내용을 확인하고 맨 아래 [명단에 반영]을 누르면 적용됩니다. <b>누르기 전에는 아무것도 바뀌지 않습니다.</b>`)}
    ${P.dupCount ? Note("amber", `파일 안에 같은 사번이 ${P.dupCount}개 중복돼 있습니다. 마지막 줄을 기준으로 읽었습니다.`) : ""}
    <div class="kpis" style="margin-bottom:16px">
      <div class="kpi"><div class="k">신규</div><div class="v">${d.added.length}<small>명</small></div></div>
      <div class="kpi"><div class="k">정보 변경</div><div class="v">${d.changed.length}<small>명</small></div></div>
      <div class="kpi"><div class="k">그대로</div><div class="v">${d.same.length}<small>명</small></div></div>
      <div class="kpi"><div class="k">파일에 없음</div>
        <div class="v"${d.missing.length ? ' style="color:var(--on-tint-warning)"' : ""}>${d.missing.length}<small>명</small></div></div>
    </div>
    ${(P.check.mixed.length || P.check.noName.length) ? `
      <div class="card" style="border-left:4px solid var(--color-warning)">
        <h3>부서 표기 점검</h3>
        <p class="cap">병동 표기가 갈리면 병동별 제한 인원이 작동하지 않습니다. 올리기 전에 엑셀에서 고쳐 주세요.</p>
        ${P.check.mixed.map((m) => Note("amber", `<b>${esc(m.ward)}병동</b>이 ${m.forms.length}가지로 적혀 있습니다 — ${m.forms.map((f) => `「${esc(f)}」`).join(" / ")}`)).join("")}
        ${P.check.noName.length ? Note("amber", `부서명 없이 번호만 적힌 값이 있습니다 — ${P.check.noName.map((f) => `「${esc(f)}」`).join(" / ")}. <b>「간호부 10병동」</b>처럼 적어 주세요.`) : ""}
      </div>` : ""}
    ${d.added.length ? `<div class="sec"><h2>신규 ${d.added.length}명</h2></div>
      ${tbl(["사번", "이름", "부서(병동)", "연락처"], d.added.map((e) => [e.empNo, e.name, e.dept, e.phone]))}` : ""}
    ${d.changed.length ? `<div class="sec"><h2>정보가 바뀐 ${d.changed.length}명</h2></div>
      <div class="scrollx"><table class="tbl">
        <thead><tr><th>사번</th><th>이름</th><th>바뀌는 내용</th></tr></thead>
        <tbody>${d.changed.slice(0, 50).map((e) => `<tr>
          <td>${esc(e.empNo)}</td><td style="white-space:nowrap">${esc(e.name)}</td>
          <td>${e.fields.map(([f, a, b]) => `<div style="font-size:var(--fs-caption)">${esc(f)}
            <span style="color:var(--text-secondary);text-decoration:line-through">${esc(a || "(없음)")}</span>
            → <b style="font-weight:600">${esc(b || "(없음)")}</b></div>`).join("")}</td></tr>`).join("")}</tbody>
      </table></div>` : ""}
    ${d.missing.length ? `<div class="sec"><h2>파일에 없는 재직자 ${d.missing.length}명</h2></div>
      ${Note("amber", "현재 명단에는 있는데 이번 파일에는 없는 직원입니다. 퇴사했다면 아래에서 퇴사 처리하시고, <b>파일이 일부만 담긴 것이라면 체크하지 마세요.</b>")}
      ${tbl(["사번", "이름", "부서(병동)", "연락처"], d.missing.map((e) => [e.empNo, e.name, e.dept, e.phone]))}` : ""}
    ${d.back.length ? Note("", `퇴사 처리했던 ${d.back.length}명이 파일에 다시 들어 있어 재직으로 돌아옵니다 — ${d.back.slice(0, 5).map((e) => esc(e.name)).join(", ")}${d.back.length > 5 ? " 외" : ""}`) : ""}
    <div class="card">
      <h3>반영 방식</h3>
      <label class="opt"><input type="checkbox" data-act="optacc"${o.makeAcc ? " checked" : ""}>
        <span>신규 ${d.added.length}명의 <b>로그인 계정을 함께 만듭니다</b> (임시 비밀번호 발급)</span></label>
      <label class="opt"><input type="checkbox" data-act="optret"${o.retire ? " checked" : ""}${d.missing.length ? "" : " disabled"}>
        <span>파일에 없는 재직자 <b>${d.missing.length}명을 퇴사 처리</b>합니다${d.missing.length ? "" : " (해당 없음)"}</span></label>
      ${Note("amber", "퇴사 처리해도 봉사 내역과 지난 신청은 그대로 남습니다. 로그인만 막힙니다.")}
      <button class="cta" data-act="preapply"${S.busy ? " disabled" : ""}>
        ${S.busy ? "반영하는 중…" : `명단에 반영 — 신규 ${d.added.length} · 수정 ${d.changed.length}${o.retire && d.missing.length ? ` · 퇴사 ${d.missing.length}` : ""}`}</button>
    </div>`;
}

/* ══════════ 자료 관리 ══════════ */
function adminData(A) {
  return `
    ${Note("", "직원 명단은 <b>직원 관리</b> 탭에서 올립니다. 여기서는 봉사 내역만 다룹니다.")}
    <div class="card">
      <h3>직원 자원봉사 내역</h3>
      <p class="cap">사번·봉사일·봉사내용·봉사구분·봉사시간·인정횟수·지급포인트·포인트신청여부 열이 있는
        엑셀(.xlsx)이나 CSV를 올리면 됩니다. <b>올릴 때마다 전체가 교체됩니다.</b></p>
      <div class="drop">
        <p>현재 ${A.records.length.toLocaleString("ko-KR")}건 등록됨</p>
        <input type="file" accept=".xlsx,.xls,.csv" data-act="uprec" aria-label="봉사 내역 올리기">
      </div>
    </div>
    <div class="card">
      <h3>점수 환산 기준</h3>
      <p class="cap">이 기준으로 직원 화면의 점수가 계산됩니다.</p>
      ${Note("", `외부봉사 4시간 = 1점 · 내부봉사 2시간 = 0.5점(2건이면 1점) · 연간 의무 ${ANNUAL_DUTY}점 ·
        휴무·off·근무시간 외 봉사 1건당 ${won(POINT_PER_CASE)}포인트`)}
      ${Note("amber", "병동 표기는 <b>간호부 10병동</b>처럼 통일해 주세요. 10 / 10W / 10w가 섞이면 서로 다른 부서로 집계되어 병동별 제한이 작동하지 않습니다.")}
    </div>
    <div class="card">
      <h3>자료는 어디에 있나요</h3>
      <p class="cap">이 서버를 돌리는 PC 안에만 있습니다. 바깥으로 나가지 않습니다.</p>
      ${Note("", `폴더 안 <b>data/db.json</b> 파일 하나에 모두 들어 있습니다.
        <b>data/backup</b>에 하루 한 번 자동으로 복사본이 생기고 30일치를 보관합니다.
        접속 기록은 <b>data/log</b>에 날짜별로 쌓입니다.`)}
    </div>`;
}

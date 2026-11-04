/* ══════════════════════════════════════════════════════════════
   동작 연결
   ══════════════════════════════════════════════════════════════ */
"use strict";

const bucket = (f) => {
  if (f === "pf") return S.pf;
  if (f === "ef") return S.ef;
  if (f === "nf") return (S.nf = S.nf || { empNo: "", name: "", dept: "", phone: "" });
  const m = /^row(\d+)$/.exec(f);
  if (m && S.rows) return S.rows[Number(m[1])];
  return null;
};

/* 검색칸 — 입력칸은 절대 다시 그리지 않고, 아래 목록만 바꿉니다.
   (입력칸을 새로 그리면 한글 조합이 끊겨서 글자가 쪼개지고 커서가 튑니다) */
let searchTimer = 0;
function updateStaffList() {
  if (!S.admin) return;
  const box = document.getElementById("stafftable");
  const cnt = document.getElementById("empcount");
  if (box) {
    box.innerHTML = staffTable(S.admin);
    if (!reducedMotion() && box.animate) box.animate([{ opacity: .45 }, { opacity: 1 }], { duration: 160, easing: "ease-out" });
  }
  if (cnt) cnt.textContent = `직원 ${staffList(S.admin).length}명`;
}

/* 글자 입력은 다시 그리지 않는다 (입력칸에서 커서가 튀지 않도록) */
document.addEventListener("input", (e) => {
  const el = e.target;
  if (el.dataset.act === "search") {
    S.q = el.value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(updateStaffList, 120); // 타자를 칠 때마다가 아니라 잠깐 멈추면 목록 갱신
    return;
  }
  const f = el.dataset.f, k = el.dataset.k;
  if (!f || !k) return;
  const b = bucket(f);
  if (b) b[k] = el.value;
});

/* 선택 상자는 바뀌면 다시 그린다 (부서 직접 입력 칸이 나타나야 함) */
document.addEventListener("change", (e) => {
  const el = e.target;
  if (el.tagName === "SELECT" && el.dataset.f && el.dataset.k) {
    const b = bucket(el.dataset.f);
    if (b) { b[el.dataset.k] = el.value; if (el.dataset.k === "dept") render(); }
  }
  if (el.type === "file" && el.dataset.act) onFile(el.dataset.act, el.files && el.files[0], el);
  if (el.type === "checkbox" && el.dataset.act === "optacc") { S.preOpt.makeAcc = el.checked; render(); }
  if (el.type === "checkbox" && el.dataset.act === "optret") { S.preOpt.retire = el.checked; render(); }
});

document.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  const id = e.target.id;
  if (id === "lid") { e.preventDefault(); document.getElementById("lpw").focus(); }
  else if (id === "lpw") { e.preventDefault(); act("login"); }
  else if (id === "cp2") { e.preventDefault(); act("changepw"); }
});

document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-act]");
  if (!el || el.type === "file" || el.type === "checkbox") return;
  e.preventDefault();
  act(el.dataset.act, el.dataset);
});

/* ══════════ 동작 ══════════ */
async function act(a, d = {}) {
  const A = S.admin;
  try {
    switch (a) {

      /* ── 로그인 ── */
      case "login": {
        const id = document.getElementById("lid").value.trim();
        const pw = document.getElementById("lpw").value;
        if (!id) return fail("이름을 입력해 주세요.");
        if (!pw) return fail("비밀번호를 입력해 주세요.");
        S.busy = true; S.err = ""; render();
        try {
          const r = await api("/api/login", { id, pw });
          S.me = r.me; S.err = ""; S.busy = false;
          if (!S.me.mustChange) await refresh();
          render();
        } catch (err) { S.busy = false; fail(err.message); }
        return;
      }
      case "adminenter": {
        S.busy = true; S.err = ""; render();
        try {
          const r = await api("/api/admin-enter", {});
          S.me = r.me; S.busy = false;
          await refresh(); render();
        } catch (err) { S.busy = false; fail(err.message); }
        return;
      }
      case "logout":
        await api("/api/logout", {});
        Object.assign(S, { me: null, view: null, admin: null, err: "", msg: null, tab: "home", adminTab: "post", detail: null });
        return render();
      case "gochangepw": S.me = { ...S.me, mustChange: true }; S.err = ""; return render();
      case "changepw": {
        const cur = document.getElementById("cp0").value;
        const n1 = document.getElementById("cp1").value;
        const n2 = document.getElementById("cp2").value;
        if (n1 !== n2) return fail("새 비밀번호 확인이 맞지 않습니다.");
        S.busy = true; S.err = ""; render();
        try {
          await api("/api/password", { cur, next: n1 });
          S.busy = false; S.me = { ...S.me, mustChange: false };
          await refresh(); setMsg("", "비밀번호를 바꿨습니다."); render();
        } catch (err) { S.busy = false; fail(err.message); }
        return;
      }

      /* ── 직원 ── */
      case "tab": S.tab = d.v; S.detail = null; S.done = null; S.msg = null; S.err = ""; await refresh(); return render();
      case "open": S.detail = d.v; S.done = null; S.err = ""; return render();
      case "back": S.detail = null; S.done = null; S.err = ""; await refresh(); return render();
      case "apply": {
        const phone = (document.getElementById("dph") || {}).value || "";
        if (digits(phone).length < 9) return fail("연락처를 정확히 입력해 주세요.");
        S.busy = true; S.err = ""; render();
        try {
          const r = await api("/api/apply", { postId: d.v, phone });
          S.busy = false; S.view = pick(r); S.done = { status: r.status, order: r.order };
          render();
        } catch (err) { S.busy = false; fail(err.message); }
        return;
      }
      case "donate": {
        const item = (document.getElementById("ditem") || {}).value || "";
        if (!item.trim()) return fail("후원물품을 적어 주세요.");
        S.busy = true; S.err = ""; render();
        try {
          const r = await api("/api/donate", { item });
          S.busy = false; S.view = pick(r); S.err = "";
          setMsg("", "후원 물품을 접수했습니다. 사회사업실에서 확인 후 수령 방법을 안내드리겠습니다.");
          render();
        } catch (err) { S.busy = false; fail(err.message); }
        return;
      }

      /* ── 담당자 공통 ── */
      case "atab": S.adminTab = d.v; S.msg = null; S.pre = null; S.dups = null; S.editPost = null; S.editEmp = null; await refresh(); return render();
      case "reload": await refresh(); setMsg("", "최신 내용을 불러왔습니다."); return render();
      case "order": S.order = d.v; return render();
      case "filter": S.filter = d.v; return render();
      case "togdone": S.showDone = !S.showDone; S.editPost = null; return render();

      /* ── 공고 등록 ── */
      case "rowadd": S.rows.push(blankRow()); return render();
      case "rowdel": S.rows.splice(Number(d.v), 1); return render();
      case "rowreset":
        if (S.rows.some((r) => r.org.trim() || r.name.trim() || r.when)
          && !await ask("작성 중인 내용을 모두 지우고 처음부터 다시 쓸까요?")) return;
        S.rows = [blankRow()]; S.msg = null; return render();
      case "dl": S.rows[Number(d.i)].deadline = plusDays(Number(d.v)); return render();
      case "psave": {
        const rows = S.rows.map((r) => ({ ...r }));
        for (let i = 0; i < rows.length; i++) {
          const r = rows[i];
          if (!r.org.trim() || !r.name.trim() || !r.when || !r.deadline)
            return warn(`일정 ${i + 1}의 기관·자원봉사명·일시·모집 마감일을 모두 입력해 주세요.`);
        }
        await api("/api/admin/posting", { action: "create", rows });
        S.rows = [blankRow()];
        await refresh(); setMsg("", `${rows.length}건의 자원봉사를 등록했습니다.`); return render();
      }
      case "pedit": {
        if (S.editPost === d.v) { S.editPost = null; S.pf = null; return render(); }
        const p = A.postings.find((x) => x.id === d.v);
        S.editPost = d.v;
        S.pf = { org: p.org, name: p.name, when: p.when, deadline: p.deadline || "",
          type: p.type, hours: p.hours, capacity: p.capacity, deptLimit: p.deptLimit };
        return render();
      }
      case "peditcancel": S.editPost = null; S.pf = null; return render();
      case "peditsave":
        await api("/api/admin/posting", { action: "update", id: S.editPost, row: S.pf });
        S.editPost = null; S.pf = null;
        await refresh(); setMsg("", "공고를 수정했습니다."); return render();
      case "ptoggle":
        await api("/api/admin/posting", { action: "toggle", id: d.v });
        await refresh(); return render();
      case "pdel":
        if (!await ask("이 공고와 관련 신청 내역이 함께 지워집니다. 계속할까요?")) return;
        await api("/api/admin/posting", { action: "delete", id: d.v });
        await refresh(); setMsg("", "공고를 지웠습니다."); return render();
      case "pdup": {
        const p = A.postings.find((x) => x.id === d.v);
        S.showDone = false;
        S.rows = [...S.rows.filter((r) => r.org.trim() || r.name.trim() || r.when), {
          key: Math.random().toString(36).slice(2, 9), org: p.org, name: p.name,
          when: nextMonthWhen(p.when), deadline: plusDays(7),
          type: p.type, hours: p.hours, capacity: p.capacity, deptLimit: p.deptLimit }];
        setMsg("amber", `'${p.name}'을(를) 복사했습니다. 아래 등록 칸에서 일시를 확인하고 등록해 주세요.`);
        return render();
      }

      /* ── 승인 ── */
      case "status":
        await api("/api/admin/app-status", { ids: [d.v], status: d.s });
        await refresh(); return render();
      case "addapprove":
        if (!await ask(`${d.n} 님을 부서 할당을 넘겨 추가 승인할까요?`)) return;
        await api("/api/admin/app-status", { ids: [d.v], status: "approved" });
        await refresh(); setMsg("", `${d.n} 님을 추가 승인했습니다.`); return render();
      case "approveall": {
        const ids = A.apps.filter((x) => x.status === "pending").map((x) => x.id);
        if (!ids.length) return warn("승인 대기 중인 신청이 없습니다.");
        if (!await ask(`승인 대기 ${ids.length}건을 모두 승인할까요?`)) return;
        await api("/api/admin/app-status", { ids, status: "approved" });
        await refresh(); setMsg("", `${ids.length}건을 승인했습니다.`); return render();
      }

      /* ── 통계 ── */
      case "statyear": S.statYear = Number(d.v); return render();
      case "statcsv": {
        const T = calcStats(A, S.statYear || new Date().getFullYear());
        if (d.v === "dept") return downloadCsv(`부서별참여_${T.year}.csv`, T.depts.map((x) => ({
          "부서(병동)": x.dept, 직원수: x.n, 참여인원: x.joined, 참여율: pctOf(x.joined, x.n) + "%",
          의무달성: x.done, 평균점수: round2(x.score / x.n) })));
        return downloadCsv(`의무미충족자_${T.year}.csv`, T.shortList.map((p, i) => ({
          순번: i + 1, 이름: p.e.name, "부서(병동)": p.e.dept, 연락처: p.e.phone,
          [`${T.year}년 건수`]: p.cases, [`${T.year}년 점수`]: p.score })));
      }

      /* ── 내려받기 ── */
      case "pfinal": {
        const p = A.postings.find((x) => x.id === d.v);
        const rows = A.apps.filter((x) => x.postId === p.id && x.status === "approved")
          .sort((x, y) => String(x.appliedAt).localeCompare(String(y.appliedAt)))
          .map((x, i) => ({ 순번: i + 1, 이름: x.name, 사번: noText(x.empNo), "부서(병동)": x.dept,
            연락처: x.phone, 접수시각: fmtStamp(x.appliedAt),
            "올해 점수": (A.scores[String(x.empNo)] || {}).year || 0,
            자원봉사기관: p.org, 자원봉사명: p.name, 일시: fmtWhen(p.when), 구분: p.type, 시간: p.hours }));
        if (!rows.length) return warn("승인된 신청자가 없습니다.");
        return downloadCsv(`최종명단_${p.name}_${String(p.when).slice(0, 10).replace(/-/g, "")}.csv`, rows);
      }
      case "expfinal": {
        const pm = Object.fromEntries(A.postings.map((p) => [p.id, p]));
        const rows = A.apps.filter((x) => x.status === "approved")
          .sort((x, y) => String((pm[x.postId] || {}).when).localeCompare(String((pm[y.postId] || {}).when)))
          .map((x, i) => { const p = pm[x.postId] || {};
            return { 순번: i + 1, 자원봉사기관: p.org || "", 자원봉사명: p.name || "", 일시: fmtWhen(p.when),
              구분: p.type || "", 시간: p.hours || "", 이름: x.name, 사번: noText(x.empNo), "부서(병동)": x.dept,
              연락처: x.phone, 접수시각: fmtStamp(x.appliedAt),
              "올해 점수": (A.scores[String(x.empNo)] || {}).year || 0 }; });
        return downloadCsv(`자원봉사_최종명단_${plusDays(0)}.csv`, rows);
      }
      case "expall": {
        const pm = Object.fromEntries(A.postings.map((p) => [p.id, p]));
        const rows = A.apps.map((x, i) => { const p = pm[x.postId] || {};
          return { 순번: i + 1, 자원봉사기관: p.org || "", 자원봉사명: p.name || "", 일시: fmtWhen(p.when),
            이름: x.name, 사번: noText(x.empNo), 부서: x.dept, 연락처: x.phone,
            접수시각: fmtStamp(x.appliedAt), 상태: (STATUS[x.status] || {}).label || "" }; });
        return downloadCsv(`자원봉사_신청현황_${plusDays(0)}.csv`, rows);
      }
      case "expwb": {
        const pm = Object.fromEntries(A.postings.map((p) => [p.id, p]));
        const rows = A.apps.filter((x) => x.status === "approved").map((x) => {
          const p = pm[x.postId] || {};
          const m = String(x.dept || "").match(/^(\S+)\s+(.+병동)$/);
          return { 일자: String(p.when || "").slice(0, 10),
            대분류: p.type === "내부" ? "내부봉사" : "직원자원봉사",
            "사번 (입력)": noText(x.empNo), 직원이름: x.name,
            주부서: m ? m[1] : x.dept, 세부부서: m ? m[2].replace("병동", "") : "",
            봉사내용: p.name || "", 봉사장소: p.org || "",
            인정횟수: p.type === "내부" ? 0.5 : 1, "지급 포인트": 0, 전화번호: x.phone }; });
        return downloadCsv(`활동내역_추가분_${plusDays(0)}.csv`, rows);
      }
      case "expdon":
        return downloadCsv(`바자회_물품후원_${plusDays(0)}.csv`,
          A.donations.slice().sort((x, y) => String(y.at).localeCompare(String(x.at)))
            .map((x, i) => ({ 순번: i + 1, 등록일시: fmtStamp(x.at), 이름: x.name, 사번: noText(x.empNo),
              부서: x.dept, 연락처: x.phone, 후원물품: x.item })));
      case "expemp": {
        const accMap = Object.fromEntries(A.accounts.map((x) => [String(x.empNo), x]));
        return downloadCsv(`직원명단_${plusDays(0)}.csv`,
          A.employees.map((e, i) => ({ 순번: i + 1, 사번: noText(e.empNo), 이름: e.name, "부서(병동)": e.dept,
            연락처: e.phone, 재직구분: isActive(e) ? "재직" : "퇴사",
            계정: accMap[String(e.empNo)] ? "있음" : "없음",
            "올해 점수": (A.scores[String(e.empNo)] || {}).year || 0 })));
      }
      case "dondel":
        if (!await ask("이 후원 등록을 지울까요?")) return;
        await api("/api/admin/donation-delete", { id: d.v });
        await refresh(); return render();

      /* ── 직원 관리 ── */
      case "search": return;
      case "onlyact": S.onlyActive = d.v === "1"; return render();
      case "addtoggle": S.adding = !S.adding; S.msg = null; return render();
      case "eadd": {
        const n = S.nf || {};
        const dept = n.dept === "__etc" ? "" : (n.dept || "");
        if (!String(n.name || "").trim() || !dept.trim()
          || digits(n.phone).length < 9) return warn("이름·부서·연락처를 모두 입력해 주세요.");
        const body = { action: "create", empNo: n.empNo, name: n.name, dept, phone: n.phone };
        let r;
        try { r = await api("/api/admin/employee", body); }
        catch (e) {
          if (!e.needConfirm) throw e;
          if (!await ask(e.message, "다른 사람입니다. 추가")) return; // 이름만 같은 경우 담당자가 확인
          r = await api("/api/admin/employee", { ...body, force: true });
        }
        S.nf = { empNo: "", name: "", dept: "", phone: "" }; S.adding = false;
        await refresh();
        setMsg("amber", `${n.name} 님의 계정을 만들었습니다. 로그인 이름 ${n.name} / 비밀번호 ${r.pw}(연락처 뒷번호 4자리) — 본인에게 알려주세요.`);
        return render();
      }
      case "eedit": {
        if (S.editEmp === d.v) { S.editEmp = null; S.ef = null; return render(); }
        const e = A.employees.find((x) => String(x.empNo) === d.v);
        S.editEmp = d.v; S.ef = { name: e.name, dept: e.dept, phone: e.phone };
        return render();
      }
      case "eeditcancel": S.editEmp = null; S.ef = null; return render();
      case "eeditsave": {
        const f = S.ef;
        const dept = f.dept === "__etc" ? "" : (f.dept || "");
        if (!f.name.trim()) return warn("이름을 입력해 주세요.");
        if (!dept.trim()) return warn("부서를 선택하거나 입력해 주세요.");
        if (digits(f.phone).length < 9) return warn("연락처를 정확히 입력해 주세요.");
        await api("/api/admin/employee", { action: "update", empNo: d.v,
          name: f.name, dept, phone: f.phone });
        S.editEmp = null; S.ef = null;
        await refresh(); setMsg("", `${f.name} 님의 정보를 수정했습니다.`); return render();
      }
      case "eretire": {
        const e = A.employees.find((x) => String(x.empNo) === d.v);
        const to = isActive(e) ? "retire" : "restore";
        const label = to === "retire" ? "퇴사" : "재직";
        if (!await ask(`${e.name} 님을 ${label} 처리할까요?${to === "retire"
          ? " 로그인할 수 없게 되고 봉사 내역은 그대로 남습니다." : ""}`)) return;
        await api("/api/admin/employee", { action: to, empNo: d.v });
        await refresh(); setMsg("", `${e.name} 님을 ${label} 처리했습니다.`); return render();
      }
      case "edel": {
        const e = A.employees.find((x) => String(x.empNo) === d.v);
        if (!await ask(`${e.name} 님을 명단에서 완전히 지울까요?\n\n잘못 올린 자료일 때만 쓰세요. 퇴사한 직원은 [퇴사] 처리하셔야 실적이 남습니다.`)) return;
        await api("/api/admin/employee", { action: "delete", empNo: d.v });
        S.editEmp = null; S.ef = null;
        await refresh(); setMsg("", `${e.name} 님을 지웠습니다.`); return render();
      }
      case "ereset": {
        const e = A.employees.find((x) => String(x.empNo) === d.v);
        if (!await ask(`${e.name} 님의 비밀번호를 새로 발급할까요?\n화면에 뜨는 번호를 본인에게 알려주세요.`)) return;
        const r = await api("/api/admin/employee", { action: "resetPw", empNo: d.v });
        await refresh();
        setMsg("amber", `${e.name} 님의 새 비밀번호는 ${r.pw} 입니다. 본인에게 알려주세요. 첫 로그인 때 직접 바꾸게 됩니다.`);
        return render();
      }

      /* ── 중복 직원 찾기 · 합치기 ── */
      case "dupfind": {
        const r = await api("/api/admin/employee-dups");
        S.dups = r.groups; S.dres = {}; S.msg = null;
        if (!r.groups.length) setMsg("", "같은 사람으로 보이는 중복 직원이 없습니다.");
        return render();
      }
      case "dupclose": S.dups = null; S.dres = {}; return render();
      case "duprole": { // 이 직원을 남길지 / 대표에 합칠지 / 별개로 둘지
        const g = (S.dres[d.g] = S.dres[d.g] || { role: {}, vals: {} });
        if (d.v === "keep") for (const k of Object.keys(g.role)) if (g.role[k] === "keep") g.role[k] = "";
        g.role[d.e] = d.v; return render();
      }
      case "dupval": {
        const g = (S.dres[d.g] = S.dres[d.g] || { role: {}, vals: {} });
        g.vals[d.f] = d.v; return render();
      }
      case "dupmerge": {
        const grp = S.dups[Number(d.g)], g = S.dres[d.g];
        const keep = grp.members.find((m) => g.role[m.empNo] === "keep");
        const merge = grp.members.filter((m) => g.role[m.empNo] === "merge");
        if (!await ask(`${keep.name} 님 한 명으로 합칩니다. 합쳐진 직원 ${merge.length}명은 명단에서 사라지고, 봉사 내역·신청·계정은 남는 직원에게 이어집니다. 진행할까요?`, "합치기")) return;
        await api("/api/admin/employee-merge", { keep: keep.empNo, merge: merge.map((m) => m.empNo), values: g.vals });
        await refresh();
        const r = await api("/api/admin/employee-dups"); S.dups = r.groups; S.dres = {};
        setMsg("", `${keep.name} 님을 한 명으로 합쳤습니다.`); return render();
      }

      /* ── 업로드 ── */
      case "precancel": S.pre = null; S.preOpt = null; return render();
      /* 중복 확인: 이 줄이 기존의 누구와 같은 사람인지 (빈 값 = 다른 사람) */
      case "ressame": S.pre.res.same[d.kk] = d.v; return render();
      /* 값이 다를 때: 기존 값 / 새 값 */
      case "respick": {
        const m = (S.pre.res.pick[d.kk] = S.pre.res.pick[d.kk] || {});
        m[d.f] = d.v; return render();
      }
      case "resall": { // 남은 항목을 한꺼번에 (기존 값 / 새 값)
        for (const c of reviewState(S.pre).conflicts) for (const f of c.conflicts) {
          const m = (S.pre.res.pick[c.key] = S.pre.res.pick[c.key] || {});
          m[f.k] = d.v;
        }
        return render();
      }
      case "preapply": {
        if (reviewState(S.pre).pending) return warn("확인이 필요한 항목이 남았습니다. 위에서 모두 골라 주세요.");
        S.busy = true; render();
        try {
          const r = await api("/api/admin/apply-employees",
            { list: S.pre.list, retire: S.preOpt.retire, makeAcc: S.preOpt.makeAcc, res: S.pre.res });
          S.busy = false; S.pre = null; S.preOpt = null;
          await refresh();
          let m = `반영했습니다. 신규 ${r.added}명 · 기존 직원과 합침 ${r.merged || 0}명 · 정보 수정 ${r.changed}명`;
          if (r.assigned) m += ` · 봉사 내역에서 사번 ${r.assigned}명 가져옴`;
          if (r.retired) m += ` · 퇴사 처리 ${r.retired}명`;
          if (r.back) m += ` · 퇴사자 ${r.back}명이 재직으로 돌아왔습니다`;
          if (r.issued && r.issued.length) {
            m += `\n\n발급된 비밀번호(연락처 뒷번호 4자리) — ` +
              r.issued.map((x) => `${x.name} ${x.pw}`).join(" / ");
            downloadCsv(`신규계정_${plusDays(0)}.csv`,
              r.issued.map((x, i) => ({ 순번: i + 1, 사번: noText(x.empNo), 이름: x.name,
                "부서(병동)": x.dept, 임시비밀번호: x.pw })));
          }
          setMsg("amber", m); return render();
        } catch (err) { S.busy = false; return warn(err.message); }
      }
    }
  } catch (err) {
    S.busy = false;
    return warn(err.message);
  }
}

/* ══════════ 파일 올리기 ══════════ */
async function onFile(kind, file, el) {
  if (!file) return;
  el.value = "";
  const path = kind === "upemp" ? "/api/admin/upload?kind=employees" : "/api/admin/upload?kind=records";
  setMsg("", "파일을 읽는 중입니다…"); render();
  try {
    const r = await api(path, file, { raw: true, headers: { "x-filename": encodeURIComponent(file.name) } });
    if (kind === "upemp") {
      S.pre = { filename: r.filename, count: r.count, dupCount: r.dupCount,
        diff: r.diff, check: r.check, list: r.list,
        review: r.review || { suspects: [], conflicts: [] }, res: { same: {}, pick: {} } };
      S.preOpt = { retire: false, makeAcc: true };
      S.msg = null;
    } else {
      await refresh();
      const amb = r.ambiguous || [];
      setMsg(r.orphan || amb.length ? "amber" : "",
        `봉사 내역 ${r.count}건을 반영했습니다. 기존 내역은 이 파일로 교체되었습니다.`
        + (r.assigned ? ` 사번이 없던 직원 ${r.assigned}명은 이 파일에서 사번을 가져와 채웠습니다.` : "")
        + (r.mergedNos ? ` 사번이 바뀐 적 있는 ${r.mergedNos}건은 가장 최근 사번으로 합쳤습니다.` : "")
        + (amb.length ? ` 이름이 같은 사번이 여러 개라 정하지 못한 직원 ${amb.length}명 — ${amb.slice(0, 5).map((a) => a.name).join(", ")}${amb.length > 5 ? " 외" : ""}` : "")
        + (r.orphan ? ` 이 중 ${r.orphan}건은 직원 명단에 없는 사번입니다(퇴사자 또는 명단 누락).` : ""));
    }
    render();
  } catch (err) { warn(err.message); }
}

/* ══════════ 보조 ══════════ */
const fail = (m) => { S.err = m; render(); };
const warn = (m) => { setMsg("warn", m); render(); };
const pick = (r) => ({ me: r.me, postings: r.postings, apps: r.apps,
  takenMonths: r.takenMonths, records: r.records, summary: r.summary, donations: r.donations });

async function refresh() {
  if (!S.me) return;
  if (S.me.role === "admin") S.admin = await api("/api/admin/all");
  else S.view = pick(await api("/api/me"));
}

/* ══════════ 시작 ══════════ */
(async function boot() {
  try {
    const r = await api("/api/me");
    S.me = r.me;
    if (!S.me.mustChange) { if (S.me.role === "admin") await refresh(); else S.view = pick(r); }
  } catch { S.me = null; }
  render();
})();

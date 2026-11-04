/* ══════════════════════════════════════════════════════════════
   체험판 마무리 — events.js 다음에 넣습니다.
   체험 전용 단추 세 개를 덧붙이고, 체험 자료로 화면을 시작합니다.
   ══════════════════════════════════════════════════════════════ */
"use strict";

const baseAct = act;
act = async function (a, d = {}) {
  /* 체험 계정 목록 펼치기 */
  if (a === "toggleacc") { S.showAcc = !S.showAcc; return render(); }

  /* 누른 계정으로 바로 들어갑니다 */
  if (a === "fill") {
    S.err = ""; render();
    const id = document.getElementById("lid"), pw = document.getElementById("lpw");
    if (!id || !pw) return;
    id.value = d.v; pw.value = d.p;
    return baseAct("login");
  }

  /* 처음 상태로 되돌리기 */
  if (a === "resetdemo") {
    if (!await ask("체험하며 바꾸신 내용(신청·승인·공고·직원 정보)을 모두 지우고 처음 상태로 되돌립니다.\n계속할까요?", "되돌리기"))
      return;
    resetDemo();
    SESSION = null;
    Object.assign(S, { me: null, view: null, admin: null, err: "", msg: null,
      tab: "home", adminTab: "post", detail: null, done: null,
      pre: null, preOpt: null, rows: null, editPost: null, pf: null,
      editEmp: null, ef: null, adding: false, nf: null, showDone: false, q: "" });
    return render();
  }

  return baseAct(a, d);
};

/* 체험 자료로 화면을 시작합니다 */
render();

"use strict";
/* 발표 대본 PDF 만들기 — 발표자료(원스탑서비스-발표자료.html) 안의 슬라이드별 대본을 모아 PDF 로 냅니다.

     node presentation/build.js        (먼저 발표자료를 최신으로)
     node presentation/notes-pdf.js    → 원스탑서비스-발표대본.pdf

   개발용입니다(playwright 필요). 병원 PC 에는 필요 없습니다. */
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "원스탑서비스-발표자료.html");
const OUT = path.join(ROOT, "원스탑서비스-발표대본.pdf");

(async () => {
  const html = fs.readFileSync(SRC, "utf8");
  // 발표자료에 담긴 글꼴(@font-face)을 그대로 재사용
  const fontCss = html.slice(html.indexOf("<style>") + 7, html.indexOf(":root{"));
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto("file://" + SRC);
  await page.waitForTimeout(800);
  const data = await page.evaluate(() => {
    const clean = (h) => h.replace(/\s+/g, " ").trim();
    return {
      main: mainTotal,
      slides: slides.map((s, i) => ({
        n: i + 1, id: s.dataset.id, title: s.dataset.title, sec: s.dataset.sec, time: +s.dataset.time,
        demo: s.hasAttribute("data-demo"),
        notes: s.querySelector(".notes") ? s.querySelector(".notes").innerHTML.replace(/^\s+|\s+$/g, "") : "",
        steps: [...s.querySelectorAll(".step")].map((e) => [clean(e.querySelector("h4").textContent), clean(e.querySelector("p").textContent)]),
        qa: [...s.querySelectorAll("[data-qa]")].map((q) => [clean(q.querySelector("h3").textContent), clean(q.querySelector("[data-a]").innerHTML)]),
      })),
    };
  });

  const mmss = (sec) => `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
  let cum = 0;
  const rows = data.slides.slice(0, data.main).map((s) => { cum += s.time; return `<tr><td>${s.n}</td><td>${s.title}</td><td>${s.time}초</td><td>${mmss(cum)}</td></tr>`; }).join("");
  const total = cum;

  const body = data.slides.map((s) => {
    const appendix = s.n > data.main;
    const steps = s.steps.length ? `<div class="steps"><b>시연 단계</b> (→ 키를 누를 때마다 자동 진행)<ol>${s.steps.map(([h, p]) => `<li><b>${h}</b> — ${p}</li>`).join("")}</ol></div>` : "";
    const qa = s.qa.length ? `<div class="qa">${s.qa.map(([q, a]) => `<div class="q"><b>${q}</b><p>${a}</p></div>`).join("")}</div>` : "";
    return `<section class="sl ${appendix ? "ap" : ""}">
      <div class="hd"><span class="no">${appendix ? "부록" : `${s.n}/${data.main}`}</span><h2>${s.title}</h2>${s.time ? `<span class="tm">목표 ${s.time}초</span>` : ""}</div>
      ${s.sec ? `<div class="sec">${s.sec}</div>` : ""}
      <div class="nt">${s.notes || "<i>(대본 없음)</i>"}</div>${steps}${qa}</section>`;
  }).join("");

  const doc = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>
${fontCss}
@page{size:A4;margin:16mm 15mm 18mm}
*{box-sizing:border-box}
body{font-family:'Noto Sans KR','Malgun Gothic',sans-serif;color:#1F1D2B;font-size:11.5pt;line-height:1.75;word-break:keep-all}
b{font-weight:600}
h1{font-size:23pt;font-weight:600;line-height:1.28;margin:0 0 2pt}
h1 em{font-style:normal;color:#6E4FA8}
.sub{color:#6E6E82;font-size:12pt;margin-bottom:14pt}
.info{display:flex;gap:10pt;margin:8pt 0 8pt}
.info div{flex:1;background:#ECE6F6;border-radius:8pt;padding:8pt 12pt;font-size:10.5pt;line-height:1.5}
.info b{display:block;color:#6E4FA8;font-size:9pt;letter-spacing:.04em}
h3.t{font-size:12pt;font-weight:600;margin:10pt 0 4pt;color:#6E4FA8}
table{width:100%;border-collapse:collapse;font-size:9.5pt}
th{background:#6E4FA8;color:#fff;font-weight:600;text-align:left;padding:3.5pt 8pt}
td{padding:2.6pt 8pt;border-bottom:.5pt solid #ddd;line-height:1.4}
tr:nth-child(even) td{background:#F6F4FB}
td:first-child,td:nth-child(3),td:nth-child(4){white-space:nowrap}
tfoot td{font-weight:600;background:#ECE6F6!important}
.keys{font-size:9.5pt;line-height:1.75;color:#444}
.keys kbd{display:inline-block;min-width:22pt;text-align:center;padding:0 5pt;border:.6pt solid #B9A2DA;border-radius:4pt;background:#F6F4FB;font-family:inherit;font-size:9pt;margin-right:4pt}
.sl{break-inside:avoid;margin:0 0 12pt;border:.7pt solid #D9D0EC;border-radius:10pt;padding:10pt 14pt 11pt;background:#fff}
.sl.ap{background:#FAF9FD}
.hd{display:flex;align-items:center;gap:9pt}
.no{background:linear-gradient(135deg,#8E6BBF,#6E4FA8);color:#fff;border-radius:6pt;padding:1pt 8pt;font-size:9.5pt;font-weight:600;white-space:nowrap}
h2{font-size:13.5pt;font-weight:600;margin:0;flex:1}
.tm{font-size:9.5pt;color:#6E4FA8;font-weight:600;white-space:nowrap}
.sec{font-size:9pt;color:#8a8a9c;margin:1pt 0 0}
.nt{margin-top:7pt;font-size:11.5pt}
.nt b{color:#6E4FA8}
.steps{margin-top:8pt;background:#F6F4FB;border-radius:7pt;padding:6pt 12pt;font-size:10pt;line-height:1.6}
.steps ol{margin:3pt 0 0 14pt;padding:0}
.qa .q{margin-top:7pt;padding-top:6pt;border-top:.5pt dashed #ccc}
.qa .q p{margin:2pt 0 0;font-size:10.5pt}
.cover{break-after:page}
</style></head><body>
<div class="cover">
  <h1>직원 자원봉사모집<br><em>원스탑 서비스</em> — 발표 대본</h1>
  <div class="sub">2026 AI 실무활용 경진대회 · 예선전 · 효사랑가족요양병원 사회사업실</div>
  <div class="info">
    <div><b>발표 순서</b>2번 · 1번팀</div>
    <div><b>시간</b>발표 10분 + Q&amp;A 5분<br>(09:45–09:55 / 09:55–10:00)</div>
    <div><b>멘토</b>코어솔루션 전준호 팀장</div>
  </div>
  <h3 class="t">슬라이드별 시간 배분 (본 발표 ${data.main}장)</h3>
  <table><thead><tr><th>#</th><th>슬라이드</th><th>목표</th><th>누적</th></tr></thead><tbody>${rows}</tbody>
    <tfoot><tr><td></td><td>합계</td><td>${total}초</td><td>${mmss(total)}</td></tr></tfoot></table>
  <h3 class="t">발표자료 단축키</h3>
  <div class="keys"><kbd>→</kbd><kbd>Space</kbd> 다음 (항목 · 시연 단계 → 다음 슬라이드) &nbsp; <kbd>←</kbd> 이전<br>
    <kbd>N</kbd> 대본 보기 &nbsp; <kbd>T</kbd> 10분 타이머 &nbsp; <kbd>G</kbd> 슬라이드 목록 &nbsp; <kbd>F</kbd> 전체화면<br>
    <kbd>R</kbd> 시연 자료 처음으로 &nbsp; <kbd>B</kbd> 화면 끄기 &nbsp; <kbd>?</kbd> 도움말<br>
    시연 슬라이드는 <b>→</b> 를 누를 때마다 로그인 · 신청 · 승인이 자동으로 진행됩니다. 시연 중 이름은 모두 <b>가명</b>입니다.</div>
</div>
${body}
</body></html>`;

  await page.setContent(doc, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({
    path: OUT, format: "A4", printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: "<span></span>",
    footerTemplate: `<div style="width:100%;font-size:8px;color:#8a8a9c;text-align:center;font-family:sans-serif">원스탑 서비스 발표 대본 · <span class="pageNumber"></span> / <span class="totalPages"></span></div>`,
    margin: { top: "16mm", bottom: "18mm", left: "15mm", right: "15mm" },
  });
  await browser.close();
  console.log(`발표 대본 PDF를 만들었습니다 → ${path.basename(OUT)} (${(fs.statSync(OUT).size / 1024).toFixed(0)}KB)`);
})();

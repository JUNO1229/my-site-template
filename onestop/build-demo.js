/* ══════════════════════════════════════════════════════════════
   체험판 만들기 — public/ 의 실제 코드를 HTML 한 장으로 묶습니다.

     node build-demo.js

   결과: 원스탑서비스-체험판.html (서버 없이 브라우저만으로 돌아갑니다)
   ══════════════════════════════════════════════════════════════ */
"use strict";
const fs = require("node:fs");
const path = require("node:path");

const P = path.join(__dirname, "public");
const read = (f) => fs.readFileSync(path.join(P, f), "utf8");

/* 로고는 파일을 못 불러오므로 HTML 안에 글자로 심습니다 */
const emblem = "data:image/png;base64,"
  + fs.readFileSync(path.join(P, "emblem.png")).toString("base64");
const emb = (s) => s.split('"/emblem.png"').join(JSON.stringify(emblem));

/* 넣는 차례가 중요합니다.
   demo.js 는 app.js 의 api()·downloadCsv()·screenLogin() 을 덮어쓰므로 app.js 뒤에,
   demo-tail.js 는 events.js 의 act() 를 덮어쓰므로 events.js 뒤에 와야 합니다. */
const parts = [
  read("icons.js"),
  emb(read("app.js")),
  read("demo.js"),
  emb(read("admin.js")),
  read("events.js"),
  read("demo-tail.js"),
];

const html = `<title>원스탑 서비스 체험판</title>
<meta name="color-scheme" content="light">
<style>
/* 아티팩트 안에서도 앱 틀이 화면을 꽉 채우도록 맞춥니다 */
:root{height:100%;box-sizing:border-box;color-scheme:light}
body{height:100%;min-height:0}
${read("style.css")}
</style>
<div id="app"><div class="scroll-area"><div class="page">
  <div class="sk"></div><div class="sk"></div><div class="sk"></div>
</div></div></div>
${parts.map((s) => `<script>\n${s}\n</script>`).join("\n")}
`;

const out = path.join(__dirname, "원스탑서비스-체험판.html");
fs.writeFileSync(out, html);
if (html.includes("�")) {
  console.error("경고: 깨진 글자(U+FFFD)가 들어갔습니다. 원본 파일의 글자 인코딩을 확인해 주세요.");
  process.exit(1);
}
console.log("만들었습니다 —", path.basename(out),
  `(${(Buffer.byteLength(html) / 1024).toFixed(0)}KB)`);

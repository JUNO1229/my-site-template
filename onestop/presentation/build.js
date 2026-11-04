"use strict";
/* 발표자료 만들기 — 슬라이드 틀(template.html) + 체험판 + 글꼴 + 로고를 HTML 한 장으로 묶습니다.

     node presentation/build.js

   결과: 원스탑서비스-발표자료.html  (인터넷 없이, 이 파일 하나만으로 발표할 수 있습니다)
         public/presentation.html   (사이트에서도 열 수 있게 같은 파일을 복사)
   바깥 프로그램은 쓰지 않습니다. */
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "원스탑서비스-발표자료.html");

// 1) 체험판을 최신 코드로 다시 만든다
execFileSync(process.execPath, [path.join(ROOT, "build-demo.js")], { stdio: "ignore" });
const demo = fs.readFileSync(path.join(ROOT, "원스탑서비스-체험판.html"), "utf8");
let tpl = fs.readFileSync(path.join(__dirname, "template.html"), "utf8");

// 2) 로고
const emblem = "data:image/png;base64," + fs.readFileSync(path.join(ROOT, "public", "emblem.png")).toString("base64");

// 3) 글꼴 — 슬라이드와 체험판에 실제로 쓰이는 글자가 들어 있는 조각만 담습니다
const fontDir = path.join(ROOT, "public", "fonts");
const css = fs.readFileSync(path.join(fontDir, "noto-sans-kr.css"), "utf8");
const used = new Set();
for (const ch of tpl + demo) used.add(ch.codePointAt(0));
const inRange = (list) => list.split(",").some((r) => {
  const m = r.trim().match(/^U\+([0-9a-f?]+)(?:-([0-9a-f]+))?$/i);
  if (!m) return false;
  if (m[1].includes("?")) {
    const lo = parseInt(m[1].replace(/\?/g, "0"), 16), hi = parseInt(m[1].replace(/\?/g, "f"), 16);
    for (const c of used) if (c >= lo && c <= hi) return true;
    return false;
  }
  const lo = parseInt(m[1], 16), hi = m[2] ? parseInt(m[2], 16) : lo;
  for (const c of used) if (c >= lo && c <= hi) return true;
  return false;
});
let fontCss = "", kept = 0, bytes = 0;
for (const block of css.match(/@font-face\s*{[^}]*}/g) || []) {
  const file = (block.match(/url\(\.\/noto-sans-kr\/([^)]+)\)/) || [])[1];
  const range = (block.match(/unicode-range:\s*([^;]+);/) || [])[1];
  if (!file || !range || !inRange(range)) continue;
  const b64 = fs.readFileSync(path.join(fontDir, "noto-sans-kr", file)).toString("base64");
  fontCss += block.replace(/url\(\.\/noto-sans-kr\/[^)]+\)/, `url(data:font/woff2;base64,${b64})`) + "\n";
  kept++; bytes += b64.length;
}

// 4) 체험판 안에도 같은 글꼴을 넣는다 (슬라이드 안의 화면도 같은 글씨로 보이도록)
const demoFont = demo.replace("</head>", `<style>${fontCss}</style></head>`);
const demoB64 = Buffer.from(demoFont, "utf8").toString("base64");

// 5) 합치기
tpl = tpl.replace("{{FONT_CSS}}", () => fontCss).split("{{EMBLEM}}").join(emblem).replace("{{DEMO_B64}}", () => demoB64);
fs.writeFileSync(OUT, tpl);
fs.copyFileSync(OUT, path.join(ROOT, "public", "presentation.html"));
console.log(`발표자료를 만들었습니다 → ${path.basename(OUT)}  (${(fs.statSync(OUT).size / 1048576).toFixed(2)}MB · 글꼴 조각 ${kept}개)`);

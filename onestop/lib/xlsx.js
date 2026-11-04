"use strict";
/* 엑셀(.xlsx) 읽기 — 외부 라이브러리 없이 Node 기본 기능만 사용
   .xlsx는 XML 몇 개를 담은 zip 파일입니다. zlib으로 풀고 XML에서 값을 꺼냅니다. */

const zlib = require("node:zlib");

/* ── zip 풀기 (중앙 디렉터리 기준) ── */
function unzip(buf) {
  // EOCD(End Of Central Directory) 찾기 — 뒤에서부터
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 66000; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("엑셀 파일 형식이 아닙니다.");

  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16); // 중앙 디렉터리 시작

  const files = {};
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOff = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);

    // 로컬 헤더에서 실제 데이터 위치 계산
    const lNameLen = buf.readUInt16LE(localOff + 26);
    const lExtraLen = buf.readUInt16LE(localOff + 28);
    const start = localOff + 30 + lNameLen + lExtraLen;
    const raw = buf.subarray(start, start + compSize);

    try {
      files[name] = method === 0 ? raw : zlib.inflateRawSync(raw);
    } catch { /* 못 푸는 항목은 건너뛴다 */ }

    p += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

/* ── XML 도우미 ── */
function unescapeXml(s) {
  return s
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&");
}

/** <si> 하나에서 글자만 모은다 (서식이 섞여 <r><t> 여러 개로 쪼개질 수 있음) */
function siText(si) {
  let out = "";
  const re = /<t[^>]*>([\s\S]*?)<\/t>/g;
  let m;
  while ((m = re.exec(si))) out += unescapeXml(m[1]);
  return out;
}

/* ── 셀 주소 → 열 번호 (A→0, Z→25, AA→26) ── */
function colOf(ref) {
  const m = /^([A-Z]+)/.exec(ref);
  if (!m) return 0;
  let n = 0;
  for (const ch of m[1]) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/* ── 엑셀 일련번호 → yyyy-mm-dd ── */
function serialToDate(n) {
  // 엑셀은 1900-01-00을 1로 보고, 1900년 윤년 버그가 있어 보정이 필요하다
  const ms = Math.round((n - 25569) * 86400 * 1000);
  const d = new Date(ms);
  if (isNaN(d)) return String(n);
  const p = (x) => String(x).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}

/** 날짜 서식을 쓰는 스타일 번호를 모은다 */
function dateStyles(stylesXml) {
  if (!stylesXml) return new Set();
  const custom = new Set();
  const fmtRe = /<numFmt[^>]*numFmtId="(\d+)"[^>]*formatCode="([^"]*)"/g;
  let m;
  while ((m = fmtRe.exec(stylesXml))) {
    if (/[ymd]/.test(m[2].replace(/\[[^\]]*\]/g, "").replace(/"[^"]*"/g, ""))) custom.add(m[1]);
  }
  // 엑셀 기본 날짜 서식 번호
  for (const id of ["14", "15", "16", "17", "22", "27", "30", "36", "45", "46", "47", "50", "57", "58"]) custom.add(id);

  const xf = stylesXml.match(/<cellXfs[\s\S]*?<\/cellXfs>/);
  if (!xf) return new Set();
  const styles = new Set();
  const xfRe = /<xf[^>]*numFmtId="(\d+)"[^>]*\/?>/g;
  let i = 0, x;
  while ((x = xfRe.exec(xf[0]))) {
    if (custom.has(x[1])) styles.add(i);
    i++;
  }
  return styles;
}

/**
 * 엑셀 첫 번째 시트를 2차원 배열로 읽는다.
 * @param {Buffer} buf  .xlsx 파일 내용
 * @returns {string[][]} 행 배열
 */
function readSheet(buf) {
  const files = unzip(buf);

  // 공유 문자열
  const shared = [];
  const ss = files["xl/sharedStrings.xml"];
  if (ss) {
    const xml = ss.toString("utf8");
    const re = /<si>([\s\S]*?)<\/si>/g;
    let m;
    while ((m = re.exec(xml))) shared.push(siText(m[1]));
  }

  const dstyles = dateStyles(files["xl/styles.xml"]?.toString("utf8"));

  // 첫 번째 시트 찾기
  let sheetName = Object.keys(files).find((k) => /^xl\/worksheets\/sheet1\.xml$/.test(k));
  if (!sheetName) sheetName = Object.keys(files).find((k) => /^xl\/worksheets\/.*\.xml$/.test(k));
  if (!sheetName) throw new Error("시트를 찾지 못했습니다.");
  const xml = files[sheetName].toString("utf8");

  const rows = [];
  const rowRe = /<row[^>]*>([\s\S]*?)<\/row>/g;
  let r;
  while ((r = rowRe.exec(xml))) {
    const cells = [];
    const cellRe = /<c\s([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let c;
    while ((c = cellRe.exec(r[1]))) {
      const attrs = c[1] || "";
      const inner = c[2] || "";
      const ref = (/r="([A-Z]+\d+)"/.exec(attrs) || [])[1] || "";
      const type = (/t="([^"]+)"/.exec(attrs) || [])[1] || "n";
      const sIdx = Number((/s="(\d+)"/.exec(attrs) || [])[1] ?? -1);
      const idx = ref ? colOf(ref) : cells.length;

      let val = "";
      if (type === "inlineStr") {
        val = siText(inner);
      } else {
        const v = /<v>([\s\S]*?)<\/v>/.exec(inner);
        const raw = v ? unescapeXml(v[1]) : "";
        if (type === "s") val = shared[Number(raw)] ?? "";
        else if (type === "b") val = raw === "1" ? "TRUE" : "FALSE";
        else if (raw !== "" && dstyles.has(sIdx) && !isNaN(Number(raw))) val = serialToDate(Number(raw));
        else val = raw;
      }
      while (cells.length < idx) cells.push("");
      cells[idx] = String(val).trim();
    }
    rows.push(cells);
  }
  return rows;
}

/* ── CSV도 읽는다 (엑셀에서 CSV로 저장한 경우) ── */
function readCsv(buf) {
  let text;
  // BOM이 있으면 UTF-8, 없으면 UTF-8 시도 후 깨지면 EUC-KR
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    text = buf.toString("utf8").slice(1);
  } else {
    text = buf.toString("utf8");
    if (text.includes("�")) {
      try { text = new TextDecoder("euc-kr").decode(buf); } catch { /* 그대로 둔다 */ }
    }
  }
  const rows = [];
  let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else q = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"') { q = true; continue; }
    if (ch === ",") { row.push(cell.trim()); cell = ""; continue; }
    if (ch === "\n") { row.push(cell.trim()); rows.push(row); row = []; cell = ""; continue; }
    if (ch === "\r") continue;
    cell += ch;
  }
  if (cell || row.length) { row.push(cell.trim()); rows.push(row); }
  return rows;
}

/** 파일 이름을 보고 알맞게 읽는다 */
function readTable(buf, filename) {
  if (/\.csv$/i.test(filename || "")) return readCsv(buf);
  return readSheet(buf);
}

module.exports = { readSheet, readCsv, readTable };

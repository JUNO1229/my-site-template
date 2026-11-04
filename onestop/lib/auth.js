"use strict";
/* 로그인 — 비밀번호는 되돌릴 수 없는 형태(scrypt)로만 저장합니다.
   담당자도 직원 비밀번호를 볼 수 없고, 초기화만 할 수 있습니다. */

const crypto = require("node:crypto");
const store = require("./store");

const SESSION_HOURS = 12;
const MAX_FAIL = 5;          // 연속 실패 허용 횟수
const LOCK_MINUTES = 10;     // 잠기는 시간

/* ── 비밀번호 ── */
function hashPw(pw) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(String(pw), salt, 64).toString("hex");
  return { salt, hash };
}
function checkPw(pw, salt, hash) {
  if (!salt || !hash) return false;
  const a = crypto.scryptSync(String(pw), salt, 64);
  const b = Buffer.from(hash, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/* ── 세션 쿠키 (서명만 하고 서버에 저장하지 않음 → 재시작해도 유지) ── */
function sign(payload) {
  const db = store.get();
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const mac = crypto.createHmac("sha256", db.secret).update(body).digest("base64url");
  return `${body}.${mac}`;
}
function verify(token) {
  if (!token || !token.includes(".")) return null;
  const db = store.get();
  const [body, mac] = token.split(".");
  const want = crypto.createHmac("sha256", db.secret).update(body).digest("base64url");
  if (mac.length !== want.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(want))) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!p.exp || p.exp < Date.now()) return null;
    return p;
  } catch { return null; }
}
function makeSession(role, id) {
  return sign({ role, id, exp: Date.now() + SESSION_HOURS * 3600 * 1000 });
}

/* ── 잠금 ── */
function lockedFor(acc) {
  if (!acc?.lockedUntil) return 0;
  const left = acc.lockedUntil - Date.now();
  return left > 0 ? Math.ceil(left / 60000) : 0;
}
function noteFail(acc) {
  acc.failCount = (acc.failCount || 0) + 1;
  if (acc.failCount >= MAX_FAIL) {
    acc.lockedUntil = Date.now() + LOCK_MINUTES * 60 * 1000;
    acc.failCount = 0;
  }
}
function noteOk(acc) {
  acc.failCount = 0;
  acc.lockedUntil = 0;
  acc.lastLogin = new Date().toISOString();
}

/** 무작위 6자리 임시 비밀번호 */
const tempPw = () => String(crypto.randomInt(100000, 1000000));
/** 초기 비밀번호 = 연락처 뒷번호 4자리 (연락처가 4자리 미만이면 임의 6자리) */
const pwFromPhone = (phone) => {
  const d = String(phone ?? "").replace(/\D/g, "");
  return d.length >= 4 ? d.slice(-4) : tempPw();
};

module.exports = {
  hashPw, checkPw, makeSession, verify, lockedFor, noteFail, noteOk, tempPw, pwFromPhone,
  MAX_FAIL, LOCK_MINUTES, SESSION_HOURS,
};

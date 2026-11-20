// 비밀번호 보호: HMAC 서명 쿠키 (Web Crypto — middleware/서버 액션 공용)
export const COOKIE = "sl_session"
const enc = new TextEncoder()
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("")

async function hmac(secret: string, msg: string) {
  const k = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
  return hex(await crypto.subtle.sign("HMAC", k, enc.encode(msg)))
}
function secret() {
  const s = process.env.AUTH_SECRET
  if (!s || s.length < 16) throw new Error("AUTH_SECRET(16자 이상)이 필요합니다")
  return s
}
export async function createSession(days = 7) {
  const exp = String(Date.now() + days * 864e5)
  return `${exp}.${await hmac(secret(), exp)}`
}
export function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let d = 0
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return d === 0
}
export async function verifySession(token?: string) {
  if (!token) return false
  const [exp, sig] = token.split(".")
  if (!exp || !sig || Number(exp) < Date.now()) return false
  return safeEqual(sig, await hmac(secret(), exp))
}
/** 비밀번호 검증: 동일 길이 다이제스트 상수시간 비교 */
export async function passwordOk(input: string) {
  const p = process.env.APP_PASSWORD
  if (!p) return false
  return safeEqual(await hmac("pw-compare", input), await hmac("pw-compare", p))
}

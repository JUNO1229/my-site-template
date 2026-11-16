import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from 'crypto'
export const uid = () => crypto.randomUUID()
export const nowIso = () => new Date().toISOString()
export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')
export const newToken = () => randomBytes(32).toString('hex')
export const hashPassword = (p: string) => { const s = randomBytes(16).toString('hex'); return s + ':' + scryptSync(p, s, 32).toString('hex') }
export const checkPassword = (p: string, h: string) => {
  const [s, k] = h.split(':'); if (!s || !k) return false
  const a = scryptSync(p, s, 32), b = Buffer.from(k, 'hex'); return a.length === b.length && timingSafeEqual(a, b)
}
const secret = () => process.env.AUTH_SECRET || 'dev-only-secret-change-me'
export const sign = (obj: object) => { const p = Buffer.from(JSON.stringify(obj)).toString('base64url'); return p + '.' + createHmac('sha256', secret()).update(p).digest('base64url') }
export const unsign = <T,>(v?: string): T | null => {
  if (!v) return null; const [p, m] = v.split('.'); if (!p || !m) return null
  const e = createHmac('sha256', secret()).update(p).digest('base64url'); if (e !== m) return null
  try { return JSON.parse(Buffer.from(p, 'base64url').toString()) } catch { return null }
}
export const maskPhone = (p: string) => p.replace(/^(\d{3})-?\d{3,4}-?(\d{4})$/, '$1-****-$2')
export const normPhone = (p: string) => p.replace(/\D/g, '')
export const hoursFromNow = (h: number, from = Date.now()) => new Date(from + h * 3600e3).toISOString()

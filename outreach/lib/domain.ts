export const CHANNELS = ["email", "sms", "link", "post", "fax", "call"] as const
export type Channel = (typeof CHANNELS)[number]
export const CHANNEL_LABEL: Record<Channel, string> = {
  email: "이메일", sms: "문자/알림톡", link: "링크·QR", post: "우편", fax: "팩스", call: "전화" }
export const AUTO_CHANNELS: Channel[] = ["email", "sms", "link"]
export const STAGE_LABEL: Record<string, string> = {
  new: "대기", sent: "발송", viewed: "열람", replied: "회신", meeting: "미팅", won: "수주", lost: "실패" }

export type Lead = {
  id: number; org_name: string; org_type: string | null; sido: string | null; address: string | null
  contact_name: string | null; title: string | null; dept: string | null
  email: string | null; phone: string | null; mobile: string | null; fax: string | null; homepage: string | null
  grade: string | null; source: string; consent_email: boolean; consent_sms: boolean; do_not_contact: boolean
  unsubscribe_token: string; memo: string | null; tags?: string[] }

const norm = (s?: string | null) => (s ?? "").toLowerCase().replace(/[\s\-()·.]/g, "")
export const normEmail = (s?: string | null) => (s ?? "").trim().toLowerCase()
export const normPhone = (s?: string | null) => (s ?? "").replace(/[^\d+]/g, "")
export const dedupeKey = (org: string, email?: string | null, contact?: string | null) =>
  `${norm(org)}|${normEmail(email) || norm(contact)}`
export const isMobile = (p?: string | null) => /^01[016789]\d{7,8}$/.test(normPhone(p))
export const isEmail = (s?: string | null) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((s ?? "").trim())

/** 채널별 발송 가능 여부 — 연락금지/수신동의/연락처 유무 검사 */
export function eligibility(l: Lead, ch: Channel): { ok: boolean; to?: string; reason?: string } {
  if (l.do_not_contact) return { ok: false, reason: "연락금지(수신거부) 대상" }
  switch (ch) {
    case "email":
      if (!isEmail(l.email)) return { ok: false, reason: "이메일 없음" }
      if (!l.consent_email) return { ok: false, reason: "이메일 수신동의 없음" }
      return { ok: true, to: l.email!.trim() }
    case "sms": {
      const m = l.mobile || l.phone
      if (!isMobile(m)) return { ok: false, reason: "휴대폰 번호 없음" }
      if (!l.consent_sms) return { ok: false, reason: "문자 수신동의 없음" }
      return { ok: true, to: normPhone(m) }
    }
    case "link": return { ok: true, to: "link" }
    case "fax": return l.fax ? { ok: true, to: l.fax } : { ok: false, reason: "팩스번호 없음" }
    case "call": { const p = l.phone || l.mobile; return p ? { ok: true, to: p } : { ok: false, reason: "전화번호 없음" } }
    case "post": return l.address ? { ok: true, to: l.address } : { ok: false, reason: "주소 없음" }
  }
}
/** 대상자별 추천 채널 */
export function recommend(l: Lead): Channel {
  for (const c of ["email", "sms", "fax", "call", "post"] as Channel[]) if (eligibility(l, c).ok) return c
  return "link"
}

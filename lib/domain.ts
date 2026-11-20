// 순수 도메인 로직 (DB 비의존, 테스트 대상). 규정: sales-lead-system/docs/05_compliance.md

export const STAGES = ["new", "call_planned", "called", "doc_sent", "meeting", "pilot", "won", "lost", "do_not_contact"] as const
export type Stage = (typeof STAGES)[number]
export const STAGE_KO: Record<Stage, string> = {
  new: "신규", call_planned: "통화 예정", called: "통화 완료", doc_sent: "자료 발송", meeting: "미팅",
  pilot: "파일럿", won: "도입", lost: "보류/실패", do_not_contact: "연락 금지",
}
export const CHANNELS = ["call", "web_form", "post", "email", "sms", "fax"] as const
export type Channel = (typeof CHANNELS)[number]
export const CHANNEL_KO: Record<Channel, string> = { call: "전화", web_form: "문의폼", post: "우편", email: "이메일", sms: "문자", fax: "팩스" }
export const CONSENT_CHANNELS: Channel[] = ["email", "sms", "fax"] // 광고성 정보: 사전 수신 동의 필요
export const CONF_KO: Record<string, string> = {
  verified_official: "공식 확인", public_data: "공공데이터", third_party_recheck: "제3자(재확인)", unknown: "미상",
}
export const CONF_RANK: Record<string, number> = { verified_official: 3, public_data: 2, third_party_recheck: 1, unknown: 0 }
export const FOLLOWUP_DAYS = 7
export const SALES_CATS = ["ticketing", "facility_ops", "safety", "parking", "rental", "other"] as const

export class DispatchBlocked extends Error {}

/** 발송 가능 여부. 연락 금지는 전 채널 차단, 이메일·문자·팩스는 동의 필요. */
export function checkDispatchAllowed(o: { stage: string; consent_for_email: boolean }, channel: Channel) {
  if (o.stage === "do_not_contact") throw new DispatchBlocked("연락 금지(수신 거부) 리드입니다")
  if (CONSENT_CHANNELS.includes(channel) && !o.consent_for_email)
    throw new DispatchBlocked(`${CHANNEL_KO[channel]}은(는) 사전 수신 동의가 필요합니다. 최초 접촉은 전화·문의폼·우편을 이용하세요`)
}

/** 발송 기록 후 영업 단계: 앞선 단계(미팅 이상)는 되돌리지 않는다. */
export function stageAfterDispatch(current: Stage, channel: Channel): Stage {
  const target: Stage = channel === "call" ? "called" : "doc_sent"
  if (current === "new" || current === "call_planned") return target
  if (current === "called" && target === "doc_sent") return target
  return current
}

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
export const todayKST = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10)

export function followupAlert(nextOn: string, today: string): { days: number; label: string } {
  const days = Math.round((Date.parse(nextOn) - Date.parse(today)) / 86400e3)
  return { days, label: days < 0 ? "기한 경과" : days === 0 ? "오늘" : "임박" }
}

// ── 연락처 보강 ──
const PHONE_RX = /(?<![\d-])(?:0\d{1,2}-\d{3,4}-\d{4}|1[5-8]\d{2}-\d{4})(?![\d-])/g
export const isMobilePhone = (v: string) => /^01[016789]-?/.test(v.trim()) // 개인 휴대폰 저장 금지

export function extractPhones(html: string): string[] {
  const text = html.replace(/<[^>]+>/g, " ")
  return [...new Set(text.match(PHONE_RX) ?? [])].filter((p) => !isMobilePhone(p))
}

/** 최소 robots.txt 해석: User-agent:* 그룹의 Disallow 접두어. */
export function robotsAllows(robotsTxt: string, path: string): boolean {
  let applies = false, any = false
  let allowed = true, bestLen = -1
  for (const raw of robotsTxt.split(/\r?\n/)) {
    const line = raw.split("#")[0].trim()
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/)
    if (!m) continue
    const k = m[1].toLowerCase(), v = m[2].trim()
    if (k === "user-agent") { applies = v === "*"; any ||= applies }
    else if (applies && (k === "disallow" || k === "allow") && v) {
      if (path.startsWith(v) && v.length > bestLen) { bestLen = v.length; allowed = k === "allow" }
    }
  }
  return any ? allowed : true
}

// ── 영업 포인트 제안 (모두의 플랫폼 연계) ──
export const SALES_POINT_RULES = [
  { match: /물놀이|워터|해수욕장/, category: "safety", point: "다중 물놀이시설 미아·안전 관리 — 미아방지 QR 밴드 + 시설 운영 연계" },
  { match: /테마파크|리조트|동물원|수목원/, category: "ticketing", point: "유료 입장·티켓 통합 — 모두의티켓 연계(통합 발권·키오스크)" },
  { match: /테마파크|캠핑장|리조트/, category: "facility_ops", point: "시설운영(예약·체크인·부대시설) 통합 — 모두의 플랫폼 시설운영" },
  { match: /공원|축제|해수욕장/, category: "parking", point: "대형 인파 행사·주차 혼잡 — 주차/동선 관리 연계 검토" },
  { match: /레저|테마파크|캠핑장|물놀이/, category: "rental", point: "장비·보관함·튜브 대여 — 대여·결제 연계" },
]
export function suggestPoints(kind: string | null, name: string, have: string[]) {
  const text = `${kind ?? ""} ${name}`
  return SALES_POINT_RULES.filter((r) => r.match.test(text) && !have.includes(r.point))
}

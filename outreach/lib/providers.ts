// 외부 연동 어댑터. 키가 없으면 시뮬레이션 모드(실제 발송 없음)로 동작한다.
export type SendResult = { status: "sent" | "simulated" | "failed"; providerId?: string; error?: string }
export const providerStatus = () => ({
  email: !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM,
  sms: !!process.env.SOLAPI_API_KEY && !!process.env.SOLAPI_API_SECRET && !!process.env.SMS_SENDER,
  ocr: !!process.env.ANTHROPIC_API_KEY })

export async function sendEmail(to: string, subject: string, text: string, unsubUrl: string): Promise<SendResult> {
  if (!providerStatus().email) return { status: "simulated" }
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject, text: `${text}\n\n--\n수신거부: ${unsubUrl}`,
        headers: { "List-Unsubscribe": `<${unsubUrl}>` } }) })
    const j: any = await r.json().catch(() => ({}))
    return r.ok ? { status: "sent", providerId: j.id } : { status: "failed", error: j.message ?? `HTTP ${r.status}` }
  } catch (e: any) { return { status: "failed", error: String(e?.message ?? e) } }
}

// 문자: Solapi(SMS/LMS) HMAC 인증. 알림톡은 템플릿 승인 후 kakaoOptions 추가 필요(어댑터 확장 지점).
export async function sendSms(to: string, text: string): Promise<SendResult> {
  if (!providerStatus().sms) return { status: "simulated" }
  try {
    const { createHmac, randomBytes } = await import("crypto")
    const date = new Date().toISOString(), salt = randomBytes(16).toString("hex")
    const sig = createHmac("sha256", process.env.SOLAPI_API_SECRET!).update(date + salt).digest("hex")
    const r = await fetch("https://api.solapi.com/messages/v4/send", {
      method: "POST", headers: { "Content-Type": "application/json",
        Authorization: `HMAC-SHA256 apiKey=${process.env.SOLAPI_API_KEY}, date=${date}, salt=${salt}, signature=${sig}` },
      body: JSON.stringify({ message: { to, from: process.env.SMS_SENDER, text } }) })
    const j: any = await r.json().catch(() => ({}))
    return r.ok ? { status: "sent", providerId: j.groupId } : { status: "failed", error: j.errorMessage ?? `HTTP ${r.status}` }
  } catch (e: any) { return { status: "failed", error: String(e?.message ?? e) } }
}

export type CardFields = { org_name?: string; contact_name?: string; title?: string; dept?: string; email?: string
  phone?: string; mobile?: string; fax?: string; address?: string; homepage?: string }
/** 명함 이미지 → 필드 추출(Claude 비전). 키 없으면 null → 화면에서 수동 입력. */
export async function ocrCard(base64: string, mediaType: string): Promise<CardFields | null> {
  if (!providerStatus().ocr) return null
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST", headers: { "x-api-key": process.env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: process.env.OCR_MODEL || "claude-haiku-5-5", max_tokens: 600, messages: [{ role: "user", content: [
      { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
      { type: "text", text: "명함에서 정보를 추출해 JSON 한 개만 출력. 키: org_name, contact_name, title, dept, email, phone, mobile, fax, address, homepage. 없으면 생략. 설명 금지." }] }] }) })
  if (!r.ok) throw new Error(`OCR 실패 HTTP ${r.status}`)
  const j: any = await r.json()
  const t: string = j.content?.[0]?.text ?? ""
  const m = t.match(/\{[\s\S]*\}/)
  return m ? JSON.parse(m[0]) : {}
}

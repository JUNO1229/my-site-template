// 외부 연동 어댑터. 키가 없으면 시뮬레이션 모드(실제 발송 없음)로 동작한다.
export type SendResult = { status: "sent" | "simulated" | "failed"; providerId?: string; error?: string }
export const aiAvailable = () => !!process.env.GEMINI_API_KEY || !!process.env.ANTHROPIC_API_KEY
export const aiName = () => (process.env.GEMINI_API_KEY ? "Gemini" : process.env.ANTHROPIC_API_KEY ? "Claude" : null)
export const providerStatus = () => ({
  email: !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM,
  sms: !!process.env.SOLAPI_API_KEY && !!process.env.SOLAPI_API_SECRET && !!process.env.SMS_SENDER,
  ocr: aiAvailable() })

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


type AiFile = { mime: string; base64: string }
/** 공용 AI 호출: GEMINI_API_KEY 우선, 없으면 ANTHROPIC_API_KEY. 키가 없으면 null. */
export async function llm(prompt: string, files: AiFile[] = [], maxTokens = 4000): Promise<string | null> {
  if (process.env.GEMINI_API_KEY) {
    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash"
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST", headers: { "x-goog-api-key": process.env.GEMINI_API_KEY, "content-type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [...files.map((f) => ({ inline_data: { mime_type: f.mime, data: f.base64 } })), { text: prompt }] }],
        generationConfig: { maxOutputTokens: maxTokens, temperature: 0 } }) })
    const j: any = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(`Gemini 오류 (HTTP ${r.status}${j?.error?.message ? ": " + String(j.error.message).slice(0, 120) : ""})`)
    return (j.candidates?.[0]?.content?.parts ?? []).map((x: any) => x.text ?? "").join("")
  }
  if (process.env.ANTHROPIC_API_KEY) {
    const block = (f: AiFile) => f.mime === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: f.mime, data: f.base64 } }
      : { type: "image", source: { type: "base64", media_type: f.mime, data: f.base64 } }
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST", headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: process.env.OCR_MODEL || "claude-haiku-5-5", max_tokens: maxTokens, messages: [{ role: "user", content: [...files.map(block), { type: "text", text: prompt }] }] }) })
    if (!r.ok) throw new Error(`Claude 오류 (HTTP ${r.status})`)
    return ((await r.json()) as any).content?.map((c: any) => c.text ?? "").join("") ?? ""
  }
  return null
}

export type CardFields = { org_name?: string; contact_name?: string; title?: string; dept?: string; email?: string
  phone?: string; mobile?: string; fax?: string; address?: string; homepage?: string }
/** 명함 이미지 → 필드 추출. AI 키가 없으면 null → 화면에서 수동 입력. */
export async function ocrCard(base64: string, mediaType: string): Promise<CardFields | null> {
  const out = await llm("명함에서 정보를 추출해 JSON 한 개만 출력. 키: org_name, contact_name, title, dept, email, phone, mobile, fax, address, homepage. 없으면 생략. 설명 금지.", [{ mime: mediaType, base64 }], 800)
  if (out === null) return null
  const m = out.match(/\{[\s\S]*\}/)
  return m ? JSON.parse(m[0]) : {}
}

/** 스캔(이미지) PDF → 텍스트. AI 가 페이지 이미지를 직접 읽는다. 키가 없으면 null. */
export async function ocrPdf(buf: Buffer): Promise<string | null> {
  return llm("이 스캔 문서의 모든 페이지의 글자를 순서대로 그대로 옮겨 적어라. 표는 행 단위로 한 줄씩. 설명·요약·머리말 없이 본문 텍스트만 출력.",
    [{ mime: "application/pdf", base64: buf.toString("base64") }], 16000)
}

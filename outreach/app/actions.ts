"use server"
import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { COOKIE, createSession, passwordOk } from "@/lib/auth"
import { q } from "@/lib/db"
import { CHANNELS, dedupeKey, eligibility, isEmail, normEmail, normPhone, recommend, type Channel, type Lead } from "@/lib/domain"
import { allMatchingIds, type Filter } from "@/lib/queries"
import { ocrCard, sendEmail, sendSms, type CardFields } from "@/lib/providers"

const s = (f: FormData, k: string) => { const v = String(f.get(k) ?? "").trim(); return v || null }

export async function login(_: unknown, f: FormData) {
  if (!(await passwordOk(String(f.get("password") ?? "")))) return { error: "비밀번호가 올바르지 않습니다" }
  ;(await cookies()).set(COOKIE, await createSession(), { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 7 * 86400 })
  redirect("/")
}
export async function logout() { (await cookies()).delete(COOKIE); redirect("/login") }

// ───────── 리드 ─────────
export type LeadInput = {
  org_name: string; org_type?: string | null; sido?: string | null; address?: string | null
  contact_name?: string | null; title?: string | null; dept?: string | null
  email?: string | null; phone?: string | null; mobile?: string | null; fax?: string | null; homepage?: string | null
  grade?: string | null; consent_email?: boolean; consent_sms?: boolean; memo?: string | null; tags?: string[] }

async function upsertLead(i: LeadInput, source: "manual" | "upload" | "card" | "public", note?: string) {
  const org = i.org_name?.trim()
  if (!org) throw new Error("기관명 필수")
  const email = isEmail(i.email) ? normEmail(i.email) : null
  const key = dedupeKey(org, email, i.contact_name)
  const grade = i.grade && ["A", "B", "C"].includes(i.grade.toUpperCase()) ? i.grade.toUpperCase() : null
  const rows = await q<{ id: number; inserted: boolean }>(
    `INSERT INTO leads (org_name,org_type,sido,address,contact_name,title,dept,email,phone,mobile,fax,homepage,grade,source,source_note,consent_email,consent_sms,memo,dedupe_key)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
     ON CONFLICT (dedupe_key) DO UPDATE SET
       org_type=COALESCE(EXCLUDED.org_type,leads.org_type), sido=COALESCE(EXCLUDED.sido,leads.sido), address=COALESCE(EXCLUDED.address,leads.address),
       title=COALESCE(EXCLUDED.title,leads.title), dept=COALESCE(EXCLUDED.dept,leads.dept), phone=COALESCE(EXCLUDED.phone,leads.phone),
       mobile=COALESCE(EXCLUDED.mobile,leads.mobile), fax=COALESCE(EXCLUDED.fax,leads.fax), homepage=COALESCE(EXCLUDED.homepage,leads.homepage),
       grade=COALESCE(EXCLUDED.grade,leads.grade), updated_at=now()
     RETURNING id, (xmax = 0) AS inserted`,
    [org, i.org_type || null, i.sido || null, i.address || null, i.contact_name || null, i.title || null, i.dept || null, email,
     normPhone(i.phone) || null, normPhone(i.mobile) || null, normPhone(i.fax) || null, i.homepage || null, grade, source, note || null,
     !!i.consent_email, !!i.consent_sms, i.memo || null, key])
  const { id, inserted } = rows[0]
  for (const t of i.tags ?? []) {
    const name = t.trim(); if (!name) continue
    await q(`INSERT INTO tags(name) VALUES($1) ON CONFLICT DO NOTHING`, [name])
    await q(`INSERT INTO lead_tags(lead_id,tag_id) SELECT $1, id FROM tags WHERE name=$2 ON CONFLICT DO NOTHING`, [id, name])
  }
  return { id, inserted }
}

const fromForm = (f: FormData): LeadInput => ({
  org_name: s(f, "org_name") ?? "", org_type: s(f, "org_type"), sido: s(f, "sido"), address: s(f, "address"),
  contact_name: s(f, "contact_name"), title: s(f, "title"), dept: s(f, "dept"), email: s(f, "email"), phone: s(f, "phone"),
  mobile: s(f, "mobile"), fax: s(f, "fax"), homepage: s(f, "homepage"), grade: s(f, "grade"), memo: s(f, "memo"),
  consent_email: f.get("consent_email") === "on", consent_sms: f.get("consent_sms") === "on",
  tags: (s(f, "tags") ?? "").split(/[,，]/).map((x) => x.trim()).filter(Boolean) })

export async function createLead(_: unknown, f: FormData) {
  try {
    const { inserted } = await upsertLead(fromForm(f), f.get("from_card") === "1" ? "card" : "manual")
    revalidatePath("/leads")
    return { ok: true, message: inserted ? "등록되었습니다" : "이미 있는 대상이라 정보를 병합했습니다" }
  } catch (e: any) { return { error: e.message as string } }
}

/** 엑셀/CSV 일괄 적재 (브라우저에서 파싱한 행을 배치로 전달) */
export async function importLeads(rows: LeadInput[], tags: string[], consentEmail: boolean, consentSms: boolean, filename: string) {
  let inserted = 0, merged = 0, failed = 0; const errors: string[] = []
  for (const [i, r] of rows.entries()) {
    try {
      const res = await upsertLead({ ...r, consent_email: consentEmail && !!r.email, consent_sms: consentSms, tags: [...(r.tags ?? []), ...tags] }, "upload", filename)
      res.inserted ? inserted++ : merged++
    } catch (e: any) { failed++; if (errors.length < 5) errors.push(`${i + 1}행: ${e.message}`) }
  }
  revalidatePath("/leads")
  return { inserted, merged, failed, errors }
}

export async function extractCard(f: FormData): Promise<{ fields: CardFields | null; error?: string }> {
  const file = f.get("image") as File | null
  if (!file || !file.size) return { fields: null, error: "이미지가 없습니다" }
  if (file.size > 4.5 * 1024 * 1024) return { fields: null, error: "이미지는 4.5MB 이하여야 합니다" }
  try {
    const b64 = Buffer.from(await file.arrayBuffer()).toString("base64")
    return { fields: await ocrCard(b64, file.type || "image/jpeg") }
  } catch (e: any) { return { fields: null, error: e.message } }
}

export async function updateLeadFlags(id: number, patch: { consent_email?: boolean; consent_sms?: boolean; do_not_contact?: boolean }) {
  const sets: string[] = []; const p: unknown[] = []
  for (const [k, v] of Object.entries(patch)) if (typeof v === "boolean") { p.push(v); sets.push(`${k}=$${p.length}`) }
  if (!sets.length) return
  p.push(id); await q(`UPDATE leads SET ${sets.join(",")}, updated_at=now() WHERE id=$${p.length}`, p)
  revalidatePath("/leads")
}
export async function addTagsToLeads(ids: number[], tagsText: string) {
  const tags = tagsText.split(/[,，]/).map((x) => x.trim()).filter(Boolean)
  for (const t of tags) {
    await q(`INSERT INTO tags(name) VALUES($1) ON CONFLICT DO NOTHING`, [t])
    await q(`INSERT INTO lead_tags(lead_id,tag_id) SELECT x, (SELECT id FROM tags WHERE name=$2) FROM unnest($1::int[]) x ON CONFLICT DO NOTHING`, [ids, t])
  }
  revalidatePath("/leads")
}

// ───────── 프로젝트 ─────────
export async function createProject(f: FormData) {
  const name = s(f, "name"); if (!name) return
  const [p] = await q<{ id: number }>(`INSERT INTO projects(name,product,description) VALUES($1,$2,$3) RETURNING id`, [name, s(f, "product"), s(f, "description")])
  redirect(`/projects/${p.id}`)
}
async function attach(projectId: number, ids: number[]) {
  if (!ids.length) return 0
  const leads = await q<Lead>(`SELECT * FROM leads WHERE id = ANY($1::int[]) AND do_not_contact=false`, [ids])
  for (const l of leads)
    await q(`INSERT INTO project_leads(project_id,lead_id,channel) VALUES($1,$2,$3) ON CONFLICT DO NOTHING`, [projectId, l.id, recommend(l)])
  revalidatePath(`/projects/${projectId}`)
  return leads.length
}
export async function addSelectedToProject(projectId: number, ids: number[]) { return attach(projectId, ids) }
/** 현재 필터 결과 전체를 프로젝트에 추가 (프로젝트 미포함 대상만, 최대 2000건) */
export async function addFilteredToProject(projectId: number, filter: Filter) {
  const ids = (await allMatchingIds({ ...filter, notin: String(projectId) })).slice(0, 2000)
  return attach(projectId, ids)
}
export async function removeFromProject(projectId: number, leadIds: number[]) {
  await q(`DELETE FROM project_leads WHERE project_id=$1 AND lead_id = ANY($2::int[])`, [projectId, leadIds]); revalidatePath(`/projects/${projectId}`)
}
export async function setChannel(projectId: number, leadIds: number[], channel: Channel) {
  if (!CHANNELS.includes(channel)) return
  await q(`UPDATE project_leads SET channel=$3 WHERE project_id=$1 AND lead_id = ANY($2::int[])`, [projectId, leadIds, channel]); revalidatePath(`/projects/${projectId}`)
}
export async function setStage(projectId: number, leadId: number, stage: string) {
  await q(`UPDATE project_leads SET stage=$3 WHERE project_id=$1 AND lead_id=$2`, [projectId, leadId, stage]); revalidatePath(`/projects/${projectId}`)
}

// ───────── 자료 ─────────
export async function createMaterial(f: FormData) {
  const name = s(f, "name"); if (!name) return
  await q(`INSERT INTO materials(name,kind,url,subject,body) VALUES($1,$2,$3,$4,$5)`, [name, s(f, "kind") ?? "link", s(f, "url"), s(f, "subject"), s(f, "body")])
  revalidatePath("/materials")
}
export async function deleteMaterial(id: number) { await q(`DELETE FROM materials WHERE id=$1`, [id]); revalidatePath("/materials") }

// ───────── 발송 ─────────
async function baseUrl() {
  const h = await headers(); const host = h.get("x-forwarded-host") ?? h.get("host")
  return process.env.PUBLIC_BASE_URL || `https://${host}`
}
const fill = (t: string, l: Lead, link: string) =>
  t.replaceAll("{{기관명}}", l.org_name).replaceAll("{{담당자}}", l.contact_name ?? "담당자").replaceAll("{{링크}}", link)

export type SendReport = { sent: number; simulated: number; recorded: number; blocked: number; failed: number; details: string[] }

/** 프로젝트 대상 중 선택된 대상에게 자료 발송. 채널은 대상자별 설정(channel)을 따른다. */
export async function dispatchMaterial(projectId: number, materialId: number, leadIds: number[]): Promise<SendReport> {
  const rep: SendReport = { sent: 0, simulated: 0, recorded: 0, blocked: 0, failed: 0, details: [] }
  if (leadIds.length > 100) { rep.details.push("한 번에 100건까지 발송할 수 있습니다"); return rep }
  const [m] = await q<any>(`SELECT * FROM materials WHERE id=$1`, [materialId]); if (!m) return rep
  const base = await baseUrl()
  const rows = await q<Lead & { channel: Channel }>(
    `SELECT l.*, pl.channel FROM leads l JOIN project_leads pl ON pl.lead_id=l.id AND pl.project_id=$1 WHERE l.id = ANY($2::int[])`, [projectId, leadIds])
  for (const l of rows) {
    const ch = l.channel, el = eligibility(l, ch)
    const [{ token }] = await q<{ token: string }>(`INSERT INTO dispatches(project_id,lead_id,material_id,channel,status,to_value) VALUES($1,$2,$3,$4,'blocked',$5) RETURNING token`, [projectId, l.id, materialId, ch, el.to ?? null])
    const link = `${base}/s/${token}`
    const finish = (status: string, error?: string | null, pid?: string | null) =>
      q(`UPDATE dispatches SET status=$2, error=$3, provider_id=$4 WHERE token=$1`, [token, status, error ?? null, pid ?? null])
    if (!el.ok) { await finish("blocked", el.reason); rep.blocked++; rep.details.push(`${l.org_name}: ${el.reason}`); continue }
    if (ch === "email") {
      const r = await sendEmail(el.to!, fill(m.subject || m.name, l, link), fill(m.body || "자료를 보내드립니다: {{링크}}", l, link), `${base}/u/${l.unsubscribe_token}`)
      await finish(r.status, r.error, r.providerId); rep[r.status]++; if (r.error) rep.details.push(`${l.org_name}: ${r.error}`)
    } else if (ch === "sms") {
      const r = await sendSms(el.to!, fill(m.body || "자료 안내: {{링크}}", l, link) + "\n(수신거부는 담당자에게 회신)")
      await finish(r.status, r.error, r.providerId); rep[r.status]++; if (r.error) rep.details.push(`${l.org_name}: ${r.error}`)
    } else { await finish("recorded"); rep.recorded++ }   // link/post/fax/call: 기록(링크는 /s/토큰 으로 열람 추적)
    await q(`UPDATE project_leads SET stage='sent' WHERE project_id=$1 AND lead_id=$2 AND stage='new'`, [projectId, l.id])
  }
  revalidatePath(`/projects/${projectId}`); revalidatePath("/dispatches")
  return rep
}

export async function unsubscribe(token: string) {
  await q(`UPDATE leads SET do_not_contact=true, consent_email=false, consent_sms=false, updated_at=now() WHERE unsubscribe_token=$1`, [token])
}

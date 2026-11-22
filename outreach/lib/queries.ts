import { q } from "./db"
import type { Lead } from "./domain"

export type Filter = { q?: string; sido?: string; org_type?: string; grade?: string; tag?: string; source?: string
  consent?: string; contact?: string; notin?: string; page?: string }

export function buildWhere(f: Filter) {
  const w: string[] = ["l.do_not_contact = false"]; const p: unknown[] = []
  const add = (sql: string, v: unknown) => { p.push(v); w.push(sql.replace("?", `$${p.length}`)) }
  if (f.q) { p.push(`%${f.q}%`); const n = p.length
    w.push(`(l.org_name ILIKE $${n} OR l.contact_name ILIKE $${n} OR l.email ILIKE $${n} OR l.address ILIKE $${n})`) }
  if (f.sido) add("l.sido = ?", f.sido)
  if (f.org_type) add("l.org_type = ?", f.org_type)
  if (f.grade) add("l.grade = ?", f.grade)
  if (f.source) add("l.source = ?", f.source)
  if (f.tag) add("EXISTS (SELECT 1 FROM lead_tags lt JOIN tags t ON t.id=lt.tag_id WHERE lt.lead_id=l.id AND t.name = ?)", f.tag)
  if (f.consent === "email") w.push("l.consent_email AND l.email IS NOT NULL")
  if (f.consent === "sms") w.push("l.consent_sms AND (l.mobile IS NOT NULL OR l.phone IS NOT NULL)")
  if (f.contact === "email") w.push("l.email IS NOT NULL AND l.email <> ''")
  if (f.contact === "phone") w.push("(l.phone IS NOT NULL OR l.mobile IS NOT NULL)")
  if (f.notin) add("NOT EXISTS (SELECT 1 FROM project_leads pl WHERE pl.lead_id=l.id AND pl.project_id = ?)", Number(f.notin))
  return { where: w.join(" AND "), params: p }
}

export const SEL = `l.*, COALESCE((SELECT array_agg(t.name ORDER BY t.name) FROM lead_tags lt JOIN tags t ON t.id=lt.tag_id WHERE lt.lead_id=l.id),'{}') AS tags`
export const PAGE = 50
export async function searchLeads(f: Filter) {
  const { where, params } = buildWhere(f)
  const off = Math.max(0, (Number(f.page) || 1) - 1) * PAGE
  const [{ n }] = await q<{ n: string }>(`SELECT count(*) n FROM leads l WHERE ${where}`, params)
  const rows = await q<Lead>(`SELECT ${SEL} FROM leads l WHERE ${where} ORDER BY l.grade NULLS LAST, l.org_name LIMIT ${PAGE} OFFSET ${off}`, params)
  return { rows, total: Number(n) }
}
export async function allMatchingIds(f: Filter) {
  const { where, params } = buildWhere(f)
  return (await q<{ id: number }>(`SELECT l.id FROM leads l WHERE ${where}`, params)).map((r) => r.id)
}
export async function facets() {
  const d = async (col: string) => (await q<{ v: string }>(`SELECT DISTINCT ${col} v FROM leads WHERE ${col} IS NOT NULL AND ${col}<>'' ORDER BY 1`)).map((r) => r.v)
  return { sido: await d("sido"), org_type: await d("org_type"),
    tags: (await q<{ name: string }>(`SELECT name FROM tags ORDER BY name`)).map((r) => r.name) }
}

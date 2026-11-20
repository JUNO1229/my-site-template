import { one, query } from "./db"
import {
  CONF_RANK, DispatchBlocked, FOLLOWUP_DAYS, STAGES, addDays, checkDispatchAllowed, followupAlert, isMobilePhone,
  stageAfterDispatch, todayKST, type Channel, type Stage,
} from "./domain"

const D = (c: string) => `to_char(${c},'YYYY-MM-DD')`
const RANK = `CASE c.confidence WHEN 'verified_official' THEN 3 WHEN 'public_data' THEN 2 WHEN 'third_party_recheck' THEN 1 ELSE 0 END`

export type LeadFilter = {
  grades?: string[]; sido?: string; kind?: string; stage?: string; phone?: "has" | "none"; q?: string; mobile?: boolean
  page?: number; pageSize?: number
}

export async function listLeads(f: LeadFilter = {}) {
  const a: unknown[] = []
  const w: string[] = []
  const p = (v: unknown) => (a.push(v), `$${a.length}`)
  if (f.grades?.length) w.push(`l.grade = ANY(${p(f.grades)})`)
  if (f.sido) w.push(`l.sido = ${p(f.sido)}`)
  if (f.kind) w.push(`l.facility_kind = ${p(f.kind)}`)
  if (f.stage) w.push(`o.stage = ${p(f.stage)}`)
  if (f.q) w.push(`l.name ILIKE ${p(`%${f.q}%`)}`)
  if (!f.mobile) w.push(`l.is_mobile_or_event = false`)
  if (f.phone === "has") w.push(`bc.value IS NOT NULL`)
  if (f.phone === "none") w.push(`bc.value IS NULL`)
  const where = w.length ? `WHERE ${w.join(" AND ")}` : ""
  const from = `FROM leads l JOIN outreach o ON o.lead_id=l.id
    LEFT JOIN LATERAL (SELECT c.value, c.confidence FROM contacts c WHERE c.lead_id=l.id AND c.channel='phone' ORDER BY ${RANK} DESC, c.id LIMIT 1) bc ON true ${where}`
  const total = Number((await one(`SELECT COUNT(*)::int AS n ${from}`, a))!.n)
  const size = f.pageSize ?? 50, page = Math.max(1, f.page ?? 1)
  const rows = await query(
    `SELECT l.id, l.grade, l.sido, l.name, l.facility_kind, l.operating_status, l.score, o.stage, ${D("o.next_action_on")} AS next_action_on,
            bc.value AS phone, bc.confidence AS phone_confidence ${from}
     ORDER BY l.grade, l.score DESC NULLS LAST, l.name LIMIT ${size} OFFSET ${(page - 1) * size}`, a)
  return { rows, total, page, pageSize: size }
}

export async function facets() {
  const [sidos, kinds] = await Promise.all([
    query(`SELECT DISTINCT sido AS v FROM leads WHERE sido IS NOT NULL ORDER BY 1`),
    query(`SELECT DISTINCT facility_kind AS v FROM leads WHERE facility_kind IS NOT NULL ORDER BY 1`),
  ])
  return { sidos: sidos.map((r) => r.v as string), kinds: kinds.map((r) => r.v as string) }
}

export const getLead = (id: number) => one(`SELECT * FROM leads WHERE id=$1`, [id])
export const getOutreach = (id: number) =>
  one(`SELECT lead_id, stage, last_action, next_action, ${D("next_action_on")} AS next_action_on, consent_for_email, owner, memo FROM outreach WHERE lead_id=$1`, [id])
export const getContacts = (id: number) =>
  query(`SELECT c.id, c.channel, c.value, c.note, c.dept, c.confidence, c.source_url, ${D("c.verified_on")} AS verified_on FROM contacts c WHERE lead_id=$1 ORDER BY ${RANK} DESC, c.id`, [id])
export const getSalesPoints = (id: number) =>
  query(`SELECT id, point, category, ${D("found_on")} AS found_on FROM sales_points WHERE lead_id=$1 ORDER BY id DESC`, [id])
export const getWaterParks = (id: number) => query(`SELECT park_name, park_kind, address FROM water_parks WHERE lead_id=$1 ORDER BY park_name`, [id])
export const getDispatches = (id: number) =>
  query(`SELECT d.id, ${D("d.sent_on")} AS sent_on, d.channel, d.to_value, d.sent_by, d.note, doc.name AS document
         FROM dispatches d LEFT JOIN documents doc ON doc.id=d.document_id WHERE d.lead_id=$1 ORDER BY d.sent_on DESC, d.id DESC`, [id])
export const getCandidates = (id: number) =>
  query(`SELECT id, channel, value, dept, source_url, status, note FROM enrichment_candidates WHERE lead_id=$1 ORDER BY id DESC`, [id])

// ── 영업 진행 ──
export async function updateOutreach(id: number, v: { stage: Stage; next_action?: string; next_action_on?: string; owner?: string; memo?: string; consent_for_email?: boolean }) {
  if (!STAGES.includes(v.stage)) throw new Error("잘못된 단계")
  const consent = v.stage === "do_not_contact" ? false : !!v.consent_for_email // 연락 금지는 동의 해제
  await query(
    `UPDATE outreach SET stage=$2, next_action=$3, next_action_on=$4, owner=$5, memo=$6, consent_for_email=$7, updated_at=now() WHERE lead_id=$1`,
    [id, v.stage, v.next_action || null, v.next_action_on || null, v.owner || null, v.memo || null, consent])
}

export async function recordOptOut(id: number, note = "수신 거부 요청") {
  await query(`UPDATE outreach SET stage='do_not_contact', consent_for_email=false, next_action=NULL, next_action_on=NULL,
               memo=TRIM(COALESCE(memo,'')||' '||$2), updated_at=now() WHERE lead_id=$1`, [id, note])
}

export const addSalesPoint = (id: number, point: string, category: string) =>
  query(`INSERT INTO sales_points(lead_id,point,category) VALUES($1,$2,$3) ON CONFLICT DO NOTHING`, [id, point, category])

export async function addContact(id: number, c: { channel: string; value: string; confidence: string; dept?: string; note?: string; source_url?: string; verified_on?: string }) {
  if (c.channel === "phone" && isMobilePhone(c.value)) throw new Error("개인 휴대폰 번호는 저장할 수 없습니다")
  if (c.confidence === "verified_official" && !(c.source_url && c.verified_on)) throw new Error("공식 확인은 출처 URL과 확인일이 필요합니다")
  await query(`INSERT INTO contacts(lead_id,channel,value,note,dept,confidence,source_url,verified_on) VALUES($1,$2,$3,$4,$5,$6,$7,$8)
               ON CONFLICT (lead_id,channel,value) DO NOTHING`,
    [id, c.channel, c.value.trim(), c.note || null, c.dept || null, c.confidence, c.source_url || null, c.verified_on || null])
}

// ── 연락처 보강 ──
export async function addCandidate(id: number, channel: "phone" | "homepage", value: string,
  o: { source_url?: string; dept?: string; note?: string; found_by?: string; status?: string } = {}) {
  if (channel === "phone" && isMobilePhone(value)) throw new Error("개인 휴대폰 번호는 저장할 수 없습니다 (docs/05_compliance.md)")
  await query(`INSERT INTO enrichment_candidates(lead_id,channel,value,dept,note,source_url,found_by,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8)
               ON CONFLICT (lead_id,channel,value) DO NOTHING`,
    [id, channel, value.trim(), o.dept || null, o.note || null, o.source_url || null, o.found_by ?? "manual", o.status ?? "pending"])
}

export const queue = () => listLeads({ grades: ["A", "B"], phone: "none", pageSize: 500 })

export const pendingCandidates = () =>
  query(`SELECT e.id, l.id AS lead_id, l.grade, l.name, e.channel, e.value, e.dept, e.source_url, e.status, e.note
         FROM enrichment_candidates e JOIN leads l ON l.id=e.lead_id WHERE e.status IN ('pending','blocked') ORDER BY l.grade, l.name, e.status`)

export async function approveCandidate(id: number, reviewer: string, official: boolean) {
  if (!reviewer.trim()) throw new Error("검수자 이름이 필요합니다")
  const c = await one(`SELECT * FROM enrichment_candidates WHERE id=$1`, [id])
  if (!c || c.status !== "pending") throw new Error("승인할 수 없는 후보입니다 (pending 만 승인 가능)")
  if (official && !c.source_url) throw new Error("공식 확인은 출처 URL이 필요합니다")
  const conf = official ? "verified_official" : "third_party_recheck"
  await query(`INSERT INTO contacts(lead_id,channel,value,note,dept,confidence,source_url,verified_on) VALUES($1,$2,$3,$4,$5,$6,$7,current_date)
               ON CONFLICT (lead_id,channel,value) DO UPDATE SET confidence=EXCLUDED.confidence, source_url=EXCLUDED.source_url, verified_on=EXCLUDED.verified_on
               WHERE ${CONF_RANK_SQL("EXCLUDED.confidence")} > ${CONF_RANK_SQL("contacts.confidence")}`,
    [c.lead_id, c.channel, c.value, c.note, c.dept, conf, c.source_url])
  await query(`UPDATE enrichment_candidates SET status='approved', reviewer=$2, reviewed_on=current_date, approved_confidence=$3 WHERE id=$1`, [id, reviewer.trim(), conf])
}
const CONF_RANK_SQL = (c: string) => `CASE ${c} WHEN 'verified_official' THEN 3 WHEN 'public_data' THEN 2 WHEN 'third_party_recheck' THEN 1 ELSE 0 END`

export const rejectCandidate = (id: number, reviewer: string, note?: string) =>
  query(`UPDATE enrichment_candidates SET status='rejected', reviewer=$2, reviewed_on=current_date, review_note=$3 WHERE id=$1`, [id, reviewer.trim() || "-", note || null])

// ── 발송 지원 ──
export async function registerDocument(name: string, kind: string, url: string | undefined, version: string) {
  await query(`INSERT INTO documents(name,kind,url,version) VALUES($1,$2,$3,$4) ON CONFLICT (name,version) DO UPDATE SET url=EXCLUDED.url, kind=EXCLUDED.kind`, [name, kind, url || null, version || "v1"])
}
export const documents = () => query(`SELECT id, name, kind, url, version FROM documents ORDER BY id DESC`)

export async function logDispatch(leadId: number, d: { document_id?: number | null; channel: Channel; sent_by: string; to_value?: string; note?: string; sent_on?: string }) {
  if (!d.sent_by?.trim()) throw new Error("발송자 이름이 필요합니다")
  const o = await getOutreach(leadId)
  if (!o) throw new Error("리드를 찾을 수 없습니다")
  checkDispatchAllowed(o, d.channel) // DispatchBlocked
  const day = d.sent_on || todayKST()
  await query(`INSERT INTO dispatches(lead_id,document_id,channel,to_value,sent_on,sent_by,note,consent_verified) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
    [leadId, d.document_id ?? null, d.channel, d.to_value || null, day, d.sent_by.trim(), d.note || null, ["email", "sms", "fax"].includes(d.channel)])
  await query(`UPDATE outreach SET stage=$2, last_action=$3, next_action=COALESCE(next_action,'후속 연락'), next_action_on=$4, updated_at=now() WHERE lead_id=$1`,
    [leadId, stageAfterDispatch(o.stage, d.channel), `${day} ${d.channel} 발송/접촉`, addDays(day, FOLLOWUP_DAYS)])
}

export const dispatchHistory = (limit = 200) =>
  query(`SELECT d.id, l.id AS lead_id, l.name, ${D("d.sent_on")} AS sent_on, d.channel, doc.name AS document, d.to_value, d.sent_by, d.note
         FROM dispatches d JOIN leads l ON l.id=d.lead_id LEFT JOIN documents doc ON doc.id=d.document_id ORDER BY d.sent_on DESC, d.id DESC LIMIT ${limit}`)

export async function followups(today = todayKST(), withinDays = 7) {
  const rows = await query(`SELECT l.id, l.grade, l.name, o.stage, o.next_action, ${D("o.next_action_on")} AS next_action_on, o.owner
    FROM outreach o JOIN leads l ON l.id=o.lead_id
    WHERE o.next_action_on IS NOT NULL AND o.stage NOT IN ('do_not_contact','won','lost') ORDER BY o.next_action_on`)
  return rows.map((r) => ({ ...r, ...followupAlert(r.next_action_on, today) })).filter((r) => r.days <= withinDays)
}

// ── 분석 ──
export const kindCoverage = () =>
  query(`SELECT COALESCE(l.facility_kind,'-') AS kind, COUNT(*)::int AS total,
    COUNT(*) FILTER (WHERE grade='A')::int AS a, COUNT(*) FILTER (WHERE grade='B')::int AS b, COUNT(*) FILTER (WHERE grade='C')::int AS c,
    ROUND(100.0*COUNT(*) FILTER (WHERE EXISTS(SELECT 1 FROM contacts c WHERE c.lead_id=l.id))/COUNT(*),1)::float AS phone_rate
    FROM leads l GROUP BY 1 ORDER BY 2 DESC`)
export const funnel = () => query(`SELECT l.grade, o.stage, COUNT(*)::int AS n FROM outreach o JOIN leads l ON l.id=o.lead_id GROUP BY 1,2`)
export const pointsSummary = () =>
  query(`SELECT COALESCE(l.facility_kind,'-') AS kind, COALESCE(s.category,'other') AS category, COUNT(*)::int AS n
         FROM sales_points s JOIN leads l ON l.id=s.lead_id GROUP BY 1,2 ORDER BY 3 DESC`)
export const gradeCounts = () => query(`SELECT grade, COUNT(*)::int AS n FROM leads WHERE is_mobile_or_event=false GROUP BY 1 ORDER BY 1`)
export const unresolved = () => query(`SELECT facility, reason, next_step FROM unresolved_contacts ORDER BY facility`)

/** 내보내기: 연락 금지 제외 */
export async function exportRows(f: LeadFilter) {
  const r = await listLeads({ ...f, page: 1, pageSize: 100000 })
  return r.rows.filter((x) => x.stage !== "do_not_contact")
}
export { DispatchBlocked }

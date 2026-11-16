// 상태 전이는 이 파일에서만 일어난다. (화면·API 핸들러에서 status를 직접 바꾸지 않는다)
import { reports, drafts, versions, confirms, history, dists, confirmHours, remindHours, medias } from './store'
import { notify, base } from './notify'
import type { Report, ReportStatus, Confirm, Staff } from './types'
import { hoursFromNow, newToken, nowIso, sha256, uid } from './util'

export class WorkflowError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message) }
}
const ALLOWED: Record<ReportStatus, ReportStatus[]> = {
  RECEIVED: ['DRAFTING', 'REJECTED'], DRAFTING: ['CONFIRM_REQ', 'REJECTED'], CONFIRM_REQ: ['REVISION', 'APPROVED'],
  REVISION: ['CONFIRM_REQ'], APPROVED: ['PUBLISHED', 'SCHEDULED'], SCHEDULED: ['PUBLISHED'],
  PUBLISHED: ['CORRECTION'], CORRECTION: ['PUBLISHED'], REJECTED: [],
}
const LABEL: Record<ReportStatus, string> = {
  RECEIVED: '접수', DRAFTING: '작성중', CONFIRM_REQ: '고객 확인 대기', REVISION: '수정 요청 도착', APPROVED: '게재 대기',
  SCHEDULED: '게재 예약', PUBLISHED: '게재 완료', CORRECTION: '정정 처리중', REJECTED: '반려',
}

type Actor = { type: 'CUSTOMER' | 'STAFF' | 'SYSTEM'; id?: string | null }

async function transition(r: Report, to: ReportStatus, actor: Actor, text: string, patch: Partial<Report> = {}) {
  const fresh = await reports.get(r.id) // 멱등: 전이 직전에 현재 상태 재확인
  if (!fresh) throw new WorkflowError(404, 'NOT_FOUND', '제보를 찾을 수 없습니다.')
  if (!ALLOWED[fresh.status].includes(to))
    throw new WorkflowError(409, 'INVALID_TRANSITION', `현재 상태(${LABEL[fresh.status]})에서는 이 작업을 할 수 없습니다.`)
  const next: Report = { ...fresh, ...patch, status: to, updatedAt: nowIso() }
  await reports.set(r.id, next)
  await history.add(r.id, actor.type, text, actor.id)
  return next
}

const SECTION = '현장·동정'
export const paragraphsOf = (body: string) => body.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean)

export async function take(id: string, staff: Staff) {
  const r = await must(id)
  const n = await transition(r, 'DRAFTING', { type: 'STAFF', id: staff.id }, `기자 배정 — ${staff.name}`, { ownerId: staff.id, assignedAt: nowIso() })
  await notify({ event: '기자 배정', toType: 'STAFF', toId: staff.id, text: `배정 제보 ${n.no}`, reportId: id })
  return n
}
export async function reject(id: string, staff: Staff, reason: string) {
  if (!reason) throw new WorkflowError(400, 'REASON_REQUIRED', '반려 사유를 선택해 주세요.')
  const r = await must(id)
  const n = await transition(r, 'REJECTED', { type: 'STAFF', id: staff.id }, `반려 — ${reason}`, { rejectReason: reason, ownerId: r.ownerId ?? staff.id })
  await notify({ event: '반려', toType: 'CUSTOMER', toId: r.reporterId, text: `[프레스노트] ${r.no} 제보가 반려되었습니다. 사유: ${reason}`, reportId: id })
  return n
}

export async function requestConfirm(id: string, staff: Staff) {
  const r = await must(id)
  const d = await drafts.get(id)
  if (!d || !paragraphsOf(d.body).length || !d.title.trim()) throw new WorkflowError(400, 'EMPTY_DRAFT', '제목과 본문을 입력한 뒤 확인을 요청해 주세요.')
  const prev = await versions.list(id)
  const version = prev.length + 1
  // 상태 전이를 먼저 검증(불가능하면 버전/요청을 만들지 않는다)
  if (!ALLOWED[r.status].includes('CONFIRM_REQ')) throw new WorkflowError(409, 'INVALID_TRANSITION', `현재 상태(${LABEL[r.status]})에서는 확인 요청을 할 수 없습니다.`)
  await versions.set({ reportId: id, version, title: d.title, subtitle: d.subtitle, caption: d.caption, paragraphs: paragraphsOf(d.body), createdBy: staff.id, createdAt: nowIso() })
  const token = newToken()
  const c: Confirm = {
    id: uid(), reportId: id, version, tokenHash: sha256(token), requestedAt: nowIso(),
    deadline: hoursFromNow(await confirmHours()), result: null, comments: [],
  }
  await confirms.set(c.id, c)
  await transition(r, 'CONFIRM_REQ', { type: 'STAFF', id: staff.id }, version === 1 ? '고객 확인 요청 (1차 원고)' : `고객 확인 요청 (${version}차 원고)`)
  await notify({ event: '확인 요청', toType: 'CUSTOMER', toId: r.reporterId, reportId: id,
    text: `[프레스노트] 기사 확인을 요청드립니다. ${new Date(c.deadline).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}까지 응답이 없으면 자동 승인됩니다. ${base()}/c/${token}` })
  return { confirm: c, token }
}

export async function openConfirm(reportId: string) {
  const list = (await confirms.list()).filter((c) => c.reportId === reportId).sort((a, b) => (a.requestedAt < b.requestedAt ? -1 : 1))
  return list[list.length - 1] ?? null
}
export async function confirmByToken(token: string) {
  const h = sha256(token)
  return (await confirms.list()).find((c) => c.tokenHash === h) ?? null
}

function assertOpen(c: Confirm | null): asserts c is Confirm {
  if (!c) throw new WorkflowError(404, 'NOT_FOUND', '확인 요청을 찾을 수 없습니다.')
  if (c.result) throw new WorkflowError(409, 'ALREADY_RESPONDED', '이미 응답한 확인 요청입니다.')
  if (new Date(c.deadline).getTime() < Date.now()) throw new WorkflowError(410, 'EXPIRED', '확인 기한이 지났습니다.')
}

export async function approve(c: Confirm | null, by: string | null) {
  assertOpen(c)
  const r = await must(c.reportId)
  const n = await transition(r, 'APPROVED', { type: 'CUSTOMER', id: by }, '고객 승인', { approvedAt: nowIso() })
  c.result = 'APPROVED'; c.respondedAt = nowIso(); c.respondedBy = by; await confirms.set(c.id, c)
  if (r.ownerId) await notify({ event: '고객 승인', toType: 'STAFF', toId: r.ownerId, text: `${r.no} 고객 승인 — 게재 대기`, reportId: r.id })
  return n
}
export async function revise(c: Confirm | null, by: string | null, input: { comments?: { paragraph: number; text: string }[]; generalNote?: string; mediaIds?: string[] }) {
  assertOpen(c)
  const ver = await versions.get(c.reportId, c.version)
  const comments = (input.comments || []).filter((x) => x.text?.trim()).map((x) => ({ paragraph: Number(x.paragraph), text: x.text.trim(), resolved: false }))
  if (ver && comments.some((x) => x.paragraph !== -1 && (x.paragraph < 0 || x.paragraph >= ver.paragraphs.length)))
    throw new WorkflowError(400, 'BAD_PARAGRAPH', '존재하지 않는 문단에 의견이 달렸습니다.')
  const note = input.generalNote?.trim()
  if (!comments.length && !note) throw new WorkflowError(400, 'NO_COMMENT', '수정 의견을 한 개 이상 입력해 주세요.')
  const r = await must(c.reportId)
  const extra = (input.mediaIds || []).filter((m) => !r.mediaIds.includes(m))
  for (const m of extra) { const md = await medias.get(m); if (!md || md.ownerId !== r.reporterId) throw new WorkflowError(403, 'FORBIDDEN', '사진을 추가할 수 없습니다.') }
  const n = await transition(r, 'REVISION', { type: 'CUSTOMER', id: by }, `고객 수정 요청 (의견 ${comments.length + (note ? 1 : 0)}건, ${c.version}차 원고)`, { mediaIds: [...r.mediaIds, ...extra] })
  c.result = 'REVISION'; c.respondedAt = nowIso(); c.respondedBy = by; c.generalNote = note || null; c.comments = comments
  await confirms.set(c.id, c)
  if (r.ownerId) await notify({ event: '수정 요청 도착', toType: 'STAFF', toId: r.ownerId, text: `${r.no} 수정 요청 도착 (의견 ${comments.length}건)`, reportId: r.id })
  return n
}
export async function extendDeadline(id: string, staff: Staff) {
  const c = await openConfirm(id)
  if (!c || c.result) throw new WorkflowError(409, 'NOT_WAITING', '확인 대기 중인 요청이 없습니다.')
  c.deadline = hoursFromNow(24, Math.max(new Date(c.deadline).getTime(), Date.now())); await confirms.set(c.id, c)
  await history.add(id, 'STAFF', '확인 기한 24시간 연장', staff.id)
  return c
}

export async function publish(id: string, staff: Staff, o: { mode: 'now' | 'at'; at?: string; section?: string; channels?: string[]; reviewed?: boolean }) {
  if (!o.reviewed) throw new WorkflowError(400, 'NOT_REVIEWED', '검수 완료를 체크한 뒤 게재할 수 있습니다.')
  const r = await must(id)
  const section = o.section || SECTION
  if (o.mode === 'at') {
    const t = o.at ? new Date(o.at).getTime() : NaN
    if (!(t > Date.now())) throw new WorkflowError(400, 'BAD_TIME', '예약 일시는 현재 이후여야 합니다.')
    return transition(r, 'SCHEDULED', { type: 'STAFF', id: staff.id }, `게재 예약 — ${new Date(t).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`, { scheduledAt: new Date(t).toISOString(), section })
  }
  const n = await doPublish(r, { type: 'STAFF', id: staff.id }, '기사 게재', section)
  for (const ch of o.channels || []) if (ch !== 'HOMEPAGE') await dists.set({ id: uid(), reportId: id, channel: ch as 'FACEBOOK', status: 'PENDING', url: null, views: 0 })
  return n
}
async function doPublish(r: Report, actor: Actor, text: string, section?: string) {
  const n = await transition(r, 'PUBLISHED', actor, text, { publishedAt: nowIso(), ...(section ? { section } : {}) })
  await dists.set({ id: uid(), reportId: r.id, channel: 'HOMEPAGE', status: 'DONE', url: `${base()}/news/${r.no}`, views: 0 })
  await notify({ event: '게재 완료', toType: 'CUSTOMER', toId: r.reporterId, reportId: r.id, text: `[프레스노트] 기사가 게재되었습니다. ${base()}/news/${r.no}` })
  return n
}

/** 스케줄러(멱등). 요청 시점·크론에서 호출. */
export async function runJobs() {
  const now = Date.now(); const out = { auto: 0, remind: 0, scheduled: 0 }
  for (const c of await confirms.list()) {
    if (c.result) continue
    const r = await reports.get(c.reportId); if (!r || r.status !== 'CONFIRM_REQ') continue
    if (new Date(c.deadline).getTime() < now) {
      try {
        await transition(r, 'APPROVED', { type: 'SYSTEM' }, `확인 기한(${await confirmHours()}시간) 경과 — 자동 승인`, { approvedAt: nowIso() })
        c.result = 'AUTO'; c.respondedAt = nowIso(); await confirms.set(c.id, c); out.auto++
        if (r.ownerId) await notify({ event: '자동 승인', toType: 'STAFF', toId: r.ownerId, text: `${r.no} 자동 승인 — 게재 대기`, reportId: r.id })
      } catch { /* 다른 요청이 먼저 처리함 */ }
    } else if (!c.remindedAt && new Date(c.requestedAt).getTime() + (await remindHours()) * 3600e3 < now) {
      c.remindedAt = nowIso(); await confirms.set(c.id, c); out.remind++
      await notify({ event: '확인 재알림', toType: 'CUSTOMER', toId: r.reporterId, reportId: r.id, text: `[프레스노트] ${r.no} 기사 확인 기한이 다가옵니다. 기한 후 자동 승인됩니다.` })
    }
  }
  for (const r of await reports.list()) {
    if (r.status === 'SCHEDULED' && r.scheduledAt && new Date(r.scheduledAt).getTime() <= now) {
      try { await doPublish(r, { type: 'SYSTEM' }, '예약 시각 도달 — 게재'); out.scheduled++ } catch { /* 멱등 */ }
    }
  }
  return out
}

async function must(id: string) {
  const r = await reports.get(id)
  if (!r) throw new WorkflowError(404, 'NOT_FOUND', '제보를 찾을 수 없습니다.')
  return r
}
export { LABEL as STATUS_LABEL }

/** 제보 접수 시 최초 이력 */
export async function logReceived(r: Report) { await history.add(r.id, 'CUSTOMER', '제보 접수', r.reporterId) }

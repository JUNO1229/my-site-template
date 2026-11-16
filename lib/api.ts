import { NextRequest, NextResponse, after } from 'next/server'
import { customers, cusers, staffs, reports, medias, drafts, versions, history, dists, notifs, kv, ensureSeed, nextReportNo, confirms, confirmHours } from './store'
import * as wf from './workflow'
import { generateDraft } from './ai-draft'
import { checkPassword, maskPhone, newToken, normPhone, nowIso, sign, uid, unsign } from './util'
import type { Customer, CustomerUser, Report, Staff, Confirm, Draft } from './types'

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message) }
}
type Ctx = { req: NextRequest; params: Record<string, string>; body: any; url: URL; cookies: { name: string; value: string | null }[] }
type H = (c: Ctx) => Promise<unknown>
const routes: { method: string; re: RegExp; keys: string[]; h: H }[] = []
function route(method: string, path: string, h: H) {
  const keys: string[] = []
  const re = new RegExp('^' + path.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)' }) + '$')
  routes.push({ method, re, keys, h })
}
const get = (p: string, h: H) => route('GET', p, h), post = (p: string, h: H) => route('POST', p, h)

/* ---------- 세션 ---------- */
const COOKIE_MAX = 60 * 60 * 24 * 30
async function cSession(c: Ctx) {
  const s = unsign<{ uid: string }>(c.req.cookies.get('pn_c')?.value)
  const u = s && (await cusers.get(s.uid)); if (!u) throw new ApiError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
  const customer = (await customers.get(u.customerId))!
  return { user: u, customer }
}
async function sSession(c: Ctx) {
  const s = unsign<{ uid: string }>(c.req.cookies.get('pn_s')?.value)
  const u = s && (await staffs.get(s.uid)); if (!u) throw new ApiError(401, 'UNAUTHORIZED', '편집국 로그인이 필요합니다.')
  return u
}
function canSee(u: CustomerUser, r: Report) {
  return u.customerId === r.customerId && (u.role === 'ORG_ADMIN' || r.reporterId === u.id)
}
const CUSTOMER_LABEL: Record<string, string> = { RECEIVED: '접수완료', DRAFTING: '작성중', CONFIRM_REQ: '확인요청', REVISION: '수정중', APPROVED: '게재대기', SCHEDULED: '게재대기', PUBLISHED: '게재완료', CORRECTION: '정정중', REJECTED: '반려' }

/* ---------- 공통 변환 ---------- */
async function reportCard(r: Report) {
  const o = r.ownerId ? await staffs.get(r.ownerId) : null
  const c = r.status === 'CONFIRM_REQ' ? await wf.openConfirm(r.id) : null
  return {
    id: r.id, no: r.no, title: r.title || '(제목 없음)', category: r.category, status: r.status, statusLabel: CUSTOMER_LABEL[r.status],
    coverId: r.mediaIds[0] ?? null, createdAt: r.createdAt, publishedAt: r.publishedAt, ownerName: o?.name ?? null,
    rejectReason: r.rejectReason ?? null, deadline: c && !c.result ? c.deadline : null,
  }
}
async function confirmView(c: Confirm) {
  const r = (await reports.get(c.reportId))!
  const v = await versions.get(c.reportId, c.version)
  const prev = c.version > 1 ? await versions.get(c.reportId, c.version - 1) : null
  const changed = v ? v.paragraphs.map((p, i) => (prev && !prev.paragraphs.includes(p) ? i : -1)).filter((i) => i >= 0) : []
  const o = r.ownerId ? await staffs.get(r.ownerId) : null
  const cu = await customers.get(r.customerId)
  return {
    reportId: r.id, no: r.no, category: r.category, org: cu?.name, ownerName: o?.name ?? '편집국', version: c.version,
    article: v, changed, coverId: r.mediaIds[0] ?? null, photoIds: r.mediaIds, deadline: c.deadline, result: c.result ?? null,
    expired: !c.result && new Date(c.deadline).getTime() < Date.now(), status: r.status,
  }
}
const err = (s: number, c: string, m: string) => new ApiError(s, c, m)

/* ---------- 고객: 인증 ---------- */
post('/auth/otp', async ({ body }) => {
  const phone = normPhone(body.phone || '')
  if (!/^01\d{8,9}$/.test(phone)) throw err(400, 'BAD_PHONE', '휴대폰 번호를 정확히 입력해 주세요.')
  const code = process.env.NOTIFY_DRY_RUN === 'false' ? String(Math.floor(100000 + Math.random() * 900000)) : '123456'
  await kv.set(`otp:${phone}`, { code, exp: Date.now() + 180e3 })
  // TODO: SMS 대행사 발송 (SMS_API_KEY). 검토 환경에서는 화면에 인증번호를 보여준다.
  return { ok: true, devCode: process.env.NOTIFY_DRY_RUN === 'false' ? undefined : code }
})
post('/auth/verify', async (c) => {
  const { body } = c
  const phone = normPhone(body.phone || '')
  const otp = await kv.get<{ code: string; exp: number }>(`otp:${phone}`)
  if (!otp || otp.exp < Date.now()) throw err(400, 'OTP_EXPIRED', '인증번호가 만료되었습니다. 다시 요청해 주세요.')
  if (otp.code !== String(body.code || '')) throw err(400, 'OTP_WRONG', '인증번호가 맞지 않습니다.')
  let u = (await cusers.list()).find((x) => x.phone === phone)
  if (!u) {
    const name = (body.name || '').trim()
    if (!name) throw err(422, 'NEED_SIGNUP', '처음 이용하시네요. 이름을 입력해 주세요.')
    let cust: Customer | undefined; let role: CustomerUser['role'] = 'REPORTER'
    if (body.kind === 'ORG') {
      const code = String(body.inviteCode || '').trim().toUpperCase()
      cust = (await customers.list()).find((x) => x.inviteCode === code)
      if (!cust) throw err(400, 'BAD_INVITE', '초대코드가 올바르지 않습니다. 담당자에게 확인해 주세요.')
      if (!(await cusers.list()).some((x) => x.customerId === cust!.id)) role = 'ORG_ADMIN'
    } else {
      cust = { id: uid(), kind: 'PERSON', name, createdAt: nowIso() }; await customers.set(cust.id, cust)
    }
    u = { id: uid(), customerId: cust.id, name, phone, role, department: body.department || null, createdAt: nowIso() }
    await cusers.set(u.id, u)
  }
  await kv.del(`otp:${phone}`)
  c.cookies.push({ name: 'pn_c', value: sign({ uid: u.id }) })
  return { ok: true }
})
post('/auth/logout', async (c) => { c.cookies.push({ name: 'pn_c', value: null }); return { ok: true } })
get('/me', async (c) => {
  const { user, customer } = await cSession(c)
  return { id: user.id, name: user.name, role: user.role, department: user.department, customer: { id: customer.id, kind: customer.kind, name: customer.name } }
})

/* ---------- 고객: 파일 ---------- */
route('POST', '/media', async (c) => {
  const { user } = await cSession(c)
  const fd = await c.req.formData(); const f = fd.get('file')
  if (!(f instanceof File)) throw err(400, 'NO_FILE', '파일이 없습니다.')
  const isImg = /^image\/(jpeg|png|webp)$/.test(f.type)
  const isDoc = /\.(pdf|hwp|hwpx|docx)$/i.test(f.name)
  if (!isImg && !isDoc) throw err(400, 'BAD_TYPE', '사진(JPG·PNG·WEBP) 또는 PDF·HWP·HWPX·DOCX 파일만 올릴 수 있습니다.')
  if (f.size > 4 * 1024 * 1024) throw err(413, 'TOO_BIG', '파일이 너무 큽니다. 4MB 이하로 올려 주세요.')
  const buf = Buffer.from(await f.arrayBuffer())
  const m = { id: uid(), ownerId: user.id, kind: (isImg ? 'PHOTO' : 'ATTACHMENT') as 'PHOTO', mime: f.type || 'application/octet-stream', name: f.name, dataUrl: `data:${f.type || 'application/octet-stream'};base64,${buf.toString('base64')}`, addedBy: 'CUSTOMER' as const, createdAt: nowIso() }
  await medias.set(m.id, m)
  return { mediaId: m.id, kind: m.kind }
})
get('/media/:id', async (c) => {
  // 추측 불가능한 ID 기반 접근. (운영에서는 서명된 단기 URL로 교체 — CLAUDE.md 16장)
  const m = await medias.get(c.params.id); if (!m) throw err(404, 'NOT_FOUND', '파일을 찾을 수 없습니다.')
  const mm = m.dataUrl.match(/^data:(.+?);base64,(.+)$/)!
  return new Response(Buffer.from(mm[2], 'base64'), { headers: { 'content-type': mm[1], 'cache-control': 'private, max-age=3600', 'content-disposition': m.kind === 'ATTACHMENT' ? `attachment; filename*=UTF-8''${encodeURIComponent(m.name)}` : 'inline' } })
})

/* ---------- 고객: 제보 ---------- */
const CATS = ['피지컬AI', '레저산업', '브랜딩·마케팅', '의료', '지역·동정', '기타']
const DESIRED = ['가능한 빨리(당일)', '내일', '이번 주 안', '날짜 협의']
post('/reports', async (c) => {
  const { user } = await cSession(c); const b = c.body
  if (!b.consent) throw err(400, 'NO_CONSENT', '사진 권리·인물 동의가 필요합니다.')
  if (!b.title?.trim() && !b.memo?.trim()) throw err(400, 'NEED_CONTENT', '제목 또는 내용 메모 중 하나는 입력해 주세요.')
  const photoIds: string[] = b.photoIds || []
  if (!photoIds.length) throw err(400, 'NEED_PHOTO', '사진을 1장 이상 추가해 주세요.')
  for (const id of [...photoIds, ...(b.attachmentIds || [])]) { const m = await medias.get(id); if (!m || m.ownerId !== user.id) throw err(403, 'FORBIDDEN', '올바르지 않은 파일입니다.') }
  if (!CATS.includes(b.category)) throw err(400, 'BAD_CATEGORY', '분야를 선택해 주세요.')
  const r: Report = {
    id: uid(), no: await nextReportNo(), customerId: user.customerId, reporterId: user.id, title: b.title?.trim() || null, category: b.category,
    eventAt: b.eventAt || null, place: b.place || null, memo: (b.memo || '').slice(0, 5000) || null, desiredDate: DESIRED.includes(b.desiredDate) ? b.desiredDate : DESIRED[0],
    consent: true, consentVersion: 'v1', status: 'RECEIVED', mediaIds: photoIds, attachmentIds: b.attachmentIds || [],
    createdAt: nowIso(), updatedAt: nowIso(), aiState: 'PENDING',
  }
  await reports.set(r.id, r)
  await wf.logReceived(r)
  await kv.set(`notif-staff:${r.id}`, 1)
  const cu = await customers.get(user.customerId)
  after(async () => { await generateDraft(r.id) })
  const { notify } = await import('./notify')
  await notify({ event: '제보 접수', toType: 'CUSTOMER', toId: user.id, reportId: r.id, text: `[프레스노트] 제보가 접수되었습니다. 접수번호 ${r.no}` })
  await notify({ event: '제보 접수', toType: 'STAFF', toId: 'all', reportId: r.id, text: `신규 제보 ${r.no} (${cu?.name})` })
  return { id: r.id, no: r.no, deadlineHours: await confirmHours() }
})
get('/reports', async (c) => {
  const { user } = await cSession(c); await wf.runJobs()
  const st = c.url.searchParams.get('status')
  const all = (await reports.list()).filter((r) => canSee(user, r)).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  const cards = await Promise.all(all.map(reportCard))
  return { reports: st ? cards.filter((x) => x.status === st) : cards }
})
get('/reports/:id', async (c) => {
  const { user } = await cSession(c); await wf.runJobs()
  const r = await reports.get(c.params.id); if (!r || !canSee(user, r)) throw err(403, 'FORBIDDEN', '이 기사를 볼 권한이 없습니다.')
  const vs = await versions.list(r.id); const open = await wf.openConfirm(r.id)
  return {
    report: { ...(await reportCard(r)), eventAt: r.eventAt, place: r.place, memo: r.memo, desiredDate: r.desiredDate, mediaIds: r.mediaIds, section: r.section, scheduledAt: r.scheduledAt },
    history: (await history.list(r.id)).map((h) => ({ at: h.at, text: h.text })),
    latestVersion: vs[vs.length - 1] ?? null,
    confirmOpen: open && !open.result ? { deadline: open.deadline, version: open.version } : null,
    distributions: (await dists.list(r.id)).map((d) => ({ channel: d.channel, status: d.status, url: d.url, views: d.views })),
    articleUrl: r.status === 'PUBLISHED' ? `/news/${r.no}` : null,
  }
})
async function ownConfirm(c: Ctx) {
  const { user } = await cSession(c)
  const r = await reports.get(c.params.id); if (!r || !canSee(user, r)) throw err(403, 'FORBIDDEN', '이 기사를 볼 권한이 없습니다.')
  const cf = await wf.openConfirm(r.id); if (!cf || cf.result) throw err(409, 'NOT_WAITING', '확인 대기 중인 원고가 없습니다.')
  return { user, cf }
}
get('/reports/:id/confirm', async (c) => confirmView((await ownConfirm(c)).cf))
post('/reports/:id/approve', async (c) => { const { user, cf } = await ownConfirm(c); await wf.approve(cf, user.id); return { ok: true } })
post('/reports/:id/revise', async (c) => { const { user, cf } = await ownConfirm(c); await wf.revise(cf, user.id, c.body); return { ok: true } })

/* ---------- 고객: 로그인 없는 확인 링크 ---------- */
async function byToken(c: Ctx) {
  const cf = await wf.confirmByToken(c.params.token)
  if (!cf) throw err(404, 'NOT_FOUND', '유효하지 않은 확인 링크입니다.')
  return cf
}
get('/confirm/:token', async (c) => { await wf.runJobs(); return confirmView(await byToken(c)) })
post('/confirm/:token/approve', async (c) => { await wf.approve(await byToken(c), null); return { ok: true } })
post('/confirm/:token/revise', async (c) => {
  const cf = await byToken(c)
  const r = await reports.get(cf.reportId)
  const mediaIds: string[] = c.body.mediaIds || []
  if (mediaIds.length) throw err(403, 'LOGIN_REQUIRED', '사진 추가는 로그인 후 이용해 주세요.')
  await wf.revise(cf, r?.reporterId ?? null, c.body); return { ok: true }
})
get('/org/summary', async (c) => {
  const { user, customer } = await cSession(c)
  if (user.role !== 'ORG_ADMIN') throw err(403, 'FORBIDDEN', '고객사 관리자만 볼 수 있습니다.')
  const rs = (await reports.list()).filter((r) => r.customerId === customer.id)
  const month = new Date().toISOString().slice(0, 7)
  const us = (await cusers.list()).filter((u) => u.customerId === customer.id)
  const months = [0, 1, 2, 3].map((i) => { const d = new Date(); d.setUTCMonth(d.getUTCMonth() - i, 1); return d.toISOString().slice(0, 7) }).reverse()
  return {
    name: customer.name, inviteCode: customer.inviteCode,
    thisMonth: { received: rs.filter((r) => r.createdAt.startsWith(month)).length, published: rs.filter((r) => r.publishedAt?.startsWith(month)).length, inProgress: rs.filter((r) => !['PUBLISHED', 'REJECTED'].includes(r.status)).length },
    monthly: months.map((m) => ({ month: m, published: rs.filter((r) => r.publishedAt?.startsWith(m)).length })),
    members: us.map((u) => ({ name: u.name, department: u.department, count: rs.filter((r) => r.reporterId === u.id && r.createdAt.startsWith(month)).length })),
  }
})

/* ---------- 편집국 ---------- */
post('/desk/login', async (c) => {
  const email = String(c.body.email || '').trim().toLowerCase(); await ensureSeed()
  const u = (await staffs.list()).find((s) => s.email.toLowerCase() === email)
  if (!u || !checkPassword(String(c.body.password || ''), u.passHash)) throw err(401, 'BAD_LOGIN', '이메일 또는 비밀번호가 맞지 않습니다.')
  c.cookies.push({ name: 'pn_s', value: sign({ uid: u.id }) }); return { ok: true }
})
post('/desk/logout', async (c) => { c.cookies.push({ name: 'pn_s', value: null }); return { ok: true } })
get('/desk/me', async (c) => { const u = await sSession(c); return { id: u.id, name: u.name, role: u.role } })

get('/desk/reports', async (c) => {
  await sSession(c); await wf.runJobs()
  const st = c.url.searchParams.get('status')?.split(',').filter(Boolean)
  const all = (await reports.list()).filter((r) => !st || st.includes(r.status)).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  const confs = await confirms.list()
  const out = await Promise.all(all.map(async (r) => {
    const cu = await customers.get(r.customerId); const o = r.ownerId ? await staffs.get(r.ownerId) : null
    const cf = confs.filter((x) => x.reportId === r.id).sort((a, b) => (a.requestedAt < b.requestedAt ? 1 : -1))[0]
    return { id: r.id, no: r.no, title: r.title || '(제목 없음)', customer: cu?.name, category: r.category, desiredDate: r.desiredDate, status: r.status, ownerId: r.ownerId, ownerName: o?.name ?? null,
      createdAt: r.createdAt, assignedAt: r.assignedAt, approvedAt: r.approvedAt, publishedAt: r.publishedAt, scheduledAt: r.scheduledAt, coverId: r.mediaIds[0] ?? null,
      deadline: cf && !cf.result ? cf.deadline : null, lastResult: cf?.result ?? null }
  }))
  return { reports: out }
})
get('/desk/reports/:id', async (c) => {
  await sSession(c)
  const r = await reports.get(c.params.id); if (!r) throw err(404, 'NOT_FOUND', '제보를 찾을 수 없습니다.')
  const cu = await customers.get(r.customerId); const ru = await cusers.get(r.reporterId)
  const cfs = (await confirms.list()).filter((x) => x.reportId === r.id).sort((a, b) => (a.requestedAt < b.requestedAt ? -1 : 1))
  const mediaMeta = await Promise.all([...r.mediaIds, ...r.attachmentIds].map(async (id) => { const m = await medias.get(id); return m && { id, kind: m.kind, name: m.name } }))
  const ns = (await notifs.list()).filter((n) => n.reportId === r.id && n.event === '확인 요청').slice(-1)
  return {
    report: r, customer: cu, reporter: ru && { name: ru.name, phone: maskPhone(ru.phone), department: ru.department }, media: mediaMeta.filter(Boolean),
    draft: await drafts.get(r.id), versions: await versions.list(r.id),
    confirms: cfs.map(({ tokenHash, ...x }) => x), history: await history.list(r.id), distributions: await dists.list(r.id),
    lastConfirmNotice: process.env.NOTIFY_DRY_RUN !== 'false' ? ns[0]?.text ?? null : null,
  }
})
post('/desk/reports/:id/take', async (c) => { const s = await sSession(c); await wf.take(c.params.id, s); return { ok: true } })
post('/desk/reports/:id/reject', async (c) => { const s = await sSession(c); await wf.reject(c.params.id, s, c.body.reason); return { ok: true } })
post('/desk/reports/:id/request-confirm', async (c) => { const s = await sSession(c); const x = await wf.requestConfirm(c.params.id, s); return { ok: true, version: x.confirm.version } })
post('/desk/reports/:id/extend', async (c) => { const s = await sSession(c); const x = await wf.extendDeadline(c.params.id, s); return { deadline: x.deadline } })
post('/desk/reports/:id/publish', async (c) => { const s = await sSession(c); const r = await wf.publish(c.params.id, s, c.body); return { status: r.status } })
post('/desk/reports/:id/ai-draft', async (c) => { await sSession(c); await generateDraft(c.params.id, true); return { draft: await drafts.get(c.params.id) } })
post('/desk/reports/:id/resolve-comment', async (c) => {
  await sSession(c); const cf = await confirms.get(c.body.confirmId); if (!cf || cf.reportId !== c.params.id) throw err(404, 'NOT_FOUND', '요청을 찾을 수 없습니다.')
  const x = cf.comments[c.body.index]; if (x) x.resolved = !!c.body.resolved; await confirms.set(cf.id, cf); return { ok: true }
})
route('PUT', '/desk/reports/:id/draft', async (c) => {
  await sSession(c); const r = await reports.get(c.params.id); if (!r) throw err(404, 'NOT_FOUND', '제보를 찾을 수 없습니다.')
  const old = await drafts.get(r.id); const b = c.body
  const d: Draft = { reportId: r.id, titleCandidates: old?.titleCandidates || [], title: b.title ?? '', subtitle: b.subtitle ?? '', caption: b.caption ?? '', body: b.body ?? '', tags: b.tags ?? [], aiChecks: old?.aiChecks || [], checklist: b.checklist ?? old?.checklist ?? { photo: false, fact: false, ad: false }, aiGeneratedAt: old?.aiGeneratedAt, savedAt: nowIso(), edited: true }
  await drafts.set(r.id, d); return { savedAt: d.savedAt }
})
get('/desk/customers', async (c) => {
  await sSession(c); const rs = await reports.list(); const month = new Date().toISOString().slice(0, 7)
  const list = (await customers.list()).map((cu) => { const mine = rs.filter((r) => r.customerId === cu.id); return { ...cu, monthReports: mine.filter((r) => r.createdAt.startsWith(month)).length, published: mine.filter((r) => r.status === 'PUBLISHED').length, rejected: mine.filter((r) => r.status === 'REJECTED').length, lastAt: mine.map((r) => r.createdAt).sort().pop() ?? null } })
  const users = await cusers.list()
  return { customers: list.map((cu) => ({ ...cu, users: users.filter((u) => u.customerId === cu.id).map((u) => ({ name: u.name, phone: maskPhone(u.phone), department: u.department, role: u.role })) })) }
})
async function freshCode() {
  const used = new Set((await customers.list()).map((x) => x.inviteCode))
  for (;;) { const code = 'PN-' + newToken().slice(0, 4).toUpperCase().replace(/[01OI]/g, 'X'); if (!used.has(code)) return code }
}
post('/desk/customers', async (c) => {
  await sSession(c); const name = String(c.body.name || '').trim(); if (!name) throw err(400, 'NEED_NAME', '고객사 이름을 입력해 주세요.')
  const cu: Customer = { id: uid(), kind: 'ORG', name, inviteCode: await freshCode(), memo: null, createdAt: nowIso() }
  await customers.set(cu.id, cu); return cu
})
route('PATCH', '/desk/customers/:id', async (c) => {
  await sSession(c); const cu = await customers.get(c.params.id); if (!cu) throw err(404, 'NOT_FOUND', '고객을 찾을 수 없습니다.')
  cu.memo = c.body.memo ?? cu.memo; await customers.set(cu.id, cu); return cu
})
post('/desk/customers/:id/invite-code', async (c) => {
  await sSession(c); const cu = await customers.get(c.params.id); if (!cu || cu.kind !== 'ORG') throw err(404, 'NOT_FOUND', '고객사를 찾을 수 없습니다.')
  cu.inviteCode = await freshCode(); await customers.set(cu.id, cu); return { inviteCode: cu.inviteCode } // 이전 코드는 무효
})
get('/desk/stats', async (c) => {
  await sSession(c); const rs = await reports.list(); const cfs = await confirms.list()
  const pub = rs.filter((r) => r.publishedAt); const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length / 3600e3 : null)
  const done = cfs.filter((x) => x.result)
  const byCat: Record<string, number> = {}; pub.forEach((r) => (byCat[r.category] = (byCat[r.category] || 0) + 1))
  return {
    received: rs.length, published: pub.length, rejectRate: rs.length ? rs.filter((r) => r.status === 'REJECTED').length / rs.length : 0,
    avgHoursToPublish: avg(pub.map((r) => +new Date(r.publishedAt!) - +new Date(r.createdAt))),
    autoApproveRate: done.length ? done.filter((x) => x.result === 'AUTO').length / done.length : 0,
    stages: { assign: avg(rs.filter((r) => r.assignedAt).map((r) => +new Date(r.assignedAt!) - +new Date(r.createdAt))), confirm: avg(done.map((x) => +new Date(x.respondedAt!) - +new Date(x.requestedAt))) },
    byCategory: byCat,
  }
})
get('/news/:no', async (c) => {
  await wf.runJobs()
  const r = (await reports.list()).find((x) => x.no === c.params.no)
  if (!r || (r.status !== 'PUBLISHED' && r.status !== 'CORRECTION')) throw err(404, 'NOT_FOUND', '기사를 찾을 수 없습니다.')
  const vs = await versions.list(r.id); const v = vs[vs.length - 1]; if (!v) throw err(404, 'NOT_FOUND', '기사를 찾을 수 없습니다.')
  return { article: v, mediaIds: r.mediaIds, section: r.section || r.category, publishedAt: r.publishedAt, org: (await customers.get(r.customerId))?.name, by: r.ownerId ? (await staffs.get(r.ownerId))?.name : null }
})
get('/cron/tick', async () => ({ ok: true, ...(await wf.runJobs()) }))

/* ---------- 디스패처 ---------- */
export async function handle(req: NextRequest, path: string[]) {
  const url = new URL(req.url); const p = '/' + path.join('/')
  const ctx: Ctx = { req, params: {}, body: {}, url, cookies: [] }
  try {
    for (const r of routes) {
      const m = r.method === req.method && p.match(r.re); if (!m) continue
      r.keys.forEach((k, i) => (ctx.params[k] = decodeURIComponent(m[i + 1])))
      if (req.method !== 'GET' && !(req.headers.get('content-type') || '').includes('multipart')) ctx.body = await req.json().catch(() => ({}))
      const out = await r.h(ctx)
      const res = out instanceof Response ? out : NextResponse.json(out)
      for (const k of ctx.cookies) res.headers.append('set-cookie', `${k.name}=${k.value ?? ''}; Path=/; HttpOnly; SameSite=Lax; ${process.env.NODE_ENV === 'production' ? 'Secure; ' : ''}Max-Age=${k.value ? COOKIE_MAX : 0}`)
      return res
    }
    throw err(404, 'NOT_FOUND', '요청한 주소를 찾을 수 없습니다.')
  } catch (e) {
    const known = e instanceof ApiError || e instanceof wf.WorkflowError
    if (!known) console.error(e)
    const x = e as { status: number; code: string; message: string }
    return NextResponse.json({ error: { code: known ? x.code : 'SERVER_ERROR', message: known ? x.message : '서버에 문제가 생겼습니다. 잠시 후 다시 시도해 주세요.' } }, { status: known ? x.status : 500 })
  }
}

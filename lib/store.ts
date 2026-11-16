import * as db from './db'
import type { Customer, CustomerUser, Staff, Report, Media, Draft, Version, Confirm, History, Distribution, Notif } from './types'
import { hashPassword, nowIso, uid } from './util'

function col<T extends { id?: string }>(p: string) {
  return {
    get: (id: string) => db.get<T>(`${p}:${id}`),
    set: (id: string, v: T) => db.set(`${p}:${id}`, v),
    del: (id: string) => db.del(`${p}:${id}`),
    list: () => db.list<T>(`${p}:`),
  }
}
export const customers = col<Customer>('customer')
export const cusers = col<CustomerUser>('cuser')
export const staffs = col<Staff>('staff')
export const reports = col<Report>('report')
export const medias = col<Media>('media')
export const drafts = col<Draft & { id?: string }>('draft')
export const confirms = col<Confirm>('confirm')

export const versions = {
  get: (rid: string, n: number) => db.get<Version>(`version:${rid}:${String(n).padStart(4, '0')}`),
  set: (v: Version) => db.set(`version:${v.reportId}:${String(v.version).padStart(4, '0')}`, v),
  list: (rid: string) => db.list<Version>(`version:${rid}:`),
}
export const history = {
  add: async (reportId: string, actorType: History['actorType'], text: string, actorId?: string | null) => {
    const h: History = { id: uid(), reportId, at: nowIso(), actorType, actorId: actorId ?? null, text }
    await db.set(`hist:${reportId}:${h.at}:${h.id}`, h)
  },
  list: (rid: string) => db.list<History>(`hist:${rid}:`),
}
export const dists = {
  set: (d: Distribution) => db.set(`dist:${d.reportId}:${d.channel}`, d),
  list: (rid: string) => db.list<Distribution>(`dist:${rid}:`),
}
export const notifs = {
  add: (n: Omit<Notif, 'id' | 'createdAt'>) => { const x: Notif = { ...n, id: uid(), createdAt: nowIso() }; return db.set(`notif:${x.createdAt}:${x.id}`, x) },
  list: () => db.list<Notif>('notif:'),
}
export const settings = {
  async num(key: string, env: string | undefined, dflt: number) {
    const v = await db.get<string>(`setting:${key}`)
    return Number(v ?? env ?? dflt) || dflt
  },
  set: (key: string, v: string) => db.set(`setting:${key}`, v),
}
export const confirmHours = () => settings.num('confirm_deadline_hours', process.env.CONFIRM_DEADLINE_HOURS, 48)
export const remindHours = () => settings.num('confirm_remind_after_hours', process.env.CONFIRM_REMIND_AFTER_HOURS, 24)

export const kv = db

/** 접수번호 PN-YYYYMMDD-NNNN (KST 기준 날짜) */
export async function nextReportNo() {
  const d = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10).replace(/-/g, '')
  const n = await db.incr(`counter:${d}`)
  return `PN-${d}-${String(n).padStart(4, '0')}`
}

export async function ensureSeed() {
  if (await db.get('seeded')) return
  const email = process.env.SEED_STAFF_EMAIL || 'editor@pressnote.local'
  const pw = process.env.SEED_STAFF_PASSWORD || 'pressnote1234'
  await staffs.set('seed-editor', { id: 'seed-editor', name: '김기자', email, passHash: hashPassword(pw), role: 'ADMIN' })
  await db.set('seeded', true)
}

'use client'
import Link from 'next/link'
import { useState } from 'react'
import { useDesk, Row } from '@/lib/desk-ctx'
import { hoursLeft, fmt } from '@/lib/client'
import { Chip } from '@/components/pn'

const hrs = (iso: string) => (Date.now() - new Date(iso).getTime()) / 3600e3
const COLS: [string, string[], (r: Row) => string][] = [
  ['접수', ['RECEIVED'], () => '/desk'], ['작성중·수정', ['DRAFTING', 'REVISION'], (r) => `/desk/write/${r.id}`], ['고객 확인', ['CONFIRM_REQ'], (r) => `/desk/confirm?id=${r.id}`],
  ['게재 대기', ['APPROVED', 'SCHEDULED'], () => '/desk/publish'], ['게재 완료', ['PUBLISHED'], () => '/desk/board'],
]
const late = (r: Row) => (r.status === 'RECEIVED' && hrs(r.createdAt) > 2) || (r.status === 'DRAFTING' && r.assignedAt && hrs(r.assignedAt) > 6) || (r.status === 'CONFIRM_REQ' && r.deadline && hoursLeft(r.deadline) < 6)
export default function Board() {
  const { rows, me } = useDesk(); const [mine, setMine] = useState(false); const rs = rows.filter((r) => !mine || r.ownerId === me.id)
  return (
    <main className="space-y-4 p-5"><div className="flex items-center justify-between"><h1 className="serif text-2xl font-extrabold">기사 현황</h1><label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-5" checked={mine} onChange={(e) => setMine(e.target.checked)} />내 담당만</label></div>
      <div className="grid gap-3 md:grid-cols-5">{COLS.map(([t, st, href]) => { const items = rs.filter((r) => st.includes(r.status)).slice(0, st[0] === 'PUBLISHED' ? 12 : 100)
        return <section key={t} className="rounded-xl bg-line/40 p-2"><h2 className="mb-2 flex justify-between px-1 text-sm font-bold">{t}<span className="text-muted">{items.length}</span></h2>
          <ul className="space-y-2">{items.map((r) => <li key={r.id}><Link href={href(r)} className={`card block p-3 text-sm ${late(r) ? 'border-bad' : ''}`}><Chip status={r.status} /><p className="mt-1 font-semibold">{r.title}</p><p className="text-xs text-muted">{r.customer} · {fmt(r.createdAt)}</p>{late(r) && <p className="mt-1 text-xs font-bold text-bad">지연</p>}</Link></li>)}</ul></section> })}</div>
    </main>
  )
}

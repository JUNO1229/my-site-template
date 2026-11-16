'use client'
import Link from 'next/link'
import { useDesk } from '@/lib/desk-ctx'
import { fmt } from '@/lib/client'
import { Chip } from '@/components/pn'
export default function WriteList() {
  const { rows } = useDesk(); const list = rows.filter((r) => ['DRAFTING', 'REVISION'].includes(r.status))
  return (
    <main className="space-y-4 p-5"><h1 className="serif text-2xl font-extrabold">기사 작성</h1>
      {!list.length ? <p className="card p-6 text-muted">작성 중인 기사가 없습니다. 접수함에서 제보를 맡아 주세요.</p> :
        <ul className="grid gap-3 md:grid-cols-2">{list.map((r) => <li key={r.id}><Link href={`/desk/write/${r.id}`} className="card block p-4 hover:border-primary"><div className="flex justify-between"><b>{r.no}</b><Chip status={r.status} /></div><p className="serif mt-2 text-lg font-bold">{r.title}</p><p className="mt-1 text-sm text-muted">{r.customer} · 접수 {fmt(r.createdAt)}</p></Link></li>)}</ul>}
    </main>
  )
}

'use client'
import Link from 'next/link'
import { useMe } from '@/lib/me-ctx'
import { useApi, fmt, remain } from '@/lib/client'
import { Chip, Thumb } from '@/components/pn'

type Card = { id: string; title: string; status: string; coverId?: string; createdAt: string; deadline?: string }
export default function Home() {
  const me = useMe(); const { data } = useApi<{ reports: Card[] }>('/reports')
  const rs = data?.reports || []; const wait = rs.filter((r) => r.status === 'CONFIRM_REQ')
  const n = (f: (r: Card) => boolean) => rs.filter(f).length
  return (
    <main className="space-y-5 px-4 py-5">
      <div><p className="text-lg font-bold">{me.name} 님, 오늘 현장 소식을 보내주세요</p><p className="text-sm text-muted">{me.customer.name}</p></div>
      <Link href="/m/report" className="btn btn-primary btn-lg w-full">새 기사 제보하기</Link>
      {wait.map((r) => (
        <Link key={r.id} href={`/m/confirm/${r.id}`} className="block rounded-xl border border-warn bg-warnbg p-4">
          <p className="text-xs font-bold text-warn">확인 요청 · {r.deadline && remain(r.deadline)}</p><p className="mt-1 font-bold">{r.title}</p>
        </Link>))}
      <div className="grid grid-cols-3 gap-2 text-center">
        {[['진행중', n((r) => !['PUBLISHED', 'REJECTED', 'CONFIRM_REQ'].includes(r.status))], ['확인요청', wait.length], ['게재완료', n((r) => r.status === 'PUBLISHED')]].map(([l, v]) => <div key={l} className="card py-3"><p className="text-2xl font-bold">{v}</p><p className="text-xs text-muted">{l}</p></div>)}
      </div>
      <section><h2 className="mb-2 font-bold">최근 기사</h2>
        {!data ? <p className="text-sm text-muted">불러오는 중…</p> : !rs.length ? <p className="card p-4 text-sm text-muted">아직 제보한 기사가 없습니다. 위 버튼으로 첫 소식을 보내보세요.</p> :
          <ul className="space-y-2">{rs.slice(0, 4).map((r) => (
            <li key={r.id}><Link href={`/m/articles/${r.id}`} className="card flex gap-3 p-3"><Thumb id={r.coverId} className="size-16 shrink-0 rounded-lg" />
              <div className="min-w-0"><p className="line-clamp-2 font-semibold">{r.title}</p><p className="mt-1 flex items-center gap-2 text-xs text-muted">{fmt(r.createdAt)} <Chip status={r.status} customer /></p></div></Link></li>))}</ul>}
      </section>
    </main>
  )
}

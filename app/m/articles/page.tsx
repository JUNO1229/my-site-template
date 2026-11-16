'use client'
import Link from 'next/link'
import { useState } from 'react'
import { useApi, fmt, remain } from '@/lib/client'
import { Chip, Thumb } from '@/components/pn'

const TABS = [['', '전체'], ['ING', '진행중'], ['CONFIRM_REQ', '확인요청'], ['PUBLISHED', '게재완료'], ['REJECTED', '반려']]
export default function Articles() {
  const [tab, setTab] = useState(''); const { data } = useApi<{ reports: any[] }>('/reports')
  const rs = (data?.reports || []).filter((r) => !tab || (tab === 'ING' ? !['PUBLISHED', 'REJECTED', 'CONFIRM_REQ'].includes(r.status) : r.status === tab))
  return (
    <main className="px-4 py-4">
      <div className="mb-3 flex gap-2 overflow-x-auto">{TABS.map(([k, l]) => <button key={k} onClick={() => setTab(k)} aria-pressed={tab === k} className={`min-h-10 shrink-0 rounded-full border px-4 text-sm font-semibold ${tab === k ? 'border-primary bg-primary text-onprimary' : 'border-line bg-surface'}`}>{l}</button>)}</div>
      {!data ? <p className="text-muted">불러오는 중…</p> : !rs.length ? <p className="card p-4 text-sm text-muted">해당하는 기사가 없습니다.</p> :
        <ul className="space-y-2">{rs.map((r) => (
          <li key={r.id}><Link href={`/m/articles/${r.id}`} className="card flex gap-3 p-3"><Thumb id={r.coverId} className="size-20 shrink-0 rounded-lg" />
            <div className="min-w-0"><p className="flex items-center gap-2 text-xs text-muted">{fmt(r.createdAt)} <Chip status={r.status} customer /></p>
              <p className="mt-1 line-clamp-2 font-semibold">{r.title}</p>
              <p className="mt-1 text-xs text-muted">{r.deadline ? `확인 기한 ${remain(r.deadline)}` : r.rejectReason ? `반려 사유: ${r.rejectReason}` : r.ownerName ? `담당 ${r.ownerName} 기자` : ''}</p></div></Link></li>))}</ul>}
    </main>
  )
}

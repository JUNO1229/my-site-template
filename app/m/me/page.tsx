'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useMe } from '@/lib/me-ctx'
import { api, useApi } from '@/lib/client'

export default function Me() {
  const me = useMe(); const router = useRouter(); const org = me.role === 'ORG_ADMIN'
  const { data } = useApi<any>(org ? '/org/summary' : null); const [copied, setCopied] = useState(false)
  const max = Math.max(1, ...(data?.monthly || []).map((m: any) => m.published))
  return (
    <main className="space-y-4 px-4 py-5">
      <div className="card p-4"><p className="font-bold">{me.name}</p><p className="text-sm text-muted">{me.customer.name} · {org ? '고객사 관리자' : me.customer.kind === 'ORG' ? '담당자' : '개인 회원'}</p></div>
      {data && <>
        <div className="grid grid-cols-3 gap-2 text-center">{[['이번 달 제보', data.thisMonth.received], ['게재', data.thisMonth.published], ['진행중', data.thisMonth.inProgress]].map(([l, v]) => <div key={l as string} className="card py-3"><p className="text-2xl font-bold">{v}</p><p className="text-xs text-muted">{l}</p></div>)}</div>
        <section className="card p-4"><h2 className="mb-3 text-sm font-bold">월별 게재</h2><div className="flex h-28 items-end gap-3">{data.monthly.map((m: any) => <div key={m.month} className="flex flex-1 flex-col items-center gap-1"><span className="text-xs">{m.published}</span><div className="w-full rounded-t bg-primary" style={{ height: `${(m.published / max) * 80 + 4}%` }} /><span className="text-xs text-muted">{m.month.slice(5)}월</span></div>)}</div></section>
        <section className="card p-4"><h2 className="mb-2 text-sm font-bold">담당자 ({data.members.length})</h2>{data.members.map((u: any) => <p key={u.name} className="flex justify-between py-1 text-sm"><span>{u.name} <span className="text-muted">{u.department}</span></span><span>{u.count}건</span></p>)}
          <div className="mt-3 flex items-center justify-between rounded-lg bg-bg p-3"><span className="text-sm">초대코드 <b>{data.inviteCode}</b></span><button className="btn" onClick={() => { navigator.clipboard?.writeText(data.inviteCode); setCopied(true) }}>{copied ? '복사됨' : '복사'}</button></div></section></>}
      <button className="btn w-full" onClick={async () => { await api('/auth/logout', { json: {} }); router.replace('/m/login') }}>로그아웃</button>
    </main>
  )
}

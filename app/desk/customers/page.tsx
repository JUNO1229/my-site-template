'use client'
import { useState } from 'react'
import { api, fmt, useApi } from '@/lib/client'
import { Err } from '@/components/pn'

export default function Customers() {
  const { data, reload } = useApi<{ customers: any[] }>('/desk/customers'); const [tab, setTab] = useState(''); const [qs, setQs] = useState(''); const [name, setName] = useState(''); const [err, setErr] = useState(''); const [sel, setSel] = useState<string | null>(null); const [memo, setMemo] = useState<string | null>(null)
  const list = (data?.customers || []).filter((c) => (!tab || c.kind === tab) && c.name.includes(qs)); const cur = (data?.customers || []).find((c) => c.id === sel)
  const run = async (f: () => Promise<unknown>) => { setErr(''); try { await f(); reload() } catch (e) { setErr((e as Error).message) } }
  return (
    <main className="grid gap-4 p-5 lg:grid-cols-[1fr_360px]">
      <section className="space-y-3"><h1 className="serif text-2xl font-extrabold">고객 관리</h1>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); run(async () => { await api('/desk/customers', { json: { name } }); setName('') }) }}><input className="input" placeholder="고객사 이름 입력 → 초대코드 자동 발급" aria-label="고객사 이름" value={name} onChange={(e) => setName(e.target.value)} /><button className="btn btn-primary shrink-0">고객사 등록</button></form><Err>{err}</Err>
        <div className="flex flex-wrap gap-2">{[['', '전체'], ['ORG', '고객사'], ['PERSON', '개인']].map(([k, l]) => <button key={k} aria-pressed={tab === k} onClick={() => setTab(k)} className={`min-h-10 rounded-full border px-4 text-sm font-semibold ${tab === k ? 'border-primary bg-primary text-onprimary' : 'border-line bg-surface'}`}>{l}</button>)}<input className="input ml-auto w-48" placeholder="검색" aria-label="검색" value={qs} onChange={(e) => setQs(e.target.value)} /></div>
        <div className="card overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-line text-xs text-muted"><tr>{['고객명', '구분', '초대코드', '이번 달 제보', '누적 게재', '최근 제보'].map((h) => <th key={h} className="p-3">{h}</th>)}</tr></thead>
          <tbody>{list.map((c) => <tr key={c.id} onClick={() => { setSel(c.id); setMemo(null) }} className={`cursor-pointer border-b border-line last:border-0 hover:bg-bg ${sel === c.id ? 'bg-infobg' : ''}`}><td className="p-3 font-semibold">{c.name}</td><td className="p-3">{c.kind === 'ORG' ? '고객사' : '개인'}</td><td className="p-3">{c.inviteCode || '-'}</td><td className="p-3">{c.monthReports}</td><td className="p-3">{c.published}</td><td className="p-3">{c.lastAt ? fmt(c.lastAt) : '-'}</td></tr>)}
            {!list.length && <tr><td colSpan={6} className="p-6 text-center text-muted">고객이 없습니다. 고객사를 등록해 초대코드를 전달해 주세요.</td></tr>}</tbody></table></div></section>
      {cur && <aside className="card h-fit space-y-3 p-4"><h2 className="serif text-lg font-bold">{cur.name}</h2><p className="text-sm text-muted">이번 달 {cur.monthReports} · 누적 게재 {cur.published} · 반려 {cur.rejected}</p>
        {cur.inviteCode && <div className="flex items-center justify-between rounded-lg bg-bg p-3"><span>초대코드 <b>{cur.inviteCode}</b></span><button className="btn" onClick={() => confirm('재발급하면 이전 코드는 사용할 수 없습니다. 재발급할까요?') && run(() => api(`/desk/customers/${cur.id}/invite-code`, { json: {} }))}>재발급</button></div>}
        <div><b className="text-sm">담당자</b>{cur.users.map((u: any) => <p key={u.phone} className="text-sm">{u.name} {u.department} <span className="text-muted">{u.phone}</span></p>)}{!cur.users.length && <p className="text-sm text-muted">아직 가입한 담당자가 없습니다.</p>}</div>
        <div><label className="label" htmlFor="mm">편집국 메모 (고객에게 비공개)</label><textarea id="mm" className="input" value={memo ?? cur.memo ?? ''} onChange={(e) => setMemo(e.target.value)} /><button className="btn mt-2" onClick={() => run(() => api(`/desk/customers/${cur.id}`, { method: 'PATCH', json: { memo } }))}>메모 저장</button></div></aside>}
    </main>
  )
}

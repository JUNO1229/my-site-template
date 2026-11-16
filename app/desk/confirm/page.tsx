'use client'
import Link from 'next/link'
import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useDesk } from '@/lib/desk-ctx'
import { api, fmt, hoursLeft, remain, useApi } from '@/lib/client'
import { Chip, Err } from '@/components/pn'

function Page() {
  const { rows, reload } = useDesk(); const q = useSearchParams(); const [sel, setSel] = useState<string | null>(q.get('id'))
  const list = rows.filter((r) => ['REVISION', 'CONFIRM_REQ'].includes(r.status)).sort((a, b) => a.status === b.status ? (a.deadline || '') < (b.deadline || '') ? -1 : 1 : a.status === 'REVISION' ? -1 : 1)
  const cur = sel && list.find((r) => r.id === sel) ? sel : list[0]?.id
  return (
    <main className="grid gap-4 p-5 lg:grid-cols-[360px_1fr]">
      <section className="space-y-2"><h1 className="serif mb-2 text-2xl font-extrabold">컨펌 관리</h1>
        {!list.length && <p className="card p-5 text-muted">확인 대기 또는 수정 요청 건이 없습니다.</p>}
        {list.map((r) => <button key={r.id} onClick={() => setSel(r.id)} className={`card block w-full p-3 text-left ${cur === r.id ? 'border-primary' : ''}`}><div className="flex justify-between"><Chip status={r.status} />{r.deadline && <span className={`text-xs ${hoursLeft(r.deadline) < 6 ? 'font-bold text-bad' : 'text-muted'}`}>{remain(r.deadline)}</span>}</div><p className="mt-2 font-semibold">{r.title}</p><p className="text-xs text-muted">{r.customer} · {r.no}</p></button>)}</section>
      {cur && <Detail key={cur} id={cur} onChange={reload} />}
    </main>
  )
}
function Detail({ id, onChange }: { id: string; onChange: () => void }) {
  const { data: d, reload } = useApi<any>(`/desk/reports/${id}`); const [err, setErr] = useState(''); const [cmp, setCmp] = useState(false)
  if (!d) return <p className="text-muted">불러오는 중…</p>
  const r = d.report; const cf = d.confirms[d.confirms.length - 1]; const vs = d.versions; const v = vs[vs.length - 1]
  const prevV = vs.length > 1 ? vs[vs.length - 2] : null
  return (
    <section className="card space-y-4 p-5"><div className="flex items-center justify-between"><h2 className="serif text-xl font-bold">{r.title || v?.title}</h2><Chip status={r.status} /></div>
      <p className="text-sm text-muted">{d.customer?.name} · {v?.version}차 원고 · 요청 {fmt(cf?.requestedAt)}</p>
      {r.status === 'REVISION' && cf?.result === 'REVISION' && <>
        <h3 className="font-bold text-warn">고객 수정 요청</h3>
        {cf.comments.map((c: any, i: number) => <div key={i} className="rounded-lg border border-line p-3"><p className="text-xs text-muted">{c.paragraph >= 0 ? `${c.paragraph + 1}문단` : '전체'}</p>{c.paragraph >= 0 && <p className="serif my-1 rounded bg-bg p-2 text-sm">{vs.find((x: any) => x.version === cf.version)?.paragraphs[c.paragraph]}</p>}<p className="text-sm font-semibold">{c.text}</p>
          <label className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" className="size-5" checked={c.resolved} onChange={async (e) => { await api(`/desk/reports/${id}/resolve-comment`, { json: { confirmId: cf.id, index: i, resolved: e.target.checked } }); reload() }} />반영함</label></div>)}
        {cf.generalNote && <p className="rounded-lg bg-bg p-3 text-sm">전체 의견: {cf.generalNote}</p>}
        <Link href={`/desk/write/${id}`} className="btn btn-primary">에디터에서 반영하기</Link></>}
      {r.status === 'CONFIRM_REQ' && cf && <>
        <p className={`rounded-lg p-3 text-sm ${hoursLeft(cf.deadline) < 6 ? 'bg-badbg text-bad' : 'bg-warnbg text-warn'}`}>기한 {fmt(cf.deadline)} · {remain(cf.deadline)} — 응답이 없으면 자동 승인됩니다.</p>
        <button className="btn" onClick={async () => { try { await api(`/desk/reports/${id}/extend`, { json: {} }); reload(); onChange() } catch (e) { setErr((e as Error).message) } }}>기한 24시간 연장</button>
        {d.lastConfirmNotice && <p className="break-all rounded-lg bg-bg p-3 text-xs text-muted">검토용(발송 안 됨) 고객 알림: {d.lastConfirmNotice}</p>}</>}
      {prevV && v && <><button className="text-sm underline" onClick={() => setCmp(!cmp)}>{cmp ? '비교 닫기' : `이전 버전(${prevV.version}차)과 비교`}</button>
        {cmp && <div className="serif space-y-2 text-sm">{prevV.paragraphs.filter((p: string) => !v.paragraphs.includes(p)).map((p: string, i: number) => <p key={'d' + i} className="diff-del rounded p-2">{p}</p>)}{v.paragraphs.map((p: string, i: number) => <p key={i} className={`rounded p-2 ${prevV.paragraphs.includes(p) ? '' : 'diff-add'}`}>{p}</p>)}</div>}</>}
      <Err>{err}</Err>
    </section>
  )
}
export default function P() { return <Suspense><Page /></Suspense> }

'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useDesk } from '@/lib/desk-ctx'
import { api, fmt, mediaUrl, useApi } from '@/lib/client'
import { Chip, Err, Thumb } from '@/components/pn'

const REASONS = ['광고성', '사실 확인 불가', '정보 부족', '이미 보도됨']
const hrs = (iso: string) => (Date.now() - new Date(iso).getTime()) / 3600e3
export default function Inbox() {
  const { rows, reload, me } = useDesk(); const router = useRouter(); const [tab, setTab] = useState('all'); const [sel, setSel] = useState<string | null>(null)
  const inbox = rows.filter((r) => r.status === 'RECEIVED')
  const list = inbox.filter((r) => tab === 'all' || (tab === 'unassigned' && !r.ownerId) || (tab === 'mine' && r.ownerId === me.id) || (tab === 'urgent' && r.desiredDate.startsWith('가능한')))
  const today = rows.filter((r) => r.desiredDate.startsWith('가능한') && !['PUBLISHED', 'REJECTED'].includes(r.status)).length
  const pubs = rows.filter((r) => r.publishedAt && Date.now() - +new Date(r.publishedAt) < 7 * 864e5)
  const avg = pubs.length ? (pubs.reduce((s, r) => s + (+new Date(r.publishedAt!) - +new Date(r.createdAt)), 0) / pubs.length / 3600e3).toFixed(1) + '시간' : '-'
  return (
    <main className="flex flex-col gap-4 p-5 xl:flex-row">
      <div className="min-w-0 flex-1 space-y-4">
        <h1 className="serif text-2xl font-extrabold">접수함</h1>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[['새 제보', inbox.length], ['오늘 게재 희망', today], ['작성중', rows.filter((r) => r.status === 'DRAFTING').length], ['최근 7일 평균 접수→게재', avg]].map(([l, v]) => <div key={l as string} className="card p-4"><p className="text-xs text-muted">{l}</p><p className="mt-1 text-2xl font-bold">{v}</p></div>)}</div>
        <div className="flex gap-2">{[['all', '전체'], ['unassigned', '미배정'], ['mine', '내 담당'], ['urgent', '긴급']].map(([k, l]) => <button key={k} onClick={() => setTab(k)} aria-pressed={tab === k} className={`min-h-10 rounded-full border px-4 text-sm font-semibold ${tab === k ? 'border-primary bg-primary text-onprimary' : 'border-line bg-surface'}`}>{l}</button>)}</div>
        <div className="card overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-line text-xs text-muted"><tr>{['접수번호', '제목', '고객', '분야', '희망 게재', '경과', '담당'].map((h) => <th key={h} className="p-3 font-semibold">{h}</th>)}</tr></thead>
          <tbody>{list.map((r) => <tr key={r.id} onClick={() => setSel(r.id)} className={`cursor-pointer border-b border-line last:border-0 hover:bg-bg ${sel === r.id ? 'bg-infobg' : ''}`}>
            <td className="p-3">{r.no}</td><td className="p-3 font-semibold">{r.title}</td><td className="p-3">{r.customer}</td><td className="p-3">{r.category}</td><td className="p-3">{r.desiredDate}</td>
            <td className={`p-3 ${hrs(r.createdAt) > 2 ? 'font-bold text-bad' : ''}`}>{hrs(r.createdAt) < 1 ? `${Math.max(1, Math.round(hrs(r.createdAt) * 60))}분` : `${Math.floor(hrs(r.createdAt))}시간`}</td><td className="p-3">{r.ownerName || '미배정'}</td></tr>)}
            {!list.length && <tr><td colSpan={7} className="p-6 text-center text-muted">대기 중인 제보가 없습니다.</td></tr>}</tbody></table></div>
      </div>
      {sel && <Detail id={sel} onDone={async (go) => { await reload(); setSel(null); if (go) router.push(`/desk/write/${go}`) }} />}
    </main>
  )
}
function Detail({ id, onDone }: { id: string; onDone: (go?: string) => void }) {
  const { data: d } = useApi<any>(`/desk/reports/${id}`); const [rej, setRej] = useState(''); const [err, setErr] = useState('')
  if (!d) return <aside className="card w-full p-4 xl:w-96">불러오는 중…</aside>
  const r = d.report; const run = async (p: string, json?: unknown, go?: string) => { setErr(''); try { await api(`/desk/reports/${id}/${p}`, { json: json ?? {} }); onDone(go) } catch (e) { setErr((e as Error).message) } }
  return (
    <aside className="card h-fit w-full space-y-3 p-4 xl:sticky xl:top-5 xl:w-96">
      <div className="flex items-center justify-between"><b>{r.no}</b><Chip status={r.status} /></div>
      <div className="flex gap-2 overflow-x-auto">{r.mediaIds.map((m: string) => <a key={m} href={mediaUrl(m)} target="_blank"><Thumb id={m} className="size-24 rounded-lg" /></a>)}</div>
      <h2 className="serif text-lg font-bold">{r.title || '(제목 없음)'}</h2>
      <dl className="grid grid-cols-[72px_1fr] gap-y-1 text-sm"><dt className="text-muted">고객</dt><dd>{d.customer?.name} · {d.reporter?.name} ({d.reporter?.phone})</dd><dt className="text-muted">일시·장소</dt><dd>{[r.eventAt, r.place].filter(Boolean).join(' · ') || '-'}</dd><dt className="text-muted">분야</dt><dd>{r.category}</dd><dt className="text-muted">희망 게재</dt><dd>{r.desiredDate}</dd><dt className="text-muted">접수</dt><dd>{fmt(r.createdAt)}</dd></dl>
      <p className="whitespace-pre-wrap rounded-lg bg-bg p-3 text-sm">{r.memo || '(메모 없음)'}</p>
      {d.draft ? <p className="chip chip-ok">AI 초안 준비됨</p> : <p className="chip chip-gray">{r.aiState === 'FAILED' ? 'AI 초안 실패 — 직접 작성' : 'AI 초안 생성 중…'}</p>}
      <button className="btn btn-primary w-full" onClick={() => run('take', {}, id)}>맡고 기사 작성</button>
      <div className="flex gap-2"><select className="input" aria-label="반려 사유" value={rej} onChange={(e) => setRej(e.target.value)}><option value="">반려 사유 선택</option>{REASONS.map((x) => <option key={x}>{x}</option>)}</select><button className="btn btn-danger" disabled={!rej} onClick={() => confirm('반려하면 고객에게 사유가 안내됩니다. 반려할까요?') && run('reject', { reason: rej })}>반려</button></div>
      <Err>{err}</Err>
    </aside>
  )
}

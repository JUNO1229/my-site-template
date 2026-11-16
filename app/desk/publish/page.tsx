'use client'
import { useState } from 'react'
import { useDesk } from '@/lib/desk-ctx'
import { api, fmt, useApi } from '@/lib/client'
import { ArticlePreview, Chip, Err } from '@/components/pn'

const SECTIONS = ['현장·동정', '피지컬AI', '레저산업', '브랜딩·마케팅', '의료', '지역·동정']
export default function Publish() {
  const { rows, reload } = useDesk(); const list = rows.filter((r) => ['APPROVED', 'SCHEDULED'].includes(r.status)); const [sel, setSel] = useState<string | null>(null)
  const cur = sel && list.find((r) => r.id === sel) ? sel : list[0]?.id
  return (
    <main className="grid gap-4 p-5 lg:grid-cols-[320px_1fr]">
      <section className="space-y-2"><h1 className="serif mb-2 text-2xl font-extrabold">검수·게재</h1>
        {!list.length && <p className="card p-5 text-muted">게재 대기 중인 기사가 없습니다.</p>}
        {list.map((r) => <button key={r.id} onClick={() => setSel(r.id)} className={`card block w-full p-3 text-left ${cur === r.id ? 'border-primary' : ''}`}><div className="flex justify-between"><Chip status={r.status} />{r.lastResult === 'AUTO' && <span className="chip chip-warn">자동 승인</span>}</div><p className="mt-2 font-semibold">{r.title}</p><p className="text-xs text-muted">{r.customer}{r.scheduledAt && ` · 예약 ${fmt(r.scheduledAt)}`}</p></button>)}</section>
      {cur && <Detail key={cur} id={cur} onDone={reload} />}
    </main>
  )
}
function Detail({ id, onDone }: { id: string; onDone: () => void }) {
  const { data: d, reload } = useApi<any>(`/desk/reports/${id}`)
  const [reviewed, setReviewed] = useState(false); const [mode, setMode] = useState<'now' | 'at'>('now'); const [at, setAt] = useState(''); const [section, setSection] = useState(SECTIONS[0]); const [fb, setFb] = useState(false); const [blog, setBlog] = useState(false); const [err, setErr] = useState(''); const [ok, setOk] = useState('')
  if (!d) return <p className="text-muted">불러오는 중…</p>
  const r = d.report; const v = d.versions[d.versions.length - 1]; const cf = d.confirms[d.confirms.length - 1]
  const go = async () => { setErr(''); try { const x = await api(`/desk/reports/${id}/publish`, { json: { mode, at: at ? new Date(at).toISOString() : undefined, section, reviewed, channels: ['HOMEPAGE', ...(fb ? ['FACEBOOK'] : []), ...(blog ? ['BLOG'] : [])] } }); setOk(x.status === 'PUBLISHED' ? '게재했습니다.' : '게재를 예약했습니다.'); reload(); onDone() } catch (e) { setErr((e as Error).message) } }
  return (
    <section className="grid gap-4 xl:grid-cols-[1fr_340px]">
      <ArticlePreview category={section} title={v.title} subtitle={v.subtitle} byline={`프레스노트 편집국`} coverId={r.mediaIds[0]} caption={v.caption} paragraphs={v.paragraphs} />
      <div className="card h-fit space-y-4 p-4">
        <p className="text-sm">{cf?.result === 'AUTO' ? '확인 기한 경과로 자동 승인된 기사입니다.' : '고객이 승인한 기사입니다.'}</p>
        <label className="flex min-h-10 items-center gap-2 text-sm font-semibold"><input type="checkbox" className="size-5" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} />직접 검수 완료 (사실·표현·사진 확인)</label>
        {r.status === 'SCHEDULED' ? <p className="rounded-lg bg-infobg p-3 text-sm text-info">{fmt(r.scheduledAt)}에 게재 예정입니다.</p> : <>
          <fieldset className="space-y-2"><legend className="label">게재 시점</legend>
            <label className="flex items-center gap-2 text-sm"><input type="radio" checked={mode === 'now'} onChange={() => setMode('now')} />바로 게재</label>
            <label className="flex items-center gap-2 text-sm"><input type="radio" checked={mode === 'at'} onChange={() => setMode('at')} />예약</label>
            {mode === 'at' && <input type="datetime-local" aria-label="예약 일시" className="input" value={at} onChange={(e) => setAt(e.target.value)} />}</fieldset>
          <div><label className="label" htmlFor="sec">노출 섹션</label><select id="sec" className="input" value={section} onChange={(e) => setSection(e.target.value)}>{SECTIONS.map((s) => <option key={s}>{s}</option>)}</select></div>
          <fieldset className="space-y-1"><legend className="label">배포 채널</legend><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked disabled />홈페이지 (기본)</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={fb} onChange={(e) => setFb(e.target.checked)} />페이스북 (3단계 연동 전: 대기로 기록)</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={blog} onChange={(e) => setBlog(e.target.checked)} />블로그 (3단계 연동 전: 대기로 기록)</label>
            <label className="flex items-center gap-2 text-sm text-muted"><input type="checkbox" disabled />포털 (제휴 후 사용)</label></fieldset>
          <p className="text-xs text-muted">게재되면 고객에게 기사 링크가 알림톡으로 발송됩니다.</p>
          <button className="btn btn-primary btn-lg w-full" disabled={!reviewed || (mode === 'at' && !at)} onClick={go}>{mode === 'now' ? '게재하기' : '게재 예약'}</button></>}
        {ok && <p className="text-sm font-bold text-ok">{ok}</p>}<Err>{err}</Err>
      </div>
    </section>
  )
}

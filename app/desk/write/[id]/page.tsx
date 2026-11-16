'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { use, useEffect, useRef, useState } from 'react'
import { useDesk } from '@/lib/desk-ctx'
import { api, fmt, mediaUrl, useApi } from '@/lib/client'
import { ArticlePreview, Err, Thumb } from '@/components/pn'

const CHECKS: [string, string][] = [['photo', '사진 권리 확인'], ['fact', '수치·이름 사실 확인'], ['ad', '광고성 표현 없음']]
const TEMPLATES: Record<string, string> = {
  '신기술·도입': '[확인 필요: 기업명]은(는) [확인 필요: 일시]에 [확인 필요: 신기술·도입 내용]을 발표했다.\n\n[확인 필요: 도입 배경과 기대 효과]\n\n[확인 필요: 관계자 코멘트 — 제보에 있는 경우만]',
  '행사': '[확인 필요: 주최]는(은) [확인 필요: 일시] [확인 필요: 장소]에서 [확인 필요: 행사명]을 열었다.\n\n[확인 필요: 행사 주요 내용]\n\n[확인 필요: 참석 규모]',
  '협약(MOU)': '[확인 필요: 기관 A]와(과) [확인 필요: 기관 B]는 [확인 필요: 일시] 업무협약(MOU)을 체결했다.\n\n[확인 필요: 협약 주요 내용]',
  '수상': '[확인 필요: 수상자]은(는) [확인 필요: 시상명]에서 [확인 필요: 수상 부문]을 수상했다.\n\n[확인 필요: 수상 배경]',
  '인사·동정': '[확인 필요: 소속]은(는) [확인 필요: 일시] [확인 필요: 인사·동정 내용]을 알렸다.',
}
export default function Editor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params); const router = useRouter(); const { reload } = useDesk()
  const { data: d, reload: reloadD } = useApi<any>(`/desk/reports/${id}`)
  const [f, setF] = useState<any>(null); const [saved, setSaved] = useState(''); const [err, setErr] = useState(''); const [preview, setPreview] = useState(false); const [busy, setBusy] = useState(false); const dirty = useRef(false)
  useEffect(() => { if (d && !f) setF(d.draft ? { ...d.draft, tags: (d.draft.tags || []).join(', ') } : { title: '', subtitle: '', caption: '', body: '', tags: '', titleCandidates: [], aiChecks: [], checklist: { photo: false, fact: false, ad: false } }) }, [d, f])
  useEffect(() => { if (d && !d.draft && !f?.body) { const t = setTimeout(() => reloadD(), 3000); return () => clearTimeout(t) } }, [d, f, reloadD])
  const payload = (x = f) => ({ title: x.title, subtitle: x.subtitle, caption: x.caption, body: x.body, tags: String(x.tags).split(',').map((s) => s.trim()).filter(Boolean), checklist: x.checklist })
  const save = async (x = f) => { try { const r = await api(`/desk/reports/${id}/draft`, { method: 'PUT', json: payload(x) }); setSaved(new Date(r.savedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })); dirty.current = false } catch (e) { setErr((e as Error).message) } }
  useEffect(() => { if (!f || !dirty.current) return; const t = setTimeout(() => save(), 2000); return () => clearTimeout(t) }, [f]) // eslint-disable-line
  if (!d || !f) return <p className="p-6 text-muted">불러오는 중…</p>
  const r = d.report; const set = (k: string, v: any) => { dirty.current = true; setF({ ...f, [k]: v }) }
  const paras = f.body.split(/\n\s*\n/).map((s: string) => s.trim()).filter(Boolean)
  const lastCf = d.confirms[d.confirms.length - 1]; const revision = r.status === 'REVISION' && lastCf?.result === 'REVISION'
  const ai = async () => { if (f.body.trim() && !confirm('AI 초안을 다시 만들면 지금 쓴 원고를 덮어씁니다. 계속할까요?')) return; setBusy(true); setErr(''); try { const x = await api(`/desk/reports/${id}/ai-draft`, { json: {} }); setF({ ...x.draft, tags: x.draft.tags.join(', ') }) } catch (e) { setErr((e as Error).message) } setBusy(false) }
  const ask = async () => { setBusy(true); setErr(''); try { await save(); await api(`/desk/reports/${id}/request-confirm`, { json: {} }); await reload(); router.push('/desk/confirm') } catch (e) { setErr((e as Error).message) } setBusy(false) }
  const editable = ['DRAFTING', 'REVISION'].includes(r.status)
  return (
    <main className="grid gap-4 p-5 xl:grid-cols-[340px_1fr]">
      <section className="space-y-3">
        <Link href="/desk/write" className="text-sm text-muted">‹ 기사 작성</Link>
        <div className="card space-y-3 p-4"><b>{r.no}</b>
          <div className="flex gap-2 overflow-x-auto">{r.mediaIds.map((m: string) => <a key={m} href={mediaUrl(m)} target="_blank"><Thumb id={m} className="size-20 rounded-lg" /></a>)}</div>
          <p className="text-sm text-muted">{d.customer?.name} · {d.reporter?.name} ({d.reporter?.phone})<br />{[r.category, r.eventAt, r.place].filter(Boolean).join(' · ')}</p>
          <p className="whitespace-pre-wrap rounded-lg bg-bg p-3 text-sm">{r.memo || '(메모 없음)'}</p>
          {d.media.filter((m: any) => m.kind === 'ATTACHMENT').map((m: any) => <a key={m.id} className="block text-sm underline" href={mediaUrl(m.id)}>📎 {m.name}</a>)}</div>
        {revision && <div className="card border-warn p-4"><b className="text-warn">고객 수정 요청 ({lastCf.version}차 원고)</b>
          {lastCf.comments.map((c: any, i: number) => <p key={i} className="mt-2 text-sm"><span className="chip chip-warn mr-1">{c.paragraph >= 0 ? `${c.paragraph + 1}문단` : '전체'}</span>{c.text}</p>)}{lastCf.generalNote && <p className="mt-2 text-sm">전체 의견: {lastCf.generalNote}</p>}</div>}
        <div className="card p-4"><b className="text-sm">게재 전 확인</b>{CHECKS.map(([k, l]) => <label key={k} className="mt-2 flex min-h-9 items-center gap-2 text-sm"><input type="checkbox" className="size-5" checked={!!f.checklist?.[k]} onChange={(e) => set('checklist', { ...f.checklist, [k]: e.target.checked })} />{l}</label>)}</div>
      </section>
      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2"><select className="input w-auto" aria-label="템플릿" value="" onChange={(e) => { const t = TEMPLATES[e.target.value]; if (t && (!f.body.trim() || confirm('현재 본문을 템플릿으로 바꿀까요?'))) set('body', t) }}><option value="">템플릿</option>{Object.keys(TEMPLATES).map((k) => <option key={k}>{k}</option>)}</select>
          <button className="btn" disabled={busy || !editable} onClick={ai}>{busy ? '만드는 중…' : 'AI 초안 다시 만들기'}</button><span className="ml-auto text-xs text-muted">{saved ? `${saved} 저장됨` : ''}</span></div>
        {!d.draft && !f.body && <p className="rounded-lg bg-infobg p-3 text-sm text-info">{r.aiState === 'FAILED' ? 'AI 초안 생성에 실패했습니다. 직접 작성하거나 “AI 초안 다시 만들기”를 눌러 주세요.' : 'AI 초안을 준비하는 중입니다…'}</p>}
        {!!f.titleCandidates?.length && <fieldset className="card p-3"><legend className="px-1 text-xs font-bold text-muted">AI 제목 후보</legend>{f.titleCandidates.map((t: string) => <label key={t} className="flex min-h-9 items-center gap-2 text-sm"><input type="radio" name="tc" checked={f.title === t} onChange={() => set('title', t)} />{t}</label>)}</fieldset>}
        <div><label className="label" htmlFor="ti">제목</label><input id="ti" className="input serif text-lg font-bold" value={f.title} onChange={(e) => set('title', e.target.value)} /></div>
        <div><label className="label" htmlFor="su">부제</label><input id="su" className="input" value={f.subtitle || ''} onChange={(e) => set('subtitle', e.target.value)} /></div>
        <div><label className="label" htmlFor="ca">대표사진 설명</label><input id="ca" className="input" value={f.caption || ''} onChange={(e) => set('caption', e.target.value)} /></div>
        <div><label className="label" htmlFor="bo">본문 (문단은 빈 줄로 구분)</label><textarea id="bo" className="input min-h-72 serif" value={f.body} onChange={(e) => set('body', e.target.value)} /></div>
        {!!f.aiChecks?.length && <div className="rounded-lg bg-warnbg p-3 text-sm text-warn"><b>AI가 표시한 확인 사항</b><ul className="mt-1 list-disc pl-5">{f.aiChecks.map((c: string) => <li key={c}>{c}</li>)}</ul></div>}
        {/\[확인 필요/.test(f.body) && <p className="text-sm text-warn">본문에 [확인 필요: …] 표시가 남아 있습니다. 고객 확인 화면에 주황 배지로 표시됩니다.</p>}
        <div><label className="label" htmlFor="tg">태그 (쉼표로 구분)</label><input id="tg" className="input" value={f.tags} onChange={(e) => set('tags', e.target.value)} /></div>
        <Err>{err}</Err>
        <div className="flex gap-2"><button className="btn" onClick={() => setPreview(!preview)}>{preview ? '미리보기 닫기' : '게재 화면 미리보기'}</button>
          <button className="btn btn-primary flex-1" disabled={busy || !editable} onClick={ask}>{revision ? '수정본으로 다시 확인 요청' : '고객에게 확인 요청'}</button></div>
        {preview && <ArticlePreview category={r.category} title={f.title} subtitle={f.subtitle} byline="프레스노트 편집국" coverId={r.mediaIds[0]} caption={f.caption} paragraphs={paras} />}
      </section>
    </main>
  )
}

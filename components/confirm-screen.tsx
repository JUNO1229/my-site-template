'use client'
import { useEffect, useState } from 'react'
import { api, fmt, hoursLeft, remain } from '@/lib/client'
import { ArticlePreview, Err, Logo } from './pn'

/** M05 기사 확인 + M06 수정 요청. 로그인(/m/confirm/[id])과 1회용 링크(/c/[token])에서 공용 */
export default function ConfirmScreen({ getPath, actionBase, backHref }: { getPath: string; actionBase: string; backHref?: string }) {
  const [d, setD] = useState<any>(null); const [err, setErr] = useState(''); const [mode, setMode] = useState<'review' | 'revise' | 'done'>('review')
  const [showChg, setShowChg] = useState(true); const [open, setOpen] = useState<number | null>(null); const [cm, setCm] = useState<Record<number, string>>({}); const [note, setNote] = useState(''); const [busy, setBusy] = useState(false); const [doneMsg, setDoneMsg] = useState('')
  useEffect(() => { api(getPath).then(setD).catch((e) => setErr(e.message)) }, [getPath])
  if (err && !d) return <main className="grid min-h-dvh place-items-center p-6 text-center"><p>{err}</p></main>
  if (!d) return <main className="grid min-h-dvh place-items-center text-muted">불러오는 중…</main>
  const a = d.article; const closed = !!d.result || d.expired || d.status !== 'CONFIRM_REQ'
  const act = async (path: string, json?: unknown, msg = '') => { setBusy(true); setErr(''); try { await api(`${actionBase}/${path}`, { json: json ?? {} }); setDoneMsg(msg); setMode('done') } catch (e) { setErr((e as Error).message) } finally { setBusy(false) } }
  const comments = Object.entries(cm).filter(([, t]) => t.trim()).map(([p, text]) => ({ paragraph: Number(p), text }))
  if (mode === 'done') return <main className="mx-auto grid min-h-dvh max-w-[430px] place-items-center p-6 text-center"><div className="space-y-3"><div className="mx-auto grid size-14 place-items-center rounded-full bg-okbg text-2xl text-ok">✓</div><p className="text-lg font-bold">{doneMsg}</p>{backHref && <a href={backHref} className="btn btn-primary">내 기사로 가기</a>}</div></main>
  return (
    <div className="mx-auto min-h-dvh max-w-[430px] bg-bg pb-28">
      <header className="flex items-center gap-2 border-b border-line bg-surface px-4 py-3">{backHref ? <a href={backHref} className="text-xl" aria-label="뒤로">‹</a> : <Logo />}<b>{mode === 'revise' ? '수정 요청' : '기사 확인'}</b><span className="ml-auto text-xs text-muted">{d.no}</span></header>
      {!closed && <div className={`px-4 py-3 text-sm ${hoursLeft(d.deadline) < 6 ? 'bg-badbg text-bad' : 'bg-warnbg text-warn'}`}><b>{fmt(d.deadline)}까지 확인해 주세요 · {remain(d.deadline)}</b><br />기한까지 응답이 없으면 자동 승인되어 게재됩니다.</div>}
      {closed && <div className="bg-line px-4 py-3 text-sm">{d.result ? '이미 응답하신 요청입니다.' : d.expired ? '확인 기한이 지났습니다.' : '확인 대기 중인 원고가 아닙니다.'}</div>}
      <div className="space-y-3 p-4">
        <div className="flex items-center justify-between text-sm"><span>{d.version}차 원고 · {d.ownerName} 기자</span>
          {d.version > 1 && mode === 'review' && <label className="flex items-center gap-2"><input type="checkbox" className="size-5" checked={showChg} onChange={(e) => setShowChg(e.target.checked)} />바뀐 부분 표시</label>}</div>
        {mode === 'revise' && <p className="text-sm text-muted">의견을 남길 문단을 눌러 주세요. 횟수 제한 없이 요청할 수 있습니다.</p>}
        <ArticlePreview category={d.category} title={a.title} subtitle={a.subtitle} byline={`${d.ownerName} 기자 · 게재 예정`} coverId={d.coverId} caption={a.caption} paragraphs={a.paragraphs}
          changed={d.changed} showChanged={showChg && mode === 'review'} marks={Object.fromEntries(Object.entries(cm).filter(([, t]) => t.trim()).map(([k]) => [k, true]))}
          onPara={mode === 'revise' ? (i) => setOpen(open === i ? null : i) : undefined}
          extra={(i) => mode === 'revise' && open === i ? <textarea autoFocus aria-label={`${i + 1}번째 문단 의견`} className="input mb-3" placeholder="이 문단에서 고칠 점을 적어 주세요" value={cm[i] || ''} onChange={(e) => setCm({ ...cm, [i]: e.target.value })} /> : null} />
        {mode === 'revise' && <div><label className="label" htmlFor="gn">전체 의견 (선택)</label><textarea id="gn" className="input" value={note} onChange={(e) => setNote(e.target.value)} /></div>}
        <Err>{err}</Err>
      </div>
      {!closed && <div className="fixed inset-x-0 bottom-0 mx-auto flex max-w-[430px] gap-2 border-t border-line bg-surface p-4">
        {mode === 'review' ? <>
          <button className="btn btn-lg flex-1" onClick={() => setMode('revise')}>수정 요청</button>
          <button className="btn btn-primary btn-lg flex-1" disabled={busy} onClick={() => confirm('이 내용으로 승인하면 게재 절차가 진행됩니다. 승인할까요?') && act('approve', {}, '승인되었습니다. 곧 게재됩니다.')}>승인하기</button></> : <>
          <button className="btn btn-lg" onClick={() => setMode('review')}>취소</button>
          <button className="btn btn-primary btn-lg flex-1" disabled={busy} onClick={() => !comments.length && !note.trim() ? setErr('수정 의견을 한 개 이상 입력해 주세요.') : act('revise', { comments, generalNote: note }, '수정 요청을 보냈습니다. 반영되면 다시 알려드립니다.')}>수정 요청 보내기{comments.length ? ` (${comments.length})` : ''}</button></>}
      </div>}
    </div>
  )
}

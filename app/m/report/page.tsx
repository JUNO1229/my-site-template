'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { api, shrinkImage } from '@/lib/client'
import { Err } from '@/components/pn'

const CATS = ['피지컬AI', '레저산업', '브랜딩·마케팅', '의료', '지역·동정', '기타']
const DESIRED = ['가능한 빨리(당일)', '내일', '이번 주 안', '날짜 협의']
type Ph = { id: string; url: string }
const KEY = 'pn-report-draft'
export default function ReportForm() {
  const router = useRouter(); const fileRef = useRef<HTMLInputElement>(null); const attRef = useRef<HTMLInputElement>(null)
  const [f, setF] = useState({ category: '', title: '', eventAt: '', place: '', memo: '', desiredDate: DESIRED[0], consent: false })
  const [photos, setPhotos] = useState<Ph[]>([]); const [atts, setAtts] = useState<{ id: string; name: string }[]>([])
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [up, setUp] = useState(0)
  useEffect(() => { try { const s = localStorage.getItem(KEY); if (s) setF((x) => ({ ...x, ...JSON.parse(s), consent: false })) } catch {} }, [])
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(f)) } catch {} }, [f])
  const set = (k: string, v: string | boolean) => setF((x) => ({ ...x, [k]: v }))
  const upload = async (files: FileList | null, att = false) => {
    if (!files) return; setErr('')
    for (const file of Array.from(files)) {
      setUp((n) => n + 1)
      try {
        const small = att ? file : await shrinkImage(file); const fd = new FormData(); fd.append('file', small)
        const r = await api<{ mediaId: string }>('/media', { form: fd })
        att ? setAtts((a) => [...a, { id: r.mediaId, name: file.name }]) : setPhotos((p) => [...p, { id: r.mediaId, url: `/api/media/${r.mediaId}` }])
      } catch (e) { setErr((e as Error).message) } finally { setUp((n) => n - 1) }
    }
  }
  const submit = async () => {
    setErr('')
    if (!f.title.trim() && !f.memo.trim()) return setErr('제목 또는 내용 메모 중 하나는 입력해 주세요.')
    if (!f.category) return setErr('분야를 선택해 주세요.')
    if (!photos.length) return setErr('사진을 1장 이상 추가해 주세요.')
    if (!f.consent) return setErr('사진 권리·인물 동의에 체크해 주세요.')
    setBusy(true)
    try { const r = await api<{ no: string; deadlineHours: number }>('/reports', { json: { ...f, photoIds: photos.map((p) => p.id), attachmentIds: atts.map((a) => a.id) } }); try { localStorage.removeItem(KEY) } catch {}; router.replace(`/m/done?no=${r.no}&h=${r.deadlineHours}`) }
    catch (e) { setErr((e as Error).message + ' 입력한 내용은 기기에 저장되어 있으니 다시 보내기를 눌러 주세요.') } finally { setBusy(false) }
  }
  return (
    <main className="pb-28">
      <div className="flex items-center gap-3 border-b border-line bg-surface px-4 py-3"><Link href="/m" aria-label="뒤로" className="grid size-11 place-items-center text-xl">‹</Link><b>기사 제보</b></div>
      <div className="space-y-5 px-4 py-5">
        <section><span className="label">사진 (첫 장이 대표사진)</span>
          <div className="flex flex-wrap gap-2">
            {photos.map((p, i) => <div key={p.id} className="relative"><img src={p.url} alt="" className="size-20 rounded-lg object-cover" />{i === 0 && <span className="chip chip-navy absolute left-1 top-1">대표</span>}
              <button aria-label="사진 빼기" onClick={() => setPhotos((x) => x.filter((y) => y.id !== p.id))} className="absolute -right-2 -top-2 grid size-7 place-items-center rounded-full bg-ink text-xs text-bg">✕</button></div>)}
            <button onClick={() => fileRef.current?.click()} className="grid size-20 place-items-center rounded-lg border-2 border-dashed border-line text-sm text-muted">{up ? '올리는 중' : '+ 촬영·선택'}</button>
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { upload(e.target.files); e.target.value = '' }} />
          <p className="mt-1 text-xs text-muted">사진은 기기에서 줄여 전송되며, 촬영 위치 정보는 제거됩니다.</p></section>
        <section><span className="label">분야</span><div className="flex flex-wrap gap-2">{CATS.map((c) => <button key={c} aria-pressed={f.category === c} onClick={() => set('category', c)} className={`min-h-11 rounded-full border px-4 text-sm font-semibold ${f.category === c ? 'border-primary bg-primary text-onprimary' : 'border-line bg-surface'}`}>{c}</button>)}</div></section>
        <div><label className="label" htmlFor="t">행사·소식 제목</label><input id="t" className="input" value={f.title} onChange={(e) => set('title', e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label" htmlFor="e">일시</label><input id="e" className="input" placeholder="예: 10.29 19:00" value={f.eventAt} onChange={(e) => set('eventAt', e.target.value)} /></div>
          <div><label className="label" htmlFor="p">장소</label><input id="p" className="input" value={f.place} onChange={(e) => set('place', e.target.value)} /></div></div>
        <div><label className="label" htmlFor="m">내용 메모</label><textarea id="m" className="input" placeholder="무슨 일이 있었는지 편하게 적어 주세요. (키보드의 마이크로 음성 입력도 됩니다)" value={f.memo} onChange={(e) => set('memo', e.target.value)} /></div>
        <div><span className="label">참고 파일 (PDF·한글·워드, 선택)</span>
          {atts.map((a) => <p key={a.id} className="mb-1 text-sm">📎 {a.name}</p>)}
          <button className="btn" onClick={() => attRef.current?.click()}>파일 추가</button><input ref={attRef} type="file" accept=".pdf,.hwp,.hwpx,.docx" hidden onChange={(e) => { upload(e.target.files, true); e.target.value = '' }} /></div>
        <div><label className="label" htmlFor="d">희망 게재일</label><select id="d" className="input" value={f.desiredDate} onChange={(e) => set('desiredDate', e.target.value)}>{DESIRED.map((d) => <option key={d}>{d}</option>)}</select></div>
        <label className="card flex items-start gap-3 p-4 text-sm"><input type="checkbox" className="mt-1 size-5" checked={f.consent} onChange={(e) => set('consent', e.target.checked)} />
          <span>제보하는 사진의 저작권이 있거나 사용 허락을 받았고, 사진 속 인물에게 게재 동의를 받았습니다. (필수)</span></label>
      </div>
      <div className="fixed inset-x-0 bottom-0 mx-auto max-w-[430px] border-t border-line bg-surface p-4">
        <Err>{err}</Err><button className="btn btn-primary btn-lg mt-2 w-full" disabled={busy || up > 0} onClick={submit}>{busy ? '보내는 중…' : '제보 보내기'}</button></div>
    </main>
  )
}

'use client'
import Link from 'next/link'
import { use, useState } from 'react'
import { useApi, fmt, remain } from '@/lib/client'
import { Chip, Thumb } from '@/components/pn'

const CH: Record<string, string> = { HOMEPAGE: '홈페이지', FACEBOOK: '페이스북', BLOG: '블로그', PORTAL: '포털' }
const STEPS = [['RECEIVED', '접수'], ['DRAFTING', '작성'], ['CONFIRM_REQ', '고객 확인'], ['PUBLISHED', '게재']]
const idx = (s: string) => ({ RECEIVED: 0, DRAFTING: 1, REVISION: 1, CONFIRM_REQ: 2, APPROVED: 3, SCHEDULED: 3, PUBLISHED: 4, CORRECTION: 4, REJECTED: -1 } as Record<string, number>)[s]
export default function Detail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params); const { data, error } = useApi<any>(`/reports/${id}`); const [copied, setCopied] = useState(false)
  if (error) return <p className="p-5 text-bad">{error.message}</p>
  if (!data) return <p className="p-5 text-muted">불러오는 중…</p>
  const { report: r } = data; const url = data.articleUrl ? location.origin + data.articleUrl : ''
  return (
    <main className="space-y-4 px-4 py-4">
      <Link href="/m/articles" className="text-sm text-muted">‹ 내 기사</Link>
      <Thumb id={r.coverId} className="aspect-video w-full rounded-xl" />
      <div><Chip status={r.status} customer /><h1 className="serif mt-2 text-xl font-extrabold">{r.title}</h1><p className="mt-1 text-xs text-muted">접수번호 {r.no} · {r.publishedAt ? `게재 ${fmt(r.publishedAt)}` : `접수 ${fmt(r.createdAt)}`}{r.ownerName && ` · ${r.ownerName} 기자`}</p></div>
      {r.status === 'REJECTED' && <p className="rounded-xl bg-badbg p-3 text-sm text-bad">반려 사유: {r.rejectReason}</p>}
      {r.status === 'CONFIRM_REQ' && <Link href={`/m/confirm/${r.id}`} className="btn btn-primary btn-lg w-full">기사 확인하기 · {data.confirmOpen && remain(data.confirmOpen.deadline)}</Link>}
      {data.articleUrl && <div className="card space-y-2 p-4"><p className="break-all text-sm">{url}</p>
        <div className="flex gap-2"><button className="btn flex-1" onClick={() => { navigator.clipboard?.writeText(url); setCopied(true) }}>{copied ? '복사됨' : '링크 복사'}</button>
          <button className="btn flex-1" onClick={() => navigator.share ? navigator.share({ title: r.title, url }) : window.open(url)}>공유</button>
          <a className="btn btn-primary flex-1" href={data.articleUrl}>기사 보기</a></div></div>}
      {r.status !== 'PUBLISHED' && r.status !== 'REJECTED' && <ol className="flex justify-between text-xs">{STEPS.map(([, l], i) => <li key={l} className={`flex-1 text-center ${i < idx(r.status) ? 'text-ok' : i === idx(r.status) - 0 ? 'font-bold text-primary' : 'text-muted'}`}>{i + 1}. {l}</li>)}</ol>}
      {!!data.distributions.length && <section className="card p-4"><h2 className="mb-2 text-sm font-bold">배포 채널</h2>{data.distributions.map((d: any) => <p key={d.channel} className="flex justify-between py-1 text-sm"><span>{CH[d.channel]}</span><span className="text-muted">{d.status === 'DONE' ? '완료' : '대기'}</span></p>)}</section>}
      <section className="card p-4"><h2 className="mb-2 text-sm font-bold">제보 내용</h2><p className="whitespace-pre-wrap text-sm text-muted">{[r.eventAt, r.place].filter(Boolean).join(' · ')}{r.memo ? '\n' + r.memo : ''}</p></section>
      <section className="card p-4"><h2 className="mb-2 text-sm font-bold">처리 이력</h2><ul className="space-y-2">{[...data.history].reverse().map((h: any, i: number) => <li key={i} className="flex gap-3 text-sm"><span className="w-24 shrink-0 text-xs text-muted">{fmt(h.at)}</span>{h.text}</li>)}</ul></section>
    </main>
  )
}

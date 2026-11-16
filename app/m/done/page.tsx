'use client'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function Done() {
  const q = useSearchParams(); const steps = ['접수', '작성', '고객 확인', '게재']
  return (
    <main className="space-y-5 px-4 py-8 text-center">
      <div className="mx-auto grid size-14 place-items-center rounded-full bg-okbg text-2xl text-ok">✓</div>
      <h1 className="text-xl font-bold">제보가 접수되었습니다</h1>
      <p className="card py-3 text-sm text-muted">접수번호 <b className="block text-lg text-ink">{q.get('no')}</b></p>
      <ol className="flex justify-between text-xs">{steps.map((s, i) => <li key={s} className={`flex-1 ${i === 0 ? 'font-bold text-primary' : 'text-muted'}`}><span className={`mx-auto mb-1 grid size-7 place-items-center rounded-full ${i === 0 ? 'bg-primary text-onprimary' : 'bg-line'}`}>{i + 1}</span>{s}</li>)}</ol>
      <p className="rounded-xl bg-warnbg p-3 text-sm text-warn">기사 확인을 요청드린 뒤 {q.get('h') || 48}시간 안에 응답이 없으면 자동 승인되어 게재됩니다.</p>
      <div className="space-y-2"><Link href="/m/articles" className="btn btn-primary btn-lg w-full">내 기사에서 진행 보기</Link><Link href="/m/report" className="btn btn-lg w-full">다른 소식 이어서 제보</Link><Link href="/m" className="btn w-full">홈</Link></div>
    </main>
  )
}
export default function Page() { return <Suspense><Done /></Suspense> }

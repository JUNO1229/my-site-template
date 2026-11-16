'use client'
import { useApi } from '@/lib/client'
const h = (v: number | null) => (v == null ? '-' : v < 1 ? `${Math.round(v * 60)}분` : `${v.toFixed(1)}시간`)
export default function Stats() {
  const { data: s } = useApi<any>('/desk/stats'); if (!s) return <p className="p-5 text-muted">불러오는 중…</p>
  const cats = Object.entries(s.byCategory) as [string, number][]; const max = Math.max(1, ...cats.map(([, n]) => n))
  return (
    <main className="space-y-4 p-5"><h1 className="serif text-2xl font-extrabold">통계</h1>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">{[['접수', s.received], ['게재', s.published], ['평균 접수→게재', h(s.avgHoursToPublish)], ['자동 승인 비율', `${Math.round(s.autoApproveRate * 100)}%`], ['반려율', `${Math.round(s.rejectRate * 100)}%`]].map(([l, v]) => <div key={l as string} className="card p-4"><p className="text-xs text-muted">{l}</p><p className="mt-1 text-2xl font-bold">{v}</p></div>)}</div>
      <section className="card p-4"><h2 className="mb-2 font-bold">단계별 평균 소요시간</h2><p className="text-sm">접수→배정 {h(s.stages.assign)} · 고객 확인 {h(s.stages.confirm)}</p></section>
      <section className="card p-4"><h2 className="mb-3 font-bold">분야별 게재</h2>{!cats.length ? <p className="text-sm text-muted">게재된 기사가 없습니다.</p> : cats.map(([c, n]) => <div key={c} className="mb-2 flex items-center gap-3 text-sm"><span className="w-28">{c}</span><div className="h-4 rounded bg-primary" style={{ width: `${(n / max) * 60}%` }} /><span>{n}</span></div>)}</section>
    </main>
  )
}

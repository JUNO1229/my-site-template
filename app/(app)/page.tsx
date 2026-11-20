import Link from "next/link"
import * as R from "@/lib/repo"
import { Grade, Stg } from "@/components/ui"
export const dynamic = "force-dynamic"

export default async function Dashboard() {
  const [g, f, q, p] = await Promise.all([R.gradeCounts(), R.followups(), R.queue(), R.pendingCandidates()])
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-4">
        {g.map((x) => <div key={x.grade} className="card"><Grade g={x.grade} /> <div className="mt-1 text-2xl font-bold">{x.n}</div><div className="text-xs text-slate-500">리드</div></div>)}
        <Link href="/enrichment" className="card hover:bg-slate-50"><div className="text-xs text-slate-500">보강 필요(번호 없는 A/B)</div><div className="mt-1 text-2xl font-bold">{q.total}</div><div className="text-xs text-slate-500">검수 대기 {p.length}건</div></Link>
      </div>
      <section className="card">
        <h2 className="mb-2 font-semibold">후속 조치 ({f.length}건 · 기한 경과/오늘/7일 이내)</h2>
        {f.length === 0 ? <p className="text-sm text-slate-500">예정된 후속 조치가 없습니다.</p> : (
          <table className="w-full"><thead><tr><th className="th">알림</th><th className="th">필요도</th><th className="th">리드</th><th className="th">단계</th><th className="th">다음 조치</th><th className="th">날짜</th><th className="th">담당</th></tr></thead>
            <tbody className="divide-y">{f.map((r) => (
              <tr key={r.id}><td className={`td font-medium ${r.label === "기한 경과" ? "text-red-600" : ""}`}>{r.label}</td><td className="td"><Grade g={r.grade} /></td>
                <td className="td"><Link className="underline" href={`/leads/${r.id}`}>{r.name}</Link></td><td className="td"><Stg s={r.stage} /></td>
                <td className="td">{r.next_action}</td><td className="td">{r.next_action_on}</td><td className="td">{r.owner}</td></tr>))}</tbody></table>)}
      </section>
    </>
  )
}

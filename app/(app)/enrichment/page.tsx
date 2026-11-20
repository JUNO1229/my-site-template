import Link from "next/link"
import * as R from "@/lib/repo"
import * as A from "../actions"
import { Flash, Grade } from "@/components/ui"
export const dynamic = "force-dynamic"

export default async function Enrichment({ searchParams }: { searchParams: Promise<{ err?: string; ok?: string }> }) {
  const sp = await searchParams
  const [q, cands, un] = await Promise.all([R.queue(), R.pendingCandidates(), R.unresolved()])
  const back = "/enrichment"
  return (
    <>
      <Flash err={sp.err} ok={sp.ok} />
      <section className="card space-y-2">
        <h2 className="font-semibold">후보 검수 ({cands.length}건 대기)</h2>
        <p className="text-xs text-slate-500">수집된 후보는 사람이 승인해야 연락처에 반영됩니다. 차단·접속 실패 사이트는 우회하지 말고 수동 확인하세요.</p>
        {cands.map((c) => (
          <form key={c.id} className="flex flex-wrap items-center gap-2 border-t pt-2 text-sm"><input type="hidden" name="id" value={c.id} /><input type="hidden" name="back" value={back} />
            <Grade g={c.grade} /><Link className="underline" href={`/leads/${c.lead_id}`}>{c.name}</Link><span>{c.channel}: <code>{c.value}</code></span>
            <span className="text-xs text-slate-500">{c.status} · {c.source_url ?? "-"} {c.note}</span>
            {c.status === "pending" && <><input name="reviewer" placeholder="검수자" required className="input w-28" />
              <button formAction={A.approve} name="official" value="1" className="btn">공식 확인 승인</button>
              <button formAction={A.approve} name="official" value="0" className="btn-ghost">제3자 승인</button>
              <button formAction={A.reject} className="btn-ghost">반려</button></>}
          </form>))}
      </section>
      <section className="card">
        <h2 className="mb-2 font-semibold">보강 큐 — 전화번호 없는 A/B 리드 ({q.total}건)</h2>
        <div className="max-h-[32rem] overflow-y-auto"><table className="w-full"><thead><tr><th className="th">필요도</th><th className="th">리드</th><th className="th">공식 사이트 URL로 수집</th><th className="th">수동 후보</th></tr></thead>
          <tbody className="divide-y">{q.rows.map((r) => (
            <tr key={r.id}><td className="td"><Grade g={r.grade} /></td><td className="td"><Link className="underline" href={`/leads/${r.id}`}>{r.name}</Link><div className="text-xs text-slate-500">{r.sido}</div></td>
              <td className="td"><form action={A.collect} className="flex gap-1"><input type="hidden" name="lead_id" value={r.id} /><input type="hidden" name="back" value={back} /><input name="url" type="url" required placeholder="https://" className="input" /><button className="btn-ghost">수집</button></form></td>
              <td className="td"><form action={A.addCandidate} className="flex gap-1"><input type="hidden" name="lead_id" value={r.id} /><input type="hidden" name="back" value={back} /><input name="value" required placeholder="대표번호" className="input w-32" /><input name="source_url" placeholder="출처 URL" className="input" /><button className="btn-ghost">등록</button></form></td></tr>))}</tbody></table></div>
      </section>
      <section className="card"><h2 className="mb-2 font-semibold">확인 실패 이력</h2>
        <ul className="text-sm">{un.map((u) => <li key={u.facility}><b>{u.facility}</b> — {u.reason} <span className="text-slate-500">→ {u.next_step}</span></li>)}</ul></section>
    </>
  )
}

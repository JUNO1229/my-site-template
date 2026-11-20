import * as R from "@/lib/repo"
import { STAGES, STAGE_KO } from "@/lib/domain"
export const dynamic = "force-dynamic"

export default async function Analysis() {
  const [cov, fun, pts] = await Promise.all([R.kindCoverage(), R.funnel(), R.pointsSummary()])
  const cell = (g: string, s: string) => fun.find((x) => x.grade === g && x.stage === s)?.n ?? 0
  return (
    <>
      <section className="card overflow-x-auto"><h2 className="mb-2 font-semibold">유형별 커버리지 (확대 우선순위)</h2>
        <table className="w-full"><thead><tr>{["유형", "전체", "A", "B", "C", "연락처 확보율(%)"].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
          <tbody className="divide-y">{cov.map((r) => <tr key={r.kind}><td className="td">{r.kind}</td><td className="td">{r.total}</td><td className="td">{r.a}</td><td className="td">{r.b}</td><td className="td">{r.c}</td><td className="td">{r.phone_rate}</td></tr>)}</tbody></table>
        <p className="mt-2 text-xs text-slate-500">새 대상(캠핑장·수목원·동물원·박물관·해수욕장·축제)은 sales-lead-system 의 sources.yaml 설정으로 추가하고 시드를 다시 적재합니다.</p></section>
      <section className="card overflow-x-auto"><h2 className="mb-2 font-semibold">영업 진행 현황 (등급 × 단계)</h2>
        <table className="w-full"><thead><tr><th className="th">필요도</th>{STAGES.map((s) => <th key={s} className="th">{STAGE_KO[s]}</th>)}</tr></thead>
          <tbody className="divide-y">{["A", "B", "C"].map((g) => <tr key={g}><td className="td font-bold">{g}</td>{STAGES.map((s) => <td key={s} className="td">{cell(g, s)}</td>)}</tr>)}</tbody></table></section>
      <section className="card"><h2 className="mb-2 font-semibold">영업 포인트 현황</h2>
        {pts.length === 0 ? <p className="text-sm text-slate-500">아직 등록된 영업 포인트가 없습니다. 리드 상세에서 제안을 추가하세요.</p> :
          <ul className="text-sm">{pts.map((p) => <li key={p.kind + p.category}>{p.kind} · <code>{p.category}</code> · {p.n}건</li>)}</ul>}</section>
    </>
  )
}

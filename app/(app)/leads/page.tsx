import Link from "next/link"
import * as R from "@/lib/repo"
import { Conf, Grade, Stg } from "@/components/ui"
import { STAGES, STAGE_KO } from "@/lib/domain"
export const dynamic = "force-dynamic"
type SP = Record<string, string | string[] | undefined>
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || ""

export default async function Leads({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams
  const grades = (one(sp.grades) || "A,B").split(",").filter((g) => g && "ABC".includes(g))
  const filter = { grades, sido: one(sp.sido), kind: one(sp.kind), stage: one(sp.stage), q: one(sp.q), mobile: one(sp.mobile) === "1",
    phone: (one(sp.phone) as "has" | "none") || undefined, page: Number(one(sp.page)) || 1 }
  const [{ rows, total, page, pageSize }, fc] = await Promise.all([R.listLeads(filter), R.facets()])
  const qs = (o: Record<string, string | number>) => new URLSearchParams({ ...Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, one(v)])), ...Object.fromEntries(Object.entries(o).map(([k, v]) => [k, String(v)])) }).toString()
  const pages = Math.max(1, Math.ceil(total / pageSize))
  return (
    <>
      <form className="card grid gap-2 sm:grid-cols-4 lg:grid-cols-8" method="get">
        <select name="grades" defaultValue={grades.join(",")} className="input"><option value="A">A</option><option value="A,B">A+B</option><option value="A,B,C">전체</option><option value="B">B</option><option value="C">C</option></select>
        <select name="sido" defaultValue={filter.sido} className="input"><option value="">시도 전체</option>{fc.sidos.map((v) => <option key={v}>{v}</option>)}</select>
        <select name="kind" defaultValue={filter.kind} className="input"><option value="">유형 전체</option>{fc.kinds.map((v) => <option key={v}>{v}</option>)}</select>
        <select name="stage" defaultValue={filter.stage} className="input"><option value="">단계 전체</option>{STAGES.map((s) => <option key={s} value={s}>{STAGE_KO[s]}</option>)}</select>
        <select name="phone" defaultValue={filter.phone ?? ""} className="input"><option value="">연락처 전체</option><option value="has">있음</option><option value="none">없음</option></select>
        <input name="q" defaultValue={filter.q} placeholder="이름 검색" className="input" />
        <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="mobile" value="1" defaultChecked={filter.mobile} />이동식·행사성 포함</label>
        <div className="flex gap-2"><button className="btn">적용</button><a className="btn-ghost" href={`/api/export?${qs({})}`}>CSV</a></div>
      </form>
      <p className="text-sm text-slate-500">{total.toLocaleString()}건 · {page}/{pages} 페이지</p>
      <div className="card overflow-x-auto p-0">
        <table className="w-full"><thead className="border-b bg-slate-50"><tr>{["필요도", "시도", "시설·기관명", "유형", "영업단계", "대표전화", "신뢰도", "다음 조치일"].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
          <tbody className="divide-y">{rows.map((r) => (
            <tr key={r.id} className="hover:bg-slate-50"><td className="td"><Grade g={r.grade} /></td><td className="td">{r.sido}</td>
              <td className="td"><Link className="font-medium underline" href={`/leads/${r.id}`}>{r.name}</Link></td><td className="td">{r.facility_kind}</td>
              <td className="td"><Stg s={r.stage} /></td><td className="td">{r.phone ?? <span className="text-slate-400">없음</span>}</td>
              <td className="td"><Conf c={r.phone_confidence} /></td><td className="td">{r.next_action_on}</td></tr>))}</tbody></table>
      </div>
      <div className="flex gap-2">
        {page > 1 && <Link className="btn-ghost" href={`/leads?${qs({ page: page - 1 })}`}>이전</Link>}
        {page < pages && <Link className="btn-ghost" href={`/leads?${qs({ page: page + 1 })}`}>다음</Link>}
      </div>
    </>
  )
}

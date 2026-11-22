import Link from "next/link"
import { q } from "@/lib/db"
import { facets, PAGE, searchLeads, type Filter } from "@/lib/queries"
import FilterBar from "@/components/FilterBar"
import LeadTable from "@/components/LeadTable"

export default async function Leads({ searchParams }: { searchParams: Promise<Filter> }) {
  const f = await searchParams
  const [{ rows, total }, fc, projects] = await Promise.all([searchLeads(f), facets(), q<{ id: number; name: string }>(`SELECT id,name FROM projects WHERE status='active' ORDER BY id DESC`)])
  const page = Number(f.page) || 1
  const qs = (p: number) => "?" + new URLSearchParams({ ...(f as any), page: String(p) }).toString()
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2"><h1 className="text-lg font-bold">영업대상 DB</h1>
        <Link className="btn ml-auto" href="/leads/new">직접 입력</Link><Link className="btn-ghost" href="/leads/import">엑셀/CSV 업로드</Link><Link className="btn-ghost" href="/leads/card">명함 입력</Link></div>
      <FilterBar action="/leads" f={f} facets={fc} />
      <LeadTable rows={rows} total={total} filter={{ ...f, page: undefined }} projects={projects} />
      <div className="flex gap-3 text-sm">
        {page > 1 && <Link className="btn-ghost" href={qs(page - 1)}>이전</Link>}
        <span className="text-slate-500">{page} / {Math.max(1, Math.ceil(total / PAGE))}</span>
        {page * PAGE < total && <Link className="btn-ghost" href={qs(page + 1)}>다음</Link>}
      </div>
    </div>
  )
}

import Link from "next/link"
import { notFound } from "next/navigation"
import { q } from "@/lib/db"
import { SEL } from "@/lib/queries"
import ProjectTargets from "@/components/ProjectTargets"

export default async function Project({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [p] = await q<any>(`SELECT * FROM projects WHERE id=$1`, [Number(id)]); if (!p) notFound()
  const rows = await q<any>(`SELECT ${SEL}, pl.channel, pl.stage,
      (SELECT max(sent_at) FROM dispatches d WHERE d.project_id=pl.project_id AND d.lead_id=l.id) last_sent,
      COALESCE((SELECT sum(view_count) FROM dispatches d WHERE d.project_id=pl.project_id AND d.lead_id=l.id),0)::int views
    FROM project_leads pl JOIN leads l ON l.id=pl.lead_id WHERE pl.project_id=$1 ORDER BY l.org_name`, [p.id])
  const materials = await q<{ id: number; name: string }>(`SELECT id,name FROM materials ORDER BY id DESC`)
  const stages = await q<any>(`SELECT stage, count(*) n FROM project_leads WHERE project_id=$1 GROUP BY 1`, [p.id])
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3"><h1 className="text-lg font-bold">{p.name}</h1><span className="text-sm text-slate-500">{p.product}</span>
        <Link className="btn ml-auto" href={`/leads?notin=${p.id}`}>대상 선별(필터/태그)</Link></div>
      <div className="flex gap-2 text-xs">{stages.map((s: any) => <span key={s.stage} className="badge">{s.stage} {s.n}</span>)}</div>
      {materials.length === 0 && <p className="text-sm text-amber-700">발송하려면 먼저 <Link className="underline" href="/materials">영업자료</Link>를 등록하세요.</p>}
      <ProjectTargets projectId={p.id} rows={rows} materials={materials} />
    </div>
  )
}

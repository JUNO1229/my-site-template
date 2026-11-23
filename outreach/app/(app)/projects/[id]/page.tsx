import Link from "next/link"
import { notFound } from "next/navigation"
import { q } from "@/lib/db"
import { SEL } from "@/lib/queries"
import { recommendFor } from "@/lib/recommend"
import { saveProject } from "@/app/actions"
import ProjectTargets from "@/components/ProjectTargets"
import DocUpload from "@/components/DocUpload"
import Recommendations from "@/components/Recommendations"

export const maxDuration = 60 // 스캔 PDF OCR 등 서버 액션 허용 시간
export default async function Project({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [p] = await q<any>(`SELECT * FROM projects WHERE id=$1`, [Number(id)]); if (!p) notFound()
  const [rows, materials, stages, recs] = await Promise.all([
    q<any>(`SELECT ${SEL}, pl.channel, pl.stage,
      COALESCE((SELECT sum(view_count) FROM dispatches d WHERE d.project_id=pl.project_id AND d.lead_id=l.id),0)::int views
      FROM project_leads pl JOIN leads l ON l.id=pl.lead_id WHERE pl.project_id=$1 ORDER BY l.org_name`, [p.id]),
    q<{ id: number; name: string }>(`SELECT id,name FROM materials ORDER BY id DESC`),
    q<any>(`SELECT stage, count(*) n FROM project_leads WHERE project_id=$1 GROUP BY 1`, [p.id]),
    recommendFor(p.id, p)])
  const save = saveProject.bind(null, p.id)
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3"><h1 className="text-lg font-bold">{p.name}</h1><span className="text-sm text-slate-500">{p.product}</span>
        <div className="ml-auto flex gap-1 text-xs">{stages.map((s: any) => <span key={s.stage} className="badge">{s.stage} {s.n}</span>)}</div></div>

      <section className="card space-y-3">
        <h2 className="font-semibold">① 프로젝트 개요와 분석</h2>
        <form action={save} className="grid gap-3 md:grid-cols-2">
          <div><label className="label">프로젝트명</label><input name="name" defaultValue={p.name} className="input" /></div>
          <div><label className="label">상품/서비스</label><input name="product" defaultValue={p.product ?? ""} className="input" /></div>
          <div className="md:col-span-2"><label className="label">방법 1. 개요 직접 입력</label><textarea name="overview" rows={4} defaultValue={p.overview ?? ""} className="input" placeholder="사업 목적, 영업 대상 유형, 대상 지역 등" /></div>
          <div className="md:col-span-2 rounded bg-indigo-50 p-3 text-sm">
            <div className="mb-2 text-xs text-indigo-800">{p.analysis_note ?? "아직 분석 전입니다."} — 아래 항목은 직접 고칠 수 있습니다(쉼표 구분).</div>
            <div className="grid gap-2 md:grid-cols-3">
              <div><label className="label">검색 키워드</label><input name="keywords" defaultValue={p.keywords.join(", ")} className="input" /></div>
              <div><label className="label">대상 태그</label><input name="target_tags" defaultValue={p.target_tags.join(", ")} className="input" /></div>
              <div><label className="label">대상 지역(시도)</label><input name="regions" defaultValue={p.regions.join(", ")} className="input" /></div>
            </div></div>
          <div className="flex gap-2 md:col-span-2">
            <button className="btn" name="intent" value="save">프로필 저장 → 추천 갱신</button>
            <button className="btn-ghost" name="intent" value="analyze">개요로 다시 분석</button></div>
        </form>
        <DocUpload projectId={p.id} names={p.doc_names ?? []} />
      </section>

      <section className="card space-y-2">
        <h2 className="font-semibold">② 추천 영업처 <span className="text-xs font-normal text-slate-500">프로필과 DB를 대조해 점수화한 목록 (이미 담은 대상·연락금지 제외)</span></h2>
        <Recommendations projectId={p.id} recs={recs} />
      </section>

      <section className="space-y-2">
        <div className="flex items-center gap-3"><h2 className="font-semibold">③ 영업 대상 및 발송 ({rows.length})</h2>
          <Link className="btn-ghost ml-auto" href={`/leads?notin=${p.id}`}>직접 검색해서 추가 (필터/태그)</Link></div>
        {materials.length === 0 && <p className="text-sm text-amber-700">발송하려면 먼저 <Link className="underline" href="/materials">영업자료</Link>를 등록하세요.</p>}
        <ProjectTargets projectId={p.id} rows={rows} materials={materials} />
      </section>
    </div>
  )
}

import Link from "next/link"
import { q } from "@/lib/db"
import { createProject } from "@/app/actions"

export default async function Projects() {
  const rows = await q<any>(`SELECT p.*, (SELECT count(*) FROM project_leads WHERE project_id=p.id) targets,
    (SELECT count(*) FROM dispatches WHERE project_id=p.id) sends FROM projects p ORDER BY p.id DESC`)
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold">프로젝트(영업 캠페인)</h1>
      <form action={createProject} className="card grid gap-3 md:grid-cols-2">
        <div><label className="label">프로젝트명 *</label><input name="name" required className="input" placeholder="예: 해양수산부 해양레저 관광거점 사업 기관 영업" /></div>
        <div><label className="label">상품/서비스</label><input name="product" className="input" placeholder="예: 모두의플랫폼" /></div>
        <div className="md:col-span-2"><label className="label">프로젝트 개요 (사업 목적·대상·지역을 적을수록 추천이 정확해집니다)</label>
          <textarea name="overview" rows={4} className="input" placeholder="예: 해양수산부 해양레저 관광거점 조성 사업에 참여하는 지자체·관광 시설을 대상으로 모두의플랫폼을 소개..." /></div>
        <div><button className="btn">프로젝트 만들고 분석하기</button></div>
      </form>
      <div className="card !p-0"><table className="w-full"><thead className="border-b bg-slate-50"><tr><th className="th">프로젝트</th><th className="th">상품</th><th className="th">대상</th><th className="th">발송</th><th className="th">상태</th></tr></thead>
        <tbody className="divide-y">{rows.map((p: any) => <tr key={p.id}><td className="td"><Link className="text-indigo-700" href={`/projects/${p.id}`}>{p.name}</Link></td>
          <td className="td">{p.product}</td><td className="td">{p.targets}</td><td className="td">{p.sends}</td><td className="td">{p.status}</td></tr>)}
          {rows.length === 0 && <tr><td className="td text-slate-500" colSpan={5}>아직 프로젝트가 없습니다</td></tr>}</tbody></table></div>
    </div>
  )
}

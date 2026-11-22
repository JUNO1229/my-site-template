import Link from "next/link"
import { q } from "@/lib/db"

export default async function Dashboard() {
  const [c] = await q<any>(`SELECT
    (SELECT count(*) FROM leads WHERE NOT do_not_contact) leads,
    (SELECT count(*) FROM leads WHERE consent_email AND NOT do_not_contact) email_ok,
    (SELECT count(*) FROM leads WHERE consent_sms AND NOT do_not_contact) sms_ok,
    (SELECT count(*) FROM leads WHERE do_not_contact) dnc,
    (SELECT count(*) FROM projects WHERE status='active') projects,
    (SELECT count(*) FROM dispatches WHERE status IN ('sent','simulated','recorded')) sent,
    (SELECT count(*) FROM dispatches WHERE view_count>0) viewed`)
  const bySource = await q<any>(`SELECT source, count(*) n FROM leads GROUP BY 1 ORDER BY 2 DESC`)
  const projects = await q<any>(`SELECT p.id,p.name,p.product,
    (SELECT count(*) FROM project_leads WHERE project_id=p.id) targets,
    (SELECT count(*) FROM project_leads WHERE project_id=p.id AND stage<>'new') touched
    FROM projects p WHERE p.status='active' ORDER BY p.id DESC LIMIT 8`)
  const stat = (label: string, v: number | string) => <div className="card"><div className="text-xs text-slate-500">{label}</div><div className="text-2xl font-bold">{v}</div></div>
  const SRC: Record<string, string> = { manual: "직접입력", upload: "파일업로드", card: "명함", public: "공공데이터" }
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stat("영업대상", c.leads)}{stat("이메일 수신동의", c.email_ok)}{stat("문자 수신동의", c.sms_ok)}{stat("연락금지", c.dnc)}
        {stat("진행 프로젝트", c.projects)}{stat("발송(기록 포함)", c.sent)}{stat("자료 열람", c.viewed)}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <section className="card"><h2 className="mb-2 font-semibold">진행 프로젝트</h2>
          {projects.length === 0 && <p className="text-sm text-slate-500">프로젝트가 없습니다. <Link className="text-indigo-700" href="/projects">새로 만들기</Link></p>}
          <ul className="space-y-1 text-sm">{projects.map((p: any) => <li key={p.id}><Link className="text-indigo-700" href={`/projects/${p.id}`}>{p.name}</Link> <span className="text-slate-500">대상 {p.targets} · 진행 {p.touched}</span></li>)}</ul>
        </section>
        <section className="card"><h2 className="mb-2 font-semibold">DB 구축 경로</h2>
          <ul className="space-y-1 text-sm">{bySource.map((s: any) => <li key={s.source}>{SRC[s.source] ?? s.source}: <b>{s.n}</b></li>)}</ul>
          <div className="mt-3 flex flex-wrap gap-2"><Link className="btn" href="/leads/new">직접 입력</Link><Link className="btn-ghost" href="/leads/import">엑셀/CSV</Link><Link className="btn-ghost" href="/leads/card">명함</Link></div>
        </section>
      </div>
    </div>
  )
}

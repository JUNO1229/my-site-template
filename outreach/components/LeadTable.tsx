"use client"
import { useState, useTransition } from "react"
import { addFilteredToProject, addSelectedToProject, addTagsToLeads, updateLeadFlags } from "@/app/actions"
import type { Lead } from "@/lib/domain"

type Project = { id: number; name: string }
export default function LeadTable({ rows, total, filter, projects }: { rows: Lead[]; total: number; filter: Record<string, string | undefined>; projects: Project[] }) {
  const [sel, setSel] = useState<number[]>([])
  const [pid, setPid] = useState<string>(filter.notin ?? projects[0]?.id?.toString() ?? "")
  const [tag, setTag] = useState("")
  const [msg, setMsg] = useState("")
  const [pending, start] = useTransition()
  const all = rows.length > 0 && sel.length === rows.length
  const toggle = (id: number) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  const run = (fn: () => Promise<unknown>, done: (r: any) => string) => start(async () => { setMsg(done(await fn())) })

  return (
    <div className="space-y-3">
      <div className="card flex flex-wrap items-center gap-2 text-sm">
        <span>선택 {sel.length}건 / 검색결과 {total}건</span>
        <select className="input !w-auto" value={pid} onChange={(e) => setPid(e.target.value)}>
          <option value="">프로젝트 선택</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <button className="btn" disabled={pending || !pid || !sel.length} onClick={() => run(() => addSelectedToProject(Number(pid), sel), (n) => `${n}건을 프로젝트에 추가했습니다`)}>선택 추가</button>
        <button className="btn-ghost" disabled={pending || !pid || !total}
          onClick={() => confirm(`현재 검색 결과 전체(최대 2000건)를 프로젝트에 추가할까요?`) && run(() => addFilteredToProject(Number(pid), filter), (n) => `${n}건을 프로젝트에 추가했습니다`)}>검색결과 전체 추가</button>
        <input className="input !w-32" placeholder="태그(쉼표)" value={tag} onChange={(e) => setTag(e.target.value)} />
        <button className="btn-ghost" disabled={pending || !tag || !sel.length} onClick={() => run(() => addTagsToLeads(sel, tag), () => "태그를 추가했습니다 (새로고침하면 반영)")}>태그 붙이기</button>
        {msg && <span className="text-emerald-700">{msg}</span>}
      </div>
      <div className="card overflow-x-auto !p-0">
        <table className="w-full">
          <thead className="border-b bg-slate-50"><tr>
            <th className="th"><input type="checkbox" checked={all} onChange={() => setSel(all ? [] : rows.map((r) => r.id))} /></th>
            <th className="th">기관</th><th className="th">담당자</th><th className="th">연락처</th><th className="th">지역/업종</th><th className="th">등급</th><th className="th">동의</th><th className="th">태그</th></tr></thead>
          <tbody className="divide-y">
            {rows.map((l) => (
              <tr key={l.id}>
                <td className="td"><input type="checkbox" checked={sel.includes(l.id)} onChange={() => toggle(l.id)} /></td>
                <td className="td font-medium">{l.org_name}<div className="text-xs font-normal text-slate-500">{l.address}</div></td>
                <td className="td">{l.contact_name}<div className="text-xs text-slate-500">{[l.dept, l.title].filter(Boolean).join(" ")}</div></td>
                <td className="td text-xs">{l.email}<br />{l.mobile || l.phone}</td>
                <td className="td text-xs">{l.sido}<br />{l.org_type}</td>
                <td className="td">{l.grade && <span className="badge">{l.grade}</span>}</td>
                <td className="td text-xs">
                  <label className="block"><input type="checkbox" defaultChecked={l.consent_email} onChange={(e) => updateLeadFlags(l.id, { consent_email: e.target.checked })} /> 메일</label>
                  <label className="block"><input type="checkbox" defaultChecked={l.consent_sms} onChange={(e) => updateLeadFlags(l.id, { consent_sms: e.target.checked })} /> 문자</label>
                  <button className="text-red-600 underline" onClick={() => confirm("연락금지 처리하면 모든 채널에서 제외됩니다.") && updateLeadFlags(l.id, { do_not_contact: true })}>연락금지</button>
                </td>
                <td className="td text-xs">{l.tags?.map((t) => <span key={t} className="badge mr-1">{t}</span>)}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td className="td text-slate-500" colSpan={8}>조건에 맞는 대상이 없습니다</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

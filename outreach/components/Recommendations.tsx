"use client"
import { useState, useTransition } from "react"
import { addSelectedToProject } from "@/app/actions"
import type { Rec } from "@/lib/recommend"

export default function Recommendations({ projectId, recs }: { projectId: number; recs: Rec[] }) {
  const [sel, setSel] = useState<number[]>([])
  const [msg, setMsg] = useState("")
  const [pending, start] = useTransition()
  const toggle = (id: number) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  const add = (ids: number[]) => start(async () => { const n = await addSelectedToProject(projectId, ids); setMsg(`${n}건을 프로젝트 대상에 추가했습니다`); setSel([]) })
  if (!recs.length) return <p className="text-sm text-slate-500">추천할 영업처가 없습니다. 위 프로필의 키워드·태그·지역을 보강하거나, 영업대상 DB를 더 쌓아 주세요.</p>
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span>추천 {recs.length}건 · 선택 {sel.length}건</span>
        <button className="btn" disabled={pending || !sel.length} onClick={() => add(sel)}>선택 추가</button>
        <button className="btn-ghost" disabled={pending} onClick={() => add(recs.slice(0, 30).map((r) => r.id))}>상위 30건 추가</button>
        <button className="btn-ghost" onClick={() => setSel(sel.length === recs.length ? [] : recs.map((r) => r.id))}>전체 선택/해제</button>
        {msg && <span className="text-emerald-700">{msg}</span>}
      </div>
      <div className="max-h-[480px] overflow-auto rounded border bg-white"><table className="w-full">
        <thead className="sticky top-0 border-b bg-slate-50"><tr><th className="th"></th><th className="th">기관</th><th className="th">지역/업종</th><th className="th">연락처</th><th className="th">추천 근거</th><th className="th">점수</th></tr></thead>
        <tbody className="divide-y">{recs.map((r) => (
          <tr key={r.id}><td className="td"><input type="checkbox" checked={sel.includes(r.id)} onChange={() => toggle(r.id)} /></td>
            <td className="td font-medium">{r.org_name} {r.grade && <span className="badge">{r.grade}</span>}</td>
            <td className="td text-xs">{r.sido}<br />{r.org_type}</td>
            <td className="td text-xs">{r.email}<br />{r.mobile || r.phone}</td>
            <td className="td text-xs">{r.reasons.join(" · ")}</td><td className="td text-xs">{r.score}</td></tr>))}</tbody></table></div>
    </div>
  )
}

"use client"
import { useState, useTransition } from "react"
import { dispatchMaterial, removeFromProject, setChannel, setStage, type SendReport } from "@/app/actions"
import { CHANNELS, CHANNEL_LABEL, STAGE_LABEL, eligibility, type Channel, type Lead } from "@/lib/domain"

type Row = Lead & { channel: Channel; stage: string; last_sent: string | null; views: number }
export default function ProjectTargets({ projectId, rows, materials }: { projectId: number; rows: Row[]; materials: { id: number; name: string }[] }) {
  const [sel, setSel] = useState<number[]>([])
  const [mat, setMat] = useState(materials[0]?.id?.toString() ?? "")
  const [bulk, setBulk] = useState<Channel>("email")
  const [rep, setRep] = useState<SendReport | null>(null)
  const [pending, start] = useTransition()
  const all = rows.length > 0 && sel.length === rows.length
  const toggle = (id: number) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  const sendable = sel.filter((id) => { const r = rows.find((x) => x.id === id)!; return eligibility(r, r.channel).ok })

  return (
    <div className="space-y-3">
      <div className="card flex flex-wrap items-center gap-2 text-sm">
        <span>선택 {sel.length}건 (발송 가능 {sendable.length})</span>
        <select className="input !w-auto" value={bulk} onChange={(e) => setBulk(e.target.value as Channel)}>{CHANNELS.map((c) => <option key={c} value={c}>{CHANNEL_LABEL[c]}</option>)}</select>
        <button className="btn-ghost" disabled={!sel.length || pending} onClick={() => start(async () => { await setChannel(projectId, sel, bulk) })}>채널 일괄 지정</button>
        <span className="mx-2 text-slate-300">|</span>
        <select className="input !w-auto" value={mat} onChange={(e) => setMat(e.target.value)}><option value="">자료 선택</option>{materials.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
        <button className="btn" disabled={!sel.length || !mat || pending}
          onClick={() => confirm(`선택한 ${sel.length}건에 자료를 발송합니다. (동의 없는 대상은 자동 차단)`) && start(async () => setRep(await dispatchMaterial(projectId, Number(mat), sel)))}>자료 발송</button>
        <button className="btn-ghost" disabled={!sel.length || pending} onClick={() => confirm("프로젝트에서 제외할까요?") && start(async () => { await removeFromProject(projectId, sel); setSel([]) })}>대상 제외</button>
      </div>
      {rep && <div className="card text-sm">결과: 발송 {rep.sent} · 시뮬레이션 {rep.simulated} · 기록 {rep.recorded} · 차단 {rep.blocked} · 실패 {rep.failed}
        {rep.details.length > 0 && <ul className="mt-1 list-disc pl-5 text-xs text-slate-600">{rep.details.slice(0, 10).map((d, i) => <li key={i}>{d}</li>)}</ul>}</div>}
      <div className="card overflow-x-auto !p-0"><table className="w-full">
        <thead className="border-b bg-slate-50"><tr><th className="th"><input type="checkbox" checked={all} onChange={() => setSel(all ? [] : rows.map((r) => r.id))} /></th>
          <th className="th">기관/담당자</th><th className="th">채널</th><th className="th">발송가능</th><th className="th">진행</th><th className="th">열람</th></tr></thead>
        <tbody className="divide-y">{rows.map((r) => { const e = eligibility(r, r.channel); return (
          <tr key={r.id}><td className="td"><input type="checkbox" checked={sel.includes(r.id)} onChange={() => toggle(r.id)} /></td>
            <td className="td font-medium">{r.org_name}<div className="text-xs font-normal text-slate-500">{r.contact_name} {r.email}</div></td>
            <td className="td"><select className="input !w-auto" value={r.channel} onChange={(ev) => start(async () => { await setChannel(projectId, [r.id], ev.target.value as Channel) })}>{CHANNELS.map((c) => <option key={c} value={c}>{CHANNEL_LABEL[c]}</option>)}</select></td>
            <td className="td text-xs">{e.ok ? <span className="text-emerald-700">가능</span> : <span className="text-red-600">{e.reason}</span>}</td>
            <td className="td"><select className="input !w-auto" value={r.stage} onChange={(ev) => start(async () => { await setStage(projectId, r.id, ev.target.value) })}>{Object.entries(STAGE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></td>
            <td className="td text-xs">{r.views > 0 ? `${r.views}회` : "-"}</td></tr>) })}
          {rows.length === 0 && <tr><td className="td text-slate-500" colSpan={6}>대상이 없습니다. 위의 &quot;대상 선별&quot;에서 추가하세요.</td></tr>}</tbody></table></div>
    </div>
  )
}

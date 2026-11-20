import { notFound } from "next/navigation"
import * as R from "@/lib/repo"
import * as A from "../../actions"
import { Conf, Flash, Grade } from "@/components/ui"
import { CHANNELS, CHANNEL_KO, CONF_KO, SALES_CATS, STAGES, STAGE_KO, suggestPoints } from "@/lib/domain"
export const dynamic = "force-dynamic"

export default async function LeadPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ err?: string; ok?: string }> }) {
  const { id: idS } = await params
  const sp = await searchParams
  const id = Number(idS)
  if (!Number.isInteger(id)) notFound()
  const lead = await R.getLead(id)
  if (!lead) notFound()
  const [o, contacts, points, dispatches, docs, wp, cands] = await Promise.all([
    R.getOutreach(id), R.getContacts(id), R.getSalesPoints(id), R.getDispatches(id), R.documents(), R.getWaterParks(id), R.getCandidates(id)])
  const sugg = suggestPoints(lead.facility_kind, lead.name, points.map((p) => p.point))
  const back = `/leads/${id}`
  const H = ({ children }: { children: React.ReactNode }) => <><input type="hidden" name="lead_id" value={id} /><input type="hidden" name="back" value={back} />{children}</>
  const dnc = o.stage === "do_not_contact"
  return (
    <>
      <div><h1 className="text-xl font-bold"><Grade g={lead.grade} /> {lead.name}</h1>
        <p className="text-sm text-slate-600">{lead.sido} · {lead.address || "-"} · {lead.facility_kind} · {lead.operating_status}</p>
        <p className="text-xs text-slate-500">{lead.grade_reason}</p></div>
      <Flash err={sp.err} ok={sp.ok} />
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card space-y-3">
          <h2 className="font-semibold">연락처 <span className="text-xs font-normal text-slate-500">(조직 단위 공개 연락처만)</span></h2>
          {contacts.length === 0 ? <p className="text-sm text-slate-500">연락처가 없습니다. 보강 큐에서 후보를 수집하세요.</p> :
            <ul className="divide-y text-sm">{contacts.map((c) => <li key={c.id} className="py-1.5"><b>{c.value}</b> <Conf c={c.confidence} /> <span className="text-xs text-slate-500">{c.dept} {c.note} {c.verified_on && `· 확인 ${c.verified_on}`}</span>
              {c.source_url && <div className="truncate text-xs text-slate-400">{c.source_url}</div>}</li>)}</ul>}
          <details><summary className="cursor-pointer text-sm text-slate-600">연락처 추가</summary>
            <form action={A.addContact} className="mt-2 space-y-2"><H>
              <input name="value" required placeholder="조직 대표번호" className="input" /><input name="dept" placeholder="부서(개인명 금지)" className="input" />
              <select name="confidence" className="input">{["verified_official", "public_data", "third_party_recheck"].map((c) => <option key={c} value={c}>{CONF_KO[c]}</option>)}</select>
              <input name="source_url" placeholder="출처 URL (공식 확인은 필수)" className="input" /><input name="verified_on" type="date" className="input" />
              <button className="btn">저장</button></H></form></details>
          {cands.length > 0 && <div className="text-xs text-slate-500">보강 후보: {cands.map((c) => `${c.value}(${c.status})`).join(", ")}</div>}
        </section>

        <section className="card space-y-2">
          <h2 className="font-semibold">영업 진행</h2>
          <form action={A.saveOutreach} className="space-y-2"><H>
            <select name="stage" defaultValue={o.stage} className="input">{STAGES.map((s) => <option key={s} value={s}>{STAGE_KO[s]}</option>)}</select>
            <input name="next_action" defaultValue={o.next_action ?? ""} placeholder="다음 조치" className="input" />
            <input name="next_action_on" type="date" defaultValue={o.next_action_on ?? ""} className="input" />
            <input name="owner" defaultValue={o.owner ?? ""} placeholder="담당" className="input" />
            <textarea name="memo" defaultValue={o.memo ?? ""} placeholder="메모" className="input" rows={3} />
            <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="consent" defaultChecked={o.consent_for_email} className="mt-1" />
              <span>이메일·문자·팩스 수신 동의 확인됨 <span className="block text-xs text-slate-500">정보통신망법: 동의 없으면 발송 불가. 최초 접촉은 전화·문의폼·우편.</span></span></label>
            <button className="btn">저장</button></H></form>
          {!dnc && <form action={A.optOut}><H><button className="btn-danger">수신 거부 처리(영구 차단)</button></H></form>}
          {dnc && <p className="text-sm font-medium text-red-600">연락 금지 — 발송·내보내기에서 제외됩니다.</p>}
        </section>

        <section className="card space-y-2">
          <h2 className="font-semibold">발송·접촉 기록</h2>
          {dnc ? <p className="text-sm text-slate-500">연락 금지 리드입니다.</p> : (
            <form action={A.dispatch} className="space-y-2"><H>
              <div className="grid grid-cols-2 gap-2"><select name="channel" className="input">{CHANNELS.map((c) => <option key={c} value={c}>{CHANNEL_KO[c]}{["email", "sms", "fax"].includes(c) ? " (동의 필요)" : ""}</option>)}</select>
                <select name="document_id" className="input"><option value="">자료 없음</option>{docs.map((d) => <option key={d.id} value={d.id}>{d.name} {d.version}</option>)}</select></div>
              <input name="sent_by" required placeholder="발송자" className="input" /><input name="to_value" placeholder="수신처(조직 연락처)" className="input" /><input name="note" placeholder="메모" className="input" />
              <button className="btn">기록 (후속 조치일 +7일)</button></H></form>)}
          <ul className="divide-y text-sm">{dispatches.map((d) => <li key={d.id} className="py-1">{d.sent_on} · {CHANNEL_KO[d.channel as keyof typeof CHANNEL_KO]} · {d.document ?? "-"} · {d.sent_by} <span className="text-xs text-slate-500">{d.note}</span></li>)}</ul>
        </section>

        <section className="card space-y-2">
          <h2 className="font-semibold">영업 포인트 (모두의 플랫폼 연계)</h2>
          <ul className="divide-y text-sm">{points.map((p) => <li key={p.id} className="py-1"><code className="text-xs">{p.category}</code> {p.point}</li>)}</ul>
          {sugg.length > 0 && <div className="space-y-1"><p className="text-xs text-slate-500">제안</p>{sugg.map((s) => (
            <form key={s.point} action={A.addPoint} className="flex items-center gap-2 text-sm"><H><input type="hidden" name="point" value={s.point} /><input type="hidden" name="category" value={s.category} />
              <span className="flex-1"><code className="text-xs">{s.category}</code> {s.point}</span><button className="btn-ghost">추가</button></H></form>))}</div>}
          <form action={A.addPoint} className="flex gap-2"><H><input name="point" required placeholder="직접 입력" className="input" />
            <select name="category" className="input w-36">{SALES_CATS.map((c) => <option key={c}>{c}</option>)}</select><button className="btn">추가</button></H></form>
        </section>
      </div>
      {wp.length > 0 && <section className="card"><h2 className="mb-2 font-semibold">관리 중인 물놀이 관련 공원 ({wp.length})</h2>
        <ul className="grid gap-1 text-sm sm:grid-cols-2">{wp.map((w, i) => <li key={i}>{w.park_name} <span className="text-xs text-slate-500">{w.park_kind} · {w.address}</span></li>)}</ul></section>}
    </>
  )
}

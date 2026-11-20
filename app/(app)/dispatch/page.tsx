import Link from "next/link"
import * as R from "@/lib/repo"
import * as A from "../actions"
import { Flash } from "@/components/ui"
import { CHANNEL_KO } from "@/lib/domain"
export const dynamic = "force-dynamic"

export default async function Dispatch({ searchParams }: { searchParams: Promise<{ err?: string; ok?: string }> }) {
  const sp = await searchParams
  const [docs, hist] = await Promise.all([R.documents(), R.dispatchHistory()])
  return (
    <>
      <Flash err={sp.err} ok={sp.ok} />
      <p className="text-sm text-slate-500">발송을 기록·검증합니다(자동 전송 없음). 이메일·문자·팩스는 수신 동의 리드만, 최초 접촉은 전화·문의폼·우편을 권장합니다. 개별 기록은 리드 상세에서 합니다.</p>
      <section className="card space-y-2"><h2 className="font-semibold">자료 등록 (소개서·도입제안서)</h2>
        <form action={A.registerDoc} className="grid gap-2 sm:grid-cols-5"><input type="hidden" name="back" value="/dispatch" />
          <input name="name" required placeholder="자료명" className="input" /><select name="kind" className="input"><option value="intro">소개서</option><option value="proposal">도입제안서</option><option value="other">기타</option></select>
          <input name="version" defaultValue="v1" className="input" /><input name="url" type="url" placeholder="파일 링크(공유 URL)" className="input" /><button className="btn">저장</button></form>
        <ul className="text-sm">{docs.map((d) => <li key={d.id}>{d.name} {d.version} <span className="text-xs text-slate-500">{d.kind}</span> {d.url && <a className="text-xs underline" href={d.url} target="_blank" rel="noopener noreferrer">링크</a>}</li>)}</ul></section>
      <section className="card overflow-x-auto p-0"><h2 className="p-4 pb-2 font-semibold">발송 이력</h2>
        <table className="w-full"><thead><tr>{["일자", "리드", "채널", "자료", "수신처", "발송자", "메모"].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
          <tbody className="divide-y">{hist.map((h) => <tr key={h.id}><td className="td">{h.sent_on}</td><td className="td"><Link className="underline" href={`/leads/${h.lead_id}`}>{h.name}</Link></td>
            <td className="td">{CHANNEL_KO[h.channel as keyof typeof CHANNEL_KO]}</td><td className="td">{h.document ?? "-"}</td><td className="td">{h.to_value}</td><td className="td">{h.sent_by}</td><td className="td">{h.note}</td></tr>)}</tbody></table></section>
    </>
  )
}

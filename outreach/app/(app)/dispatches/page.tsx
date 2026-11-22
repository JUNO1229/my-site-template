import QRCode from "qrcode"
import { headers } from "next/headers"
import { q } from "@/lib/db"
import { CHANNEL_LABEL } from "@/lib/domain"

const ST: Record<string, string> = { sent: "발송", simulated: "시뮬", recorded: "기록", blocked: "차단", failed: "실패" }
export default async function Dispatches({ searchParams }: { searchParams: Promise<{ qr?: string }> }) {
  const { qr } = await searchParams
  const rows = await q<any>(`SELECT d.*, l.org_name, l.contact_name, p.name project, m.name material FROM dispatches d
    JOIN leads l ON l.id=d.lead_id LEFT JOIN projects p ON p.id=d.project_id LEFT JOIN materials m ON m.id=d.material_id ORDER BY d.id DESC LIMIT 200`)
  const h = await headers(); const base = process.env.PUBLIC_BASE_URL || `https://${h.get("x-forwarded-host") ?? h.get("host")}`
  const qrSvg = qr ? await QRCode.toString(`${base}/s/${qr}`, { type: "svg", margin: 1, width: 180 }) : null
  return (
    <div className="space-y-3">
      <h1 className="text-lg font-bold">발송이력</h1>
      {qrSvg && <div className="card w-fit"><div dangerouslySetInnerHTML={{ __html: qrSvg }} /><div className="text-xs text-slate-500">{base}/s/{qr}</div></div>}
      <div className="card overflow-x-auto !p-0"><table className="w-full"><thead className="border-b bg-slate-50"><tr>
        {["일시", "프로젝트", "대상", "자료", "채널", "상태", "열람", "링크/QR"].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
        <tbody className="divide-y">{rows.map((d: any) => (
          <tr key={d.id}><td className="td text-xs">{new Date(d.sent_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}</td><td className="td">{d.project}</td>
            <td className="td">{d.org_name}<div className="text-xs text-slate-500">{d.contact_name}</div></td><td className="td">{d.material}</td>
            <td className="td">{CHANNEL_LABEL[d.channel as keyof typeof CHANNEL_LABEL]}</td>
            <td className="td">{ST[d.status]}{d.error && <div className="text-xs text-red-600">{d.error}</div>}</td>
            <td className="td">{d.view_count ? `${d.view_count}회` : "-"}</td>
            <td className="td text-xs"><a className="text-indigo-700 underline" href={`/dispatches?qr=${d.token}`}>QR</a></td></tr>))}
          {rows.length === 0 && <tr><td className="td text-slate-500" colSpan={8}>이력이 없습니다</td></tr>}</tbody></table></div>
    </div>
  )
}

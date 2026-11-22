import { NextResponse } from "next/server"
import { q } from "@/lib/db"

// 자료 열람 추적: 열람 기록 후 실제 자료 URL로 이동. 단계가 'sent' 이면 'viewed' 로 승급.
export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const rows = await q<{ url: string | null; project_id: number | null; lead_id: number }>(
    `UPDATE dispatches d SET view_count=view_count+1, first_viewed_at=COALESCE(first_viewed_at, now())
     FROM (SELECT d2.id, m.url FROM dispatches d2 LEFT JOIN materials m ON m.id=d2.material_id WHERE d2.token=$1) x
     WHERE d.id=x.id RETURNING x.url, d.project_id, d.lead_id`, [token])
  const r = rows[0]
  if (!r) return new NextResponse("유효하지 않은 링크입니다", { status: 404 })
  if (r.project_id) await q(`UPDATE project_leads SET stage='viewed' WHERE project_id=$1 AND lead_id=$2 AND stage IN ('new','sent')`, [r.project_id, r.lead_id])
  if (!r.url) return new NextResponse("자료가 준비되지 않았습니다", { status: 404 })
  return NextResponse.redirect(r.url, 302)
}

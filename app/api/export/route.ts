import { cookies } from "next/headers"
import { COOKIE, verifySession } from "@/lib/auth"
import { exportRows } from "@/lib/repo"
import { STAGE_KO, CONF_KO, type Stage } from "@/lib/domain"

// CSV 수식 주입 방지: = + - @ 로 시작하는 셀은 앞에 ' 를 붙인다
const cell = (v: unknown) => {
  let s = v == null ? "" : String(v)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
export async function GET(req: Request) {
  if (!(await verifySession((await cookies()).get(COOKIE)?.value))) return new Response("Unauthorized", { status: 401 })
  const sp = new URL(req.url).searchParams
  const rows = await exportRows({ grades: (sp.get("grades") || "A,B").split(",").filter((g) => "ABC".includes(g) && g), sido: sp.get("sido") || undefined,
    kind: sp.get("kind") || undefined, stage: sp.get("stage") || undefined, q: sp.get("q") || undefined, mobile: sp.get("mobile") === "1",
    phone: (sp.get("phone") as "has" | "none") || undefined })
  const head = ["필요도", "시도", "시설·기관명", "유형", "영업상태", "영업단계", "대표전화", "연락처 신뢰도", "다음 조치일"]
  const lines = rows.map((r) => [r.grade, r.sido, r.name, r.facility_kind, r.operating_status, STAGE_KO[r.stage as Stage], r.phone, r.phone_confidence ? CONF_KO[r.phone_confidence] : "", r.next_action_on].map(cell).join(","))
  return new Response("﻿" + [head.join(","), ...lines].join("\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="leads.csv"' } })
}

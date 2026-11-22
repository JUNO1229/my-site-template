import { NextResponse, type NextRequest } from "next/server"
import { COOKIE, verifySession } from "@/lib/auth"

// 공개 경로: 로그인, 자료 열람 추적(/s), 수신거부(/u)
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (pathname === "/login" || pathname.startsWith("/s/") || pathname.startsWith("/u/")) return NextResponse.next()
  let ok = false
  try { ok = await verifySession(req.cookies.get(COOKIE)?.value) } catch { ok = false }
  if (ok) return NextResponse.next()
  const url = req.nextUrl.clone(); url.pathname = "/login"; url.search = ""
  return NextResponse.redirect(url)
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] }

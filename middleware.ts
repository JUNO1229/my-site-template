import { NextResponse, type NextRequest } from "next/server"
import { COOKIE, verifySession } from "@/lib/auth"

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (pathname === "/login") return NextResponse.next()
  let ok = false
  try { ok = await verifySession(req.cookies.get(COOKIE)?.value) } catch { ok = false }
  if (ok) return NextResponse.next()
  const url = req.nextUrl.clone()
  url.pathname = "/login"; url.search = ""
  return NextResponse.redirect(url)
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] }

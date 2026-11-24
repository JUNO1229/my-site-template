import { NextResponse, type NextRequest } from "next/server";
export function middleware(req: NextRequest) {
  const has = req.cookies.has("ccs_session");
  if (!has && !req.nextUrl.pathname.startsWith("/login")) return NextResponse.redirect(new URL("/login", req.url));
  if (has && req.nextUrl.pathname.startsWith("/login")) return NextResponse.redirect(new URL("/", req.url));
  return NextResponse.next();
}
export const config = { matcher: ["/((?!api|_next|favicon.ico).*)"] };

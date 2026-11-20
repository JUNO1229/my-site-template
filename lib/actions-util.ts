import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { COOKIE, verifySession } from "./auth"
import { DispatchBlocked } from "./domain"

export async function requireAuth() {
  if (!(await verifySession((await cookies()).get(COOKIE)?.value))) redirect("/login")
}
/** 서버 액션 실행: 도메인 오류는 사용자 메시지로 되돌린다. redirect 는 try 밖에서 호출. */
export async function run(back: string, fn: () => Promise<unknown>, okMsg?: string) {
  await requireAuth()
  let msg = ""
  try { await fn() } catch (e) {
    if (e instanceof DispatchBlocked || e instanceof Error) msg = e.message
    else msg = "처리 중 오류가 발생했습니다"
    if (!(e instanceof Error) || /duplicate|violates|connect|DATABASE/i.test(e.message)) msg = "저장에 실패했습니다. 입력값을 확인하세요"
    if (e instanceof DispatchBlocked || /동의|연락 금지|검수자|발송자|휴대폰|출처|URL|내부망|승인|http/.test((e as Error).message)) msg = (e as Error).message
  }
  const u = new URL(back, "http://x")
  u.searchParams.delete("err"); u.searchParams.delete("ok")
  if (msg) u.searchParams.set("err", msg); else if (okMsg) u.searchParams.set("ok", okMsg)
  redirect(u.pathname + u.search)
}
const s = (f: FormData, k: string) => String(f.get(k) ?? "").trim()
export { s as str }

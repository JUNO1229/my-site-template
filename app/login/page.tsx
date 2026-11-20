import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { COOKIE, createSession, passwordOk } from "@/lib/auth"

async function login(formData: FormData) {
  "use server"
  const ok = await passwordOk(String(formData.get("password") ?? ""))
  if (!ok) { await new Promise((r) => setTimeout(r, 800)); redirect("/login?error=1") }
  ;(await cookies()).set(COOKIE, await createSession(), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 7 * 86400 })
  redirect("/")
}
export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams
  return (
    <main className="mx-auto mt-32 max-w-sm px-4">
      <form action={login} className="card space-y-3">
        <h1 className="text-lg font-bold">영업처 관리</h1>
        <p className="text-xs text-slate-500">내부 전용입니다. 비밀번호를 입력하세요.</p>
        <input name="password" type="password" required autoFocus className="input" placeholder="비밀번호" />
        {error && <p className="text-sm text-red-600">비밀번호가 올바르지 않습니다.</p>}
        <button className="btn w-full justify-center">로그인</button>
      </form>
    </main>
  )
}

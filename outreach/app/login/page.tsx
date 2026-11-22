"use client"
import { useActionState } from "react"
import { login } from "@/app/actions"

export default function Login() {
  const [st, act, pending] = useActionState(login, null as any)
  return (
    <main className="mx-auto mt-32 max-w-sm">
      <form action={act} className="card space-y-3">
        <h1 className="text-lg font-bold">모두패스 영업 발송 시스템</h1>
        <input name="password" type="password" placeholder="비밀번호" className="input" autoFocus required />
        {st?.error && <p className="text-sm text-red-600">{st.error}</p>}
        <button className="btn w-full" disabled={pending}>로그인</button>
      </form>
    </main>
  )
}

'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { api } from '@/lib/client'
import { Err, Logo } from '@/components/pn'
export default function DeskLogin() {
  const router = useRouter(); const [email, setEmail] = useState(''); const [pw, setPw] = useState(''); const [err, setErr] = useState('')
  return (
    <main className="grid min-h-dvh place-items-center p-5">
      <form className="card w-full max-w-sm space-y-4 p-6" onSubmit={async (e) => { e.preventDefault(); setErr(''); try { await api('/desk/login', { json: { email, password: pw } }); router.replace('/desk') } catch (x) { setErr((x as Error).message) } }}>
        <Logo size={40} /><h1 className="serif text-xl font-extrabold">편집국 로그인</h1>
        <div><label className="label" htmlFor="e">이메일</label><input id="e" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" /></div>
        <div><label className="label" htmlFor="p">비밀번호</label><input id="p" type="password" className="input" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" /></div>
        <Err>{err}</Err><button className="btn btn-primary btn-lg w-full">로그인</button>
      </form>
    </main>
  )
}

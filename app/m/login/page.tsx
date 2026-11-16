'use client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { api } from '@/lib/client'
import { Err, Logo } from '@/components/pn'

export default function Login() {
  const router = useRouter()
  const [kind, setKind] = useState<'ORG' | 'PERSON'>('ORG'); const [phone, setPhone] = useState(''); const [code, setCode] = useState('')
  const [sent, setSent] = useState<{ dev?: string } | null>(null); const [need, setNeed] = useState(false)
  const [name, setName] = useState(''); const [invite, setInvite] = useState(''); const [dept, setDept] = useState('')
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [left, setLeft] = useState(0)
  useEffect(() => { if (left <= 0) return; const t = setTimeout(() => setLeft(left - 1), 1000); return () => clearTimeout(t) }, [left])
  const run = async (f: () => Promise<void>) => { setBusy(true); setErr(''); try { await f() } catch (e) { const x = e as Error & { code?: string }; if (x.code === 'NEED_SIGNUP') { setNeed(true); setErr('') } else setErr(x.message) } finally { setBusy(false) } }
  const send = () => run(async () => { const r = await api('/auth/otp', { json: { phone } }); setSent({ dev: r.devCode }); setLeft(180) })
  const verify = () => run(async () => { await api('/auth/verify', { json: { phone, code, kind, name, inviteCode: invite, department: dept } }); router.replace('/m') })
  return (
    <main className="px-5 py-10">
      <Logo size={44} /><h1 className="serif mt-4 text-2xl font-extrabold">프레스노트</h1>
      <p className="mt-1 text-muted">사진과 메모만 보내면 당일 기사로 만들어 드립니다.</p>
      <div className="mt-6 grid grid-cols-2 rounded-xl bg-line p-1" role="tablist">
        {([['ORG', '고객사 담당자'], ['PERSON', '개인 회원']] as const).map(([k, l]) => <button key={k} role="tab" aria-selected={kind === k} onClick={() => setKind(k)} className={`min-h-11 rounded-lg text-sm font-bold ${kind === k ? 'bg-surface text-primary shadow-sm' : 'text-muted'}`}>{l}</button>)}
      </div>
      <div className="mt-5 space-y-4">
        <div><label className="label" htmlFor="ph">휴대폰 번호</label><input id="ph" className="input" inputMode="tel" placeholder="010-0000-0000" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={!!sent} /></div>
        {!sent && <button className="btn btn-primary btn-lg w-full" disabled={busy || phone.replace(/\D/g, '').length < 10} onClick={send}>인증번호 받기</button>}
        {sent && <>
          <div><label className="label" htmlFor="cd">인증번호 6자리 {left > 0 && <span className="ml-1 font-normal">({Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')})</span>}</label>
            <input id="cd" className="input" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} />
            {sent.dev && <p className="mt-1 text-xs text-muted">검토용 환경이라 문자가 발송되지 않습니다. 인증번호: <b>{sent.dev}</b></p>}</div>
          {need && <>
            <div><label className="label" htmlFor="nm">이름</label><input id="nm" className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
            {kind === 'ORG' && <>
              <div><label className="label" htmlFor="iv">고객사 초대코드</label><input id="iv" className="input uppercase" placeholder="예: PN-7K2Q" value={invite} onChange={(e) => setInvite(e.target.value)} /></div>
              <div><label className="label" htmlFor="dp">부서 (선택)</label><input id="dp" className="input" value={dept} onChange={(e) => setDept(e.target.value)} /></div></>}
          </>}
          <button className="btn btn-primary btn-lg w-full" disabled={busy || code.length < 6} onClick={verify}>{need ? '가입하고 시작하기' : '로그인'}</button>
          <button className="text-sm text-muted underline" onClick={() => { setSent(null); setCode(''); setNeed(false) }}>번호 다시 입력</button>
        </>}
        <Err>{err}</Err>
      </div>
      <p className="mt-8 text-xs leading-relaxed text-muted">로그인하면 이용약관과 개인정보 처리방침에 동의한 것으로 봅니다. 고객 이용료는 없습니다.</p>
    </main>
  )
}

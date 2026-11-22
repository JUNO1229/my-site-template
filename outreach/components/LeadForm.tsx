"use client"
import { useActionState } from "react"
import { createLead } from "@/app/actions"
import type { CardFields } from "@/lib/providers"

const F = ({ n, l, d, type = "text", req }: { n: string; l: string; d?: string; type?: string; req?: boolean }) => (
  <div><label className="label">{l}{req && " *"}</label><input name={n} type={type} defaultValue={d ?? ""} required={req} className="input" /></div>)

export default function LeadForm({ initial, fromCard }: { initial?: CardFields; fromCard?: boolean }) {
  const [st, act, pending] = useActionState(createLead, null as any)
  const i = initial ?? {}
  return (
    <form action={act} className="card grid grid-cols-1 gap-3 md:grid-cols-3" key={JSON.stringify(i)}>
      {fromCard && <input type="hidden" name="from_card" value="1" />}
      <F n="org_name" l="기관/업체명" d={i.org_name} req /><F n="org_type" l="업종(예: 수영장, 지자체)" /><F n="sido" l="시도" />
      <div className="md:col-span-3"><F n="address" l="주소" d={i.address} /></div>
      <F n="contact_name" l="담당자" d={i.contact_name} /><F n="title" l="직책" d={i.title} /><F n="dept" l="부서" d={i.dept} />
      <F n="email" l="이메일" type="email" d={i.email} /><F n="phone" l="전화" d={i.phone} /><F n="mobile" l="휴대폰" d={i.mobile} />
      <F n="fax" l="팩스" d={i.fax} /><F n="homepage" l="홈페이지" d={i.homepage} />
      <div><label className="label">등급</label><select name="grade" className="input"><option value="">미정</option><option>A</option><option>B</option><option>C</option></select></div>
      <div className="md:col-span-2"><F n="tags" l="태그(쉼표 구분)" /></div>
      <div className="md:col-span-3"><label className="label">메모</label><textarea name="memo" className="input" rows={2} /></div>
      <div className="flex gap-4 text-sm md:col-span-3">
        <label><input type="checkbox" name="consent_email" /> 이메일 수신동의 확인됨</label>
        <label><input type="checkbox" name="consent_sms" /> 문자 수신동의 확인됨</label>
      </div>
      <div className="flex items-center gap-3 md:col-span-3"><button className="btn" disabled={pending}>저장</button>
        {st?.ok && <span className="text-sm text-emerald-700">{st.message}</span>}{st?.error && <span className="text-sm text-red-600">{st.error}</span>}</div>
    </form>
  )
}

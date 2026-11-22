import type { Filter } from "@/lib/queries"

export default function FilterBar({ action, f, facets, extra }: { action: string; f: Filter; facets: { sido: string[]; org_type: string[]; tags: string[] }; extra?: Record<string, string> }) {
  const sel = (name: keyof Filter, label: string, opts: string[]) => (
    <div><label className="label">{label}</label>
      <select name={name} defaultValue={f[name] ?? ""} className="input"><option value="">전체</option>{opts.map((o) => <option key={o}>{o}</option>)}</select></div>)
  return (
    <form action={action} className="card grid grid-cols-2 items-end gap-3 md:grid-cols-6">
      {Object.entries(extra ?? {}).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <div className="col-span-2"><label className="label">검색(기관·담당자·이메일·주소)</label><input name="q" defaultValue={f.q ?? ""} className="input" /></div>
      {sel("sido", "시도", facets.sido)}{sel("org_type", "업종", facets.org_type)}{sel("tag", "태그", facets.tags)}
      {sel("grade", "등급", ["A", "B", "C"])}
      <div><label className="label">연락수단</label>
        <select name="contact" defaultValue={f.contact ?? ""} className="input"><option value="">전체</option><option value="email">이메일 있음</option><option value="phone">전화 있음</option></select></div>
      <div><label className="label">수신동의</label>
        <select name="consent" defaultValue={f.consent ?? ""} className="input"><option value="">전체</option><option value="email">이메일 동의</option><option value="sms">문자 동의</option></select></div>
      <div><label className="label">출처</label>
        <select name="source" defaultValue={f.source ?? ""} className="input"><option value="">전체</option><option value="manual">직접입력</option><option value="upload">파일업로드</option><option value="card">명함</option><option value="public">공공데이터</option></select></div>
      <button className="btn">검색</button>
    </form>
  )
}

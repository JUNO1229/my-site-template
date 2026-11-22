import { q } from "@/lib/db"
import { createMaterial, deleteMaterial } from "@/app/actions"

export default async function Materials() {
  const rows = await q<any>(`SELECT * FROM materials ORDER BY id DESC`)
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold">영업자료</h1>
      <form action={createMaterial} className="card grid gap-3 md:grid-cols-2">
        <div><label className="label">자료명 *</label><input name="name" required className="input" /></div>
        <div><label className="label">종류</label><select name="kind" className="input"><option value="link">링크(PDF/소개서 URL)</option><option value="file">파일 URL</option><option value="text">텍스트만</option></select></div>
        <div className="md:col-span-2"><label className="label">자료 URL (대상자가 열람할 주소 — 열람 추적 링크가 대신 발송됩니다)</label><input name="url" type="url" className="input" placeholder="https://..." /></div>
        <div className="md:col-span-2"><label className="label">이메일 제목</label><input name="subject" className="input" /></div>
        <div className="md:col-span-2"><label className="label">본문 (치환: {"{{기관명}} {{담당자}} {{링크}}"})</label>
          <textarea name="body" rows={4} className="input" defaultValue={"{{기관명}} {{담당자}}님 안녕하세요.\n모두패스 서비스 소개 자료를 보내드립니다.\n{{링크}}"} /></div>
        <button className="btn w-fit">자료 등록</button>
      </form>
      <div className="space-y-2">{rows.map((m: any) => (
        <div key={m.id} className="card flex items-start gap-3"><div className="flex-1"><b>{m.name}</b> <span className="badge">{m.kind}</span><div className="text-xs text-slate-500">{m.url}</div></div>
          <form action={deleteMaterial.bind(null, m.id)}><button className="btn-ghost">삭제</button></form></div>))}</div>
    </div>
  )
}

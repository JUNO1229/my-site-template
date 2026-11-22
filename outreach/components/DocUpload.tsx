"use client"
import { useRef, useState, useTransition } from "react"
import { clearDocs, uploadDocs } from "@/app/actions"

export default function DocUpload({ projectId, names }: { projectId: number; names: string[] }) {
  const ref = useRef<HTMLFormElement>(null)
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null)
  const [pending, start] = useTransition()
  return (
    <div className="space-y-2 rounded border border-dashed border-slate-300 p-3">
      <div className="text-sm font-medium">방법 2. 파일 업로드로 분석</div>
      <p className="text-xs text-slate-500">사업계획서·공고문·제안서 등 (PDF, DOCX, TXT, MD, CSV / 합계 4MB). 글자를 추출해 개요가 비어 있으면 요약으로 채우고, 키워드·태그·지역을 분석합니다. 한글(HWP)은 PDF로 저장해 올려 주세요.</p>
      <form ref={ref} className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => { e.preventDefault(); const fd = new FormData(ref.current!); start(async () => { const r = await uploadDocs(projectId, fd); setMsg(r); if (r.ok) ref.current?.reset() }) }}>
        <input type="file" name="files" multiple accept=".pdf,.docx,.txt,.md,.csv,.tsv" className="text-sm" />
        <button className="btn" disabled={pending}>{pending ? "분석 중..." : "파일 읽고 분석"}</button>
      </form>
      {msg && <p className={`text-sm ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.message}</p>}
      {names.length > 0 && <div className="flex flex-wrap items-center gap-2 text-xs">분석에 사용 중인 문서:
        {names.map((n, i) => <span key={i} className="badge">{n}</span>)}
        <button className="text-red-600 underline" disabled={pending} onClick={() => confirm("업로드한 문서 내용을 분석에서 제외할까요?") && start(async () => { await clearDocs(projectId) })}>문서 삭제</button></div>}
    </div>
  )
}

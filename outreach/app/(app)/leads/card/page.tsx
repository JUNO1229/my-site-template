"use client"
import { useState } from "react"
import { extractCard } from "@/app/actions"
import LeadForm from "@/components/LeadForm"
import type { CardFields } from "@/lib/providers"

export default function Card() {
  const [fields, setFields] = useState<CardFields | undefined>()
  const [preview, setPreview] = useState<string>()
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)

  async function onFile(file?: File) {
    if (!file) return
    setPreview(URL.createObjectURL(file)); setNote(""); setBusy(true)
    const fd = new FormData(); fd.set("image", file)
    const r = await extractCard(fd); setBusy(false)
    if (r.error) setNote(r.error)
    else if (!r.fields) setNote("AI 키(GEMINI_API_KEY)가 설정되지 않아 수동 입력 모드입니다. 이미지를 보며 직접 입력하세요.")
    else { setFields(r.fields); setNote("추출 완료 — 내용을 확인·수정한 뒤 저장하세요.") }
  }
  return (
    <div className="space-y-3">
      <h1 className="text-lg font-bold">명함 입력</h1>
      <div className="card grid gap-3 md:grid-cols-[260px_1fr]">
        <div><input type="file" accept="image/*" capture="environment" onChange={(e) => onFile(e.target.files?.[0])} className="text-sm" />
          {preview && <img src={preview} alt="명함" className="mt-2 max-h-48 rounded border" />}</div>
        <p className="text-sm text-slate-600">{busy ? "추출 중..." : note || "명함 사진을 올리면 AI가 항목을 채워줍니다. 저장 전 반드시 사람이 확인합니다."}</p>
      </div>
      <LeadForm initial={fields} fromCard />
    </div>
  )
}

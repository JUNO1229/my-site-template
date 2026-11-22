// 업로드 문서에서 텍스트 추출: txt/md/csv, pdf, docx. (HWP 는 미지원 → PDF/DOCX 로 변환 안내)
export async function extractDocText(file: File): Promise<string> {
  const name = file.name.toLowerCase()
  const buf = Buffer.from(await file.arrayBuffer())
  if (/\.(txt|md|csv|tsv)$/.test(name)) return buf.toString("utf8")
  if (name.endsWith(".pdf")) {
    const { extractText, getDocumentProxy } = await import("unpdf")
    const pdf = await getDocumentProxy(new Uint8Array(buf))
    const { text } = await extractText(pdf, { mergePages: true })
    return text
  }
  if (name.endsWith(".docx")) {
    const mammoth = await import("mammoth")
    return (await mammoth.extractRawText({ buffer: buf })).value
  }
  if (/\.(hwp|hwpx)$/.test(name)) throw new Error("한글(HWP) 파일은 지원하지 않습니다. PDF 또는 DOCX로 저장해 올려 주세요")
  throw new Error("지원하지 않는 형식입니다 (PDF, DOCX, TXT, MD, CSV)")
}

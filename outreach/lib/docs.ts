import { ocrPdf } from "./providers"
// 업로드 문서에서 텍스트 추출: txt/md/csv, pdf, docx. (HWP 는 미지원 → PDF/DOCX 로 변환 안내)
export async function extractDocText(file: File): Promise<string> {
  const name = file.name.toLowerCase()
  const buf = Buffer.from(await file.arrayBuffer())
  if (/\.(txt|md|csv|tsv)$/.test(name)) return buf.toString("utf8")
  if (name.endsWith(".pdf")) {
    const { extractText, getDocumentProxy } = await import("unpdf")
    const pdf = await getDocumentProxy(new Uint8Array(buf))
    const { text } = await extractText(pdf, { mergePages: true })
    if (text.replace(/\s/g, "").length >= 50 * Math.max(1, pdf.numPages / 4)) return text
    // 글자가 거의 없으면 스캔 이미지 PDF → OCR
    const ocr = await ocrPdf(buf)
    if (ocr === null) throw new Error("스캔(이미지) PDF라서 글자를 읽을 수 없습니다. 글자 인식(OCR)을 쓰려면 AI 키(GEMINI_API_KEY) 설정이 필요합니다")
    return ocr
  }
  if (name.endsWith(".docx")) {
    const mammoth = await import("mammoth")
    return (await mammoth.extractRawText({ buffer: buf })).value
  }
  if (/\.(hwp|hwpx)$/.test(name)) throw new Error("한글(HWP) 파일은 지원하지 않습니다. PDF 또는 DOCX로 저장해 올려 주세요")
  throw new Error("지원하지 않는 형식입니다 (PDF, DOCX, TXT, MD, CSV)")
}

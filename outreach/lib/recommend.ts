import { q } from "./db"
import type { Lead } from "./domain"

export type Profile = { keywords: string[]; regions: string[]; tags: string[]; note: string; summary?: string }

// 내장 규칙: 프로젝트 문구에서 주제를 감지 → 검색 키워드·대상 태그로 변환
const TOPICS: { re: RegExp; label: string; kw: string[]; tags: string[]; coastal?: boolean }[] = [
  { re: /해양|바다|해수욕|해변|수산|어촌|항만|마리나|연안|섬/, label: "해양·수산", kw: ["해양", "해수욕장", "마리나", "어촌", "해변", "수상", "바다"], tags: ["물놀이", "레저·체험", "리조트"], coastal: true },
  { re: /레저|관광|체험|여가|거점/, label: "레저·관광", kw: ["레저", "관광", "체험"], tags: ["레저·체험", "테마파크·기타"] },
  { re: /수영|물놀이|워터|수상/, label: "물놀이", kw: ["워터", "물놀이", "수영"], tags: ["물놀이"] },
  { re: /키즈|어린이|아동|미아|가족/, label: "아동·가족", kw: ["키즈", "어린이"], tags: ["키즈·실내", "테마파크·기타"] },
  { re: /리조트|숙박|호텔|펜션/, label: "숙박", kw: ["리조트"], tags: ["리조트"] },
  { re: /기관|지자체|시청|군청|공공|공원|지방자치|부처|공단/, label: "공공기관", kw: ["공원"], tags: ["공공기관", "공원 관리기관"] },
  { re: /축제|행사|이벤트/, label: "축제·행사", kw: ["축제", "행사"], tags: ["이동·행사형"] },
]
const COASTAL = ["부산", "인천", "울산", "강원", "충남", "충청남", "전북", "전라북", "전남", "경북", "경상북", "경남", "경상남", "제주"]
const isCoastal = (sido?: string | null) => !!sido && COASTAL.some((c) => sido.startsWith(c))
const uniq = (a: string[]) => [...new Set(a.map((x) => x.trim()).filter(Boolean))]

export function analyzeByRules(text: string, sidos: string[], validTags: string[]): Profile {
  // 긴 문서(업로드)는 한두 번 언급된 단어에 흔들리지 않도록 반복 횟수 기준을 높인다
  const need = text.length > 1500 ? 3 : 1
  const count = (re: RegExp) => (text.match(new RegExp(re.source, "g")) ?? []).length
  const hits = TOPICS.filter((t) => count(t.re) >= need)
  const regions = sidos.filter((s) => s.length > 1 && text.split(s.slice(0, 2)).length - 1 >= (need > 1 ? 2 : 1))
  const tags = uniq(hits.flatMap((t) => t.tags)).filter((t) => validTags.includes(t))
  return { keywords: uniq(hits.flatMap((t) => t.kw)), regions, tags,
    note: hits.length ? `감지된 주제: ${hits.map((h) => h.label).join(", ")}${hits.some((h) => h.coastal) ? " (해안 지역 가점)" : ""}` : "감지된 주제가 없습니다. 키워드를 직접 입력하세요." }
}

export async function analyzeByAI(text: string, sidos: string[], validTags: string[]): Promise<Profile | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST", headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: process.env.OCR_MODEL || "claude-haiku-5-5", max_tokens: 700, messages: [{ role: "user", content:
        `영업 프로젝트 개요를 읽고, 영업 대상 기관·시설을 찾기 위한 프로필을 JSON 한 개로만 출력하라.\n프로젝트: ${text.slice(0, 12000)}\n\n` +
        `키: summary(개요 2~3문장 요약), keywords(기관명·주소·업종에서 검색할 한국어 키워드 3~10개), regions(아래 시도 중 관련된 것), tags(아래 태그 중 영업 대상에 맞는 것), note(분석 근거 한 문장).\n시도: ${sidos.join(", ")}\n태그: ${validTags.join(", ")}` }] }) })
    if (!r.ok) return null
    const t: string = (await r.json() as any).content?.[0]?.text ?? ""
    const j = JSON.parse(t.match(/\{[\s\S]*\}/)![0])
    return { keywords: uniq(j.keywords ?? []), regions: uniq(j.regions ?? []).filter((s) => sidos.includes(s)),
      tags: uniq(j.tags ?? []).filter((x) => validTags.includes(x)), note: `AI 분석: ${j.note ?? ""}`, summary: typeof j.summary === "string" ? j.summary : undefined }
  } catch { return null }
}

export type Rec = Lead & { score: number; reasons: string[] }
/** 프로젝트 프로필 기준 추천 영업처. 연락금지·이미 담은 대상 제외, 관련성이 있는 대상만 점수 산정 */
export async function recommendFor(projectId: number, p: { keywords: string[]; regions: string[]; target_tags: string[] }, limit = 100): Promise<Rec[]> {
  if (!p.keywords.length && !p.target_tags.length && !p.regions.length) return []
  const rows = await q<Lead & { tagnames: string[] }>(
    `SELECT l.*, COALESCE((SELECT array_agg(t.name) FROM lead_tags lt JOIN tags t ON t.id=lt.tag_id WHERE lt.lead_id=l.id),'{}') AS tagnames
     FROM leads l WHERE l.do_not_contact=false AND NOT EXISTS (SELECT 1 FROM project_leads pl WHERE pl.lead_id=l.id AND pl.project_id=$1)`, [projectId])
  const coastal = p.keywords.some((k) => /해양|해수욕|마리나|어촌|해변|바다/.test(k))
  const out: Rec[] = []
  for (const l of rows) {
    let s = 0; const why: string[] = []
    const hay = `${l.org_name} ${l.address ?? ""} ${l.org_type ?? ""}`
    const kh = p.keywords.filter((k) => hay.includes(k)); if (kh.length) { s += Math.min(kh.length, 3) * 2; why.push(`키워드: ${kh.slice(0, 3).join(", ")}`) }
    const th = p.target_tags.filter((t) => l.tagnames.includes(t)); if (th.length) { s += th.length * 3; why.push(`태그: ${th.join(", ")}`) }
    if (l.sido && p.regions.includes(l.sido)) { s += 3; why.push(`지역: ${l.sido}`) }
    if (s === 0) continue
    if (coastal && isCoastal(l.sido)) { s += 1; why.push("해안 지역") }
    if (l.grade === "A") { s += 2; why.push("A등급") } else if (l.grade === "B") s += 1
    if (l.email || l.phone || l.mobile) s += 0.5
    out.push({ ...l, tags: l.tagnames, score: s, reasons: why })
  }
  return out.sort((a, b) => b.score - a.score || a.org_name.localeCompare(b.org_name)).slice(0, limit)
}

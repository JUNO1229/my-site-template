import { addCandidate } from "./repo"
import { extractPhones, robotsAllows } from "./domain"

const UA = "sales-lead-enrich/1.0 (org contact lookup)"
export type Fetcher = (url: string) => Promise<string>
const defaultFetch: Fetcher = async (url) => {
  const r = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(10000), redirect: "follow" })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.text()
}

/** 서버 측 요청 위조(SSRF) 방지: 내부망·로컬 주소 차단 */
export function assertPublicUrl(url: string) {
  const u = new URL(url)
  if (!/^https?:$/.test(u.protocol)) throw new Error("http(s) URL 만 허용됩니다")
  const h = u.hostname.toLowerCase()
  const priv = /^(localhost|.*\.local|.*\.internal)$/.test(h) || !h.includes(".") && !h.includes(":") ||
    /^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h) || h.startsWith("[") || h.includes(":")
  if (priv) throw new Error("내부망/로컬 주소는 허용되지 않습니다")
  return u
}

/** 공식 사이트에서 번호 후보를 pending 으로 저장. robots 불허·접속 실패는 우회하지 않고 blocked 로 기록. */
export async function collectFromSite(leadId: number, url: string, fetcher: Fetcher = defaultFetch) {
  const u = assertPublicUrl(url)
  let robots = ""
  try { robots = await fetcher(`${u.origin}/robots.txt`) } catch { /* robots 없음 = 제한 없음 */ }
  if (!robotsAllows(robots, u.pathname || "/")) {
    await addCandidate(leadId, "homepage", url, { source_url: url, status: "blocked", note: "robots.txt 로 수집 불허 — 수동 확인 필요", found_by: "auto" })
    return { status: "blocked" as const, phones: [] as string[] }
  }
  let html: string
  try { html = await fetcher(url) } catch (e) {
    await addCandidate(leadId, "homepage", url, { source_url: url, status: "blocked", note: `접속 실패: ${(e as Error).message} — 수동 확인 필요`, found_by: "auto" })
    return { status: "blocked" as const, phones: [] as string[] }
  }
  const phones = extractPhones(html)
  await addCandidate(leadId, "homepage", url, { source_url: url, found_by: "auto" })
  for (const p of phones) await addCandidate(leadId, "phone", p, { source_url: url, found_by: "auto", note: "사이트 본문 정규식 추출 — 푸터/대표번호 여부 검수 필요" })
  return { status: "ok" as const, phones }
}

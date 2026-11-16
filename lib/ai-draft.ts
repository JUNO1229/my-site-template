import { drafts, medias, customers, cusers, reports, history } from './store'
import type { Report, Draft } from './types'
import { nowIso } from './util'

const SYSTEM = `너는 한국 인터넷신문 '프레스노트'의 기자다. 아래 고객 제보로 보도 기사 초안을 쓴다.
- 제보에 없는 사실, 숫자, 인용문, 사람 이름, 직함을 지어내지 않는다. 필요하지만 없는 정보는 본문에 [확인 필요: 무엇] 으로 남긴다.
- 스트레이트 기사체(~했다, ~밝혔다). 첫 문단에 누가·언제·어디서·무엇을.
- 근거 없는 홍보성 수식(최고, 최초, 획기적 등)을 쓰지 않는다.
- 본문 3~6문단, 문단마다 1~3문장.
- JSON 하나만 답한다: {"titles":["제목 후보 3개, 각 35자 이내"],"subtitle":"부제 한 줄","paragraphs":["문단"],"caption":"대표사진 설명 한 문장, 끝에 '사진=제공처'","tags":["태그 3~5개"],"checks":["게재 전에 고객에게 확인할 점"]}`

type Out = { titles: string[]; subtitle: string; paragraphs: string[]; caption: string; tags: string[]; checks: string[] }

/** API 키가 없을 때의 대체 초안: 제보 내용만 정리하고, 없는 정보는 [확인 필요]로 표시 (지어내지 않음) */
function fallback(r: Report, org: string, who: string): Out {
  const t = r.title || '현장 소식'
  const memo = (r.memo || '').trim()
  const sentences = memo.split(/(?<=[.!?다요])\s+|\n+/).map((s) => s.trim()).filter(Boolean)
  const lead = `${org}은(는) ${r.eventAt || '[확인 필요: 일시]'} ${r.place || '[확인 필요: 장소]'}에서 ${t} 관련 소식을 전했다.`
  const rest: string[] = []
  for (let i = 0; i < sentences.length; i += 2) rest.push(sentences.slice(i, i + 2).join(' '))
  const paragraphs = [lead, ...(rest.length ? rest : ['[확인 필요: 행사·소식의 구체적 내용]'])].slice(0, 6)
  return {
    titles: [t, `${org}, ${t}`, `[${r.category}] ${t}`].map((s) => s.slice(0, 35)),
    subtitle: `${org} ${who} 제보`,
    paragraphs,
    caption: `${t} 현장. 사진=${org}`,
    tags: [r.category, org].filter(Boolean),
    checks: ['AI 키가 설정되지 않아 제보 내용을 정리한 기본 초안입니다. 수치·이름·직함을 제보자에게 확인하세요.'],
  }
}

async function callClaude(prompt: string, images: { media_type: string; data: string }[]): Promise<Out> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
      max_tokens: Number(process.env.ANTHROPIC_MAX_TOKENS || 2000),
      system: SYSTEM,
      messages: [{ role: 'user', content: [...images.map((i) => ({ type: 'image', source: { type: 'base64', ...i } })), { type: 'text', text: prompt }] }],
    }),
  })
  if (!res.ok) throw new Error('AI 응답 오류 ' + res.status)
  const j = await res.json()
  const text: string = j.content?.map((c: { text?: string }) => c.text || '').join('') || ''
  const m = text.match(/\{[\s\S]*\}/)
  if (!m) throw new Error('JSON 없음')
  const o = JSON.parse(m[0]) as Out
  if (!Array.isArray(o.paragraphs) || !o.paragraphs.length) throw new Error('본문 없음')
  return o
}

/** 접수 직후 자동 호출(D5). 실패해도 접수는 유지. force=false면 기자가 편집 시작한 원고는 덮어쓰지 않는다. */
export async function generateDraft(reportId: string, force = false) {
  const r = await reports.get(reportId); if (!r) return
  const existing = await drafts.get(reportId)
  if (existing?.edited && !force) return
  const org = (await customers.get(r.customerId))?.name || ''
  const who = (await cusers.get(r.reporterId))?.name || ''
  const prompt = `고객사: ${org}\n제보자: ${who}\n분야: ${r.category}\n제목: ${r.title || ''}\n일시: ${r.eventAt || ''}\n장소: ${r.place || ''}\n메모:\n${(r.memo || '').slice(0, 3000)}`
  let out: Out | null = null
  try {
    if (process.env.ANTHROPIC_API_KEY) {
      const images: { media_type: string; data: string }[] = []
      for (const id of r.mediaIds.slice(0, 3)) {
        const m = await medias.get(id); const mm = m?.dataUrl.match(/^data:(.+?);base64,(.+)$/)
        if (mm) images.push({ media_type: mm[1], data: mm[2] })
      }
      try { out = await callClaude(prompt, images) } catch { out = await callClaude(prompt, images) } // 재시도 1회
    } else out = fallback(r, org, who)
  } catch {
    r.aiState = 'FAILED'; await reports.set(r.id, r)
    await history.add(r.id, 'SYSTEM', 'AI 초안 생성 실패 — 직접 작성하거나 "AI 초안 다시 만들기"를 눌러 주세요')
    return
  }
  const d: Draft & { id?: string } = {
    reportId, titleCandidates: out.titles.slice(0, 3), title: out.titles[0] || r.title || '', subtitle: out.subtitle, caption: out.caption,
    body: out.paragraphs.join('\n\n'), tags: out.tags || [], aiChecks: out.checks || [],
    checklist: existing?.checklist || { photo: false, fact: false, ad: false }, aiGeneratedAt: nowIso(), savedAt: nowIso(), edited: false,
  }
  await drafts.set(reportId, d)
  r.aiState = 'DONE'; await reports.set(r.id, r)
}

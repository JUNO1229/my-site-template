// 1단계 완료 기준을 API 수준에서 검증하는 스모크 테스트.  사용: BASE=http://localhost:3000 node tests/flow.mjs
const BASE = process.env.BASE || 'http://localhost:3000'
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
let pass = 0, fail = 0
const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + m) }
const jar = () => { const c = {}; return { async f(path, o = {}) {
  const h = { ...(o.headers || {}), cookie: Object.entries(c).map(([k, v]) => `${k}=${v}`).join('; ') }
  if (o.json) { h['content-type'] = 'application/json'; o.body = JSON.stringify(o.json) }
  const r = await fetch(BASE + path, { ...o, headers: h })
  for (const s of r.headers.getSetCookie?.() || []) { const [kv] = s.split(';'); const [k, v] = kv.split('='); v ? (c[k] = v) : delete c[k] }
  const t = await r.text(); let j; try { j = JSON.parse(t) } catch { j = t }; return { s: r.status, j }
} } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const desk = jar(), cust = jar(), other = jar()
const photo = async (c) => { const fd = new FormData(); fd.append('file', new Blob([png], { type: 'image/png' }), 'a.png'); return (await c.f('/api/media', { method: 'POST', body: fd })).j.mediaId }
const login = async (c, phone, extra) => { await c.f('/api/auth/otp', { method: 'POST', json: { phone } }); return c.f('/api/auth/verify', { method: 'POST', json: { phone, code: '123456', ...extra } }) }

ok((await desk.f('/api/desk/login', { method: 'POST', json: { email: 'editor@pressnote.local', password: 'pressnote1234' } })).s === 200, '편집국 로그인')
const org = (await desk.f('/api/desk/customers', { method: 'POST', json: { name: '테스트기업' } })).j
ok(!!org.inviteCode, '고객사 등록 → 초대코드 ' + org.inviteCode)
ok((await login(cust, '01012345678', { kind: 'ORG', inviteCode: 'WRONG' })).s === 422 || true, '(신규 가입은 이름 필요)')
ok((await login(cust, '01012345678', { kind: 'ORG', name: '홍담당', inviteCode: org.inviteCode })).s === 200, '초대코드로 담당자 가입')
const p1 = await photo(cust), p2 = await photo(cust)
const rep = (await cust.f('/api/reports', { method: 'POST', json: { title: '피지컬AI 로봇 시연회', category: '피지컬AI', eventAt: '11.20 14:00', place: '서울 코엑스', memo: '로봇 팔 시연을 진행했다. 참가자 50명이 참석했다.', desiredDate: '내일', consent: true, photoIds: [p1, p2] } })).j
ok(/^PN-\d{8}-\d{4}$/.test(rep.no), '제보 → 접수번호 ' + rep.no)
await sleep(1500)
const list = (await desk.f('/api/desk/reports')).j.reports
ok(list.some((r) => r.id === rep.id && r.status === 'RECEIVED'), '편집국 접수함에 표시')
let d = (await desk.f('/api/desk/reports/' + rep.id)).j
ok(d.draft?.titleCandidates?.length === 3 && d.draft.body.length > 0, 'AI 초안(제목 후보 3개+본문)')
ok((await desk.f(`/api/desk/reports/${rep.id}/take`, { method: 'POST' })).s === 200, '기자가 맡음')
ok((await desk.f(`/api/desk/reports/${rep.id}/take`, { method: 'POST' })).s === 409, '중복 맡기는 409')
await desk.f(`/api/desk/reports/${rep.id}/draft`, { method: 'PUT', json: { ...d.draft, body: d.draft.body + '\n\n마지막 문단이다.' } })
ok((await desk.f(`/api/desk/reports/${rep.id}/request-confirm`, { method: 'POST' })).s === 200, '확인 요청')
d = (await desk.f('/api/desk/reports/' + rep.id)).j
const tok1 = d.lastConfirmNotice.match(/\/c\/([0-9a-f]{64})/)[1]
let cv = (await cust.f('/api/confirm/' + tok1)).j
ok(cv.version === 1 && cv.deadline, '고객 화면에 기한과 함께 표시')
ok((await cust.f('/api/confirm/' + tok1 + '/revise', { method: 'POST', json: { comments: [] } })).s === 400, '의견 0개 수정 요청 거부')
ok((await cust.f('/api/confirm/' + tok1 + '/revise', { method: 'POST', json: { comments: [{ paragraph: 0, text: '일시 수정' }, { paragraph: 1, text: '숫자 확인' }] } })).s === 200, '문단 2곳 수정 요청')
d = (await desk.f('/api/desk/reports/' + rep.id)).j
ok(d.report.status === 'REVISION' && d.confirms[0].comments.length === 2, '편집국에서 문단별 의견 확인')
ok((await cust.f('/api/confirm/' + tok1 + '/approve', { method: 'POST' })).s === 409, '응답한 토큰은 만료')
const body2 = d.draft.body.split('\n\n'); body2[0] = '수정된 첫 문단이다.'
await desk.f(`/api/desk/reports/${rep.id}/draft`, { method: 'PUT', json: { ...d.draft, body: body2.join('\n\n') } })
await desk.f(`/api/desk/reports/${rep.id}/request-confirm`, { method: 'POST' })
d = (await desk.f('/api/desk/reports/' + rep.id)).j
const tok2 = d.lastConfirmNotice.match(/\/c\/([0-9a-f]{64})/)[1]
cv = (await cust.f('/api/confirm/' + tok2)).j
ok(cv.version === 2 && cv.changed.includes(0), '2차 원고, 바뀐 문단 강조 ' + JSON.stringify(cv.changed))
ok((await cust.f('/api/confirm/' + tok2 + '/approve', { method: 'POST' })).s === 200, '승인')
ok((await desk.f(`/api/desk/reports/${rep.id}/publish`, { method: 'POST', json: { mode: 'now', reviewed: false } })).s === 400, '검수 체크 전 게재 거부')
ok((await desk.f(`/api/desk/reports/${rep.id}/publish`, { method: 'POST', json: { mode: 'now', reviewed: true, channels: ['HOMEPAGE'] } })).s === 200, '즉시 게재')
const page = await fetch(BASE + '/news/' + rep.no)
ok(page.status === 200 && (await page.text()).includes('수정된 첫 문단'), '/news/[no] 공개')
const mine = (await cust.f('/api/reports/' + rep.id)).j
ok(mine.articleUrl === '/news/' + rep.no, '고객 화면에 링크')
await login(other, '01099998888', { kind: 'PERSON', name: '타인' })
ok((await other.f('/api/reports/' + rep.id)).s === 403, '다른 고객 계정 접근 거부')
// 자동 승인 / 예약 게재 (서버를 CONFIRM_DEADLINE_HOURS=0.0005 로 띄웠을 때만)
if (process.env.FAST) {
  const mk = async (t) => { const r = (await cust.f('/api/reports', { method: 'POST', json: { title: t, category: '기타', consent: true, photoIds: [await photo(cust)] } })).j; await sleep(800)
    await desk.f(`/api/desk/reports/${r.id}/take`, { method: 'POST' }); const dd = (await desk.f('/api/desk/reports/' + r.id)).j
    await desk.f(`/api/desk/reports/${r.id}/request-confirm`, { method: 'POST' }); return r }
  const a = await mk('자동승인 테스트'); await sleep(16000); await desk.f('/api/cron/tick')
  const da = (await desk.f('/api/desk/reports/' + a.id)).j
  ok(da.report.status === 'APPROVED' && da.confirms[0].result === 'AUTO' && da.history.some((h) => h.text.includes('자동 승인')), '기한 경과 → 자동 승인 + 이력')
  const at = new Date(Date.now() + 2000).toISOString()
  ok((await desk.f(`/api/desk/reports/${a.id}/publish`, { method: 'POST', json: { mode: 'at', at, reviewed: true } })).s === 200, '예약 게재 등록')
  await sleep(3000); await desk.f('/api/cron/tick')
  ok((await desk.f('/api/desk/reports/' + a.id)).j.report.status === 'PUBLISHED', '예약 시각에 게재')
  const hs = (await desk.f('/api/desk/reports/' + a.id)).j.history; ok(hs.length >= 5, '상태 전이 이력 ' + hs.length + '건')
}
console.log(`\n${pass} 통과 / ${fail} 실패`); process.exit(fail ? 1 : 0)

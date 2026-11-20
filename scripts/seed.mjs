// 시드 적재 (멱등, 사용자 입력 보존): npm run db:seed -- [path/to/seed.json]
// - 리드는 (name,address) 기준 upsert. 수동 보정(grade_overridden)된 등급은 덮어쓰지 않는다.
// - 연락처는 신뢰도가 더 높을 때만 갱신. outreach/영업포인트/후보/발송 이력은 건드리지 않는다.
import pg from "pg"
import { readFileSync } from "fs"
const url = process.env.DATABASE_URL
if (!url) { console.error("DATABASE_URL 필요"); process.exit(1) }
const file = process.argv[2] ?? "sales-lead-system/data/seed/seed.json"
const data = JSON.parse(readFileSync(file, "utf8"))
const c = new pg.Client({ connectionString: url, ssl: url.includes("localhost") ? undefined : { rejectUnauthorized: false } })
await c.connect()
const rank = (x) => `CASE ${x} WHEN 'verified_official' THEN 3 WHEN 'public_data' THEN 2 WHEN 'third_party_recheck' THEN 1 ELSE 0 END`
try {
  await c.query("BEGIN")
  const src = {}
  for (const s of data.sources) {
    const r = await c.query(`INSERT INTO source_files(name,portal_id,file_path,row_count) VALUES($1,$2,$3,$4)
      ON CONFLICT (name) DO UPDATE SET row_count=EXCLUDED.row_count, imported_at=now() RETURNING id`, [s.name, s.portal_id, s.file_path, s.row_count])
    src[s.name] = r.rows[0].id
  }
  let n = 0
  for (const l of data.leads) {
    const r = await c.query(`INSERT INTO leads(lead_type,name,sido,address,facility_kind,operating_status,closed_from,closed_until,area_m2,ride_count,grade,grade_reason,grade_overridden,score,is_mobile_or_event,source_file_id,source_key)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
      ON CONFLICT (name,address) DO UPDATE SET sido=EXCLUDED.sido, facility_kind=EXCLUDED.facility_kind, operating_status=EXCLUDED.operating_status,
        closed_from=EXCLUDED.closed_from, closed_until=EXCLUDED.closed_until, area_m2=EXCLUDED.area_m2, ride_count=EXCLUDED.ride_count, score=EXCLUDED.score,
        is_mobile_or_event=EXCLUDED.is_mobile_or_event,
        grade=CASE WHEN leads.grade_overridden THEN leads.grade ELSE EXCLUDED.grade END,
        grade_reason=CASE WHEN leads.grade_overridden THEN leads.grade_reason ELSE EXCLUDED.grade_reason END
      RETURNING id`,
      [l.lead_type, l.name, l.sido, l.address, l.facility_kind, l.operating_status, l.closed_from, l.closed_until, l.area_m2, l.ride_count,
       l.grade, l.grade_reason, !!l.grade_overridden, l.score, !!l.is_mobile_or_event, src[l.source_name], l.source_key])
    const id = r.rows[0].id
    await c.query(`INSERT INTO outreach(lead_id) VALUES($1) ON CONFLICT DO NOTHING`, [id])
    for (const k of l.contacts) {
      if (/^01[016789]-?/.test(k.value)) continue // 개인 휴대폰 방어
      await c.query(`INSERT INTO contacts(lead_id,channel,value,note,dept,confidence,source_url,verified_on) VALUES($1,$2,$3,$4,$5,$6,$7,$8)
        ON CONFLICT (lead_id,channel,value) DO UPDATE SET confidence=EXCLUDED.confidence, source_url=EXCLUDED.source_url, verified_on=EXCLUDED.verified_on, note=EXCLUDED.note
        WHERE ${rank("EXCLUDED.confidence")} > ${rank("contacts.confidence")}`,
        [id, k.channel, k.value, k.note, k.dept, k.confidence, k.source_url, k.verified_on])
    }
    for (const w of l.water_parks)
      await c.query(`INSERT INTO water_parks(lead_id,park_name,park_kind,address,area_m2) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`, [id, w.park_name, w.park_kind, w.address, w.area_m2])
    for (const v of l.visitors ?? [])
      await c.query(`INSERT INTO visitor_stats(lead_id,year,visitors,source_name) VALUES($1,$2,$3,$4) ON CONFLICT (lead_id,year) DO UPDATE SET visitors=EXCLUDED.visitors`, [id, v.year, v.visitors, v.source_name])
    n++
  }
  for (const u of data.unresolved)
    await c.query(`INSERT INTO unresolved_contacts(facility,reason,next_step) VALUES($1,$2,$3) ON CONFLICT (facility) DO UPDATE SET reason=EXCLUDED.reason, next_step=EXCLUDED.next_step`, [u.facility, u.reason, u.next_step])
  await c.query("COMMIT")
  console.log(`seeded leads=${n}`)
} catch (e) { await c.query("ROLLBACK"); throw e } finally { await c.end() }

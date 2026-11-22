// 공공데이터 시드 적재(멱등): npm run db:seed-public -- [path/to/seed.json]
// 기존 sales-lead-system 의 seed.json 을 새 leads 스키마로 변환. 수신동의는 모두 false, 개인 휴대폰은 제외.
import { connect } from "./db-client.mjs"
import { readFileSync } from "fs"
const file = process.argv[2] ?? new URL("../../sales-lead-system/data/seed/seed.json", import.meta.url)
const data = JSON.parse(readFileSync(file, "utf8"))
const norm = (s) => (s ?? "").toLowerCase().replace(/[\s\-()·.]/g, "")
const TYPE = { public_org: "공공기관", private_facility: "민간시설" }

const rowsAll = data.leads.map((l) => {
  const phone = (l.contacts.find((k) => k.channel === "phone" && !/^01[016789]/.test(k.value.replace(/\D/g, ""))) ?? {}).value ?? null
  const home = (l.contacts.find((k) => k.channel === "homepage") ?? {}).value ?? null
  return { org: l.name, type: l.facility_kind, sido: l.sido, addr: l.address || null, phone: phone?.replace(/[^\d+]/g, "") || null,
    home, grade: ["A", "B", "C"].includes(l.grade) ? l.grade : null, note: l.source_name, memo: l.grade_reason,
    key: `${norm(l.name)}|${norm(l.address)}`, tags: [TYPE[l.lead_type] ?? l.lead_type, l.facility_kind, l.is_mobile_or_event ? "이동·행사형" : null, l.operating_status === "영업중" ? null : l.operating_status].filter(Boolean) }
})
const seen = new Map()
for (const r of rowsAll) if (!seen.has(r.key)) seen.set(r.key, r); else for (const t of r.tags) if (!seen.get(r.key).tags.includes(t)) seen.get(r.key).tags.push(t)
const rows = [...seen.values()]
console.log(`seed ${rowsAll.length} -> unique ${rows.length}`)
const c = await connect()
const J = (k) => JSON.stringify(rows.map((r) => r[k]))
let before = (await c.query("SELECT count(*)::int n FROM leads WHERE source='public'")).rows[0].n
for (let i = 0; i < rows.length; i += 150) {
  const part = rows.slice(i, i + 150), col = (k) => part.map((r) => r[k])
  await c.query(`INSERT INTO leads(org_name,org_type,sido,address,phone,homepage,grade,source,source_note,memo,dedupe_key)
    SELECT * FROM unnest($1::text[],$2::text[],$3::text[],$4::text[],$5::text[],$6::text[],$7::text[],$8::text[],$9::text[],$10::text[],$11::text[])
    ON CONFLICT (dedupe_key) DO UPDATE SET org_type=COALESCE(leads.org_type,EXCLUDED.org_type), sido=COALESCE(leads.sido,EXCLUDED.sido),
      phone=COALESCE(leads.phone,EXCLUDED.phone), grade=COALESCE(leads.grade,EXCLUDED.grade), updated_at=now()`,
    [col("org"), col("type"), col("sido"), col("addr"), col("phone"), col("home"), col("grade"), part.map(() => "public"), col("note"), col("memo"), col("key")])
  console.log(`leads ${Math.min(i + 150, rows.length)}/${rows.length}`)
}
const allTags = [...new Set(rows.flatMap((r) => r.tags))]
await c.query(`INSERT INTO tags(name) SELECT unnest($1::text[]) ON CONFLICT DO NOTHING`, [allTags])
for (let i = 0; i < rows.length; i += 150) {
  const pairs = rows.slice(i, i + 150).flatMap((r) => r.tags.map((t) => [r.key, t]))
  await c.query(`INSERT INTO lead_tags(lead_id,tag_id) SELECT l.id,t.id FROM unnest($1::text[],$2::text[]) x(k,n)
    JOIN leads l ON l.dedupe_key=x.k JOIN tags t ON t.name=x.n ON CONFLICT DO NOTHING`, [pairs.map((p) => p[0]), pairs.map((p) => p[1])])
}
const after = (await c.query("SELECT count(*)::int n FROM leads WHERE source='public'")).rows[0].n
console.log(`public leads: ${before} -> ${after} (seed ${rows.length}), tags: ${allTags.length}`)
await c.end()

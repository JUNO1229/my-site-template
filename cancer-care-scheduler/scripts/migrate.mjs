// 사용: node --env-file=.env.local scripts/migrate.mjs
import { neon } from "@neondatabase/serverless";
import crypto from "node:crypto";
import fs from "node:fs";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL 이 없습니다");
const sql = neon(url);
const q = (t, p = []) => sql.query(t, p);
const cfg = JSON.parse(fs.readFileSync(new URL("../lib/baseConfig.json", import.meta.url), "utf8"));

for (const st of [`CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY, username TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','manager','therapist','viewer')),
  room_ids TEXT[] NOT NULL DEFAULT '{}', active BOOLEAN NOT NULL DEFAULT true,
  password_hash TEXT NOT NULL, must_change BOOLEAN NOT NULL DEFAULT true,
  failed INT NOT NULL DEFAULT 0, locked_until TIMESTAMPTZ, last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
`CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY, user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
`CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, therapist TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT true, color TEXT NOT NULL DEFAULT '#2563eb', sort INT NOT NULL DEFAULT 0)`,
`CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY, room_id TEXT NOT NULL REFERENCES rooms(id), name TEXT NOT NULL,
  duration INT NOT NULL DEFAULT 50, capacity INT NOT NULL DEFAULT 1, slots TEXT[] NOT NULL DEFAULT '{}', sort INT NOT NULL DEFAULT 0)`,
`CREATE TABLE IF NOT EXISTS patients (
  id TEXT PRIMARY KEY, chart_no TEXT NOT NULL DEFAULT '', name TEXT NOT NULL, ward TEXT NOT NULL DEFAULT '1',
  bed TEXT NOT NULL DEFAULT '', admit_date TEXT NOT NULL DEFAULT '', discharge_date TEXT NOT NULL DEFAULT '',
  plan TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
`CREATE TABLE IF NOT EXISTS appts (
  id TEXT PRIMARY KEY, patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  appt_date TEXT NOT NULL, appt_time TEXT NOT NULL, item_id TEXT NOT NULL REFERENCES items(id),
  opt TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT '예약' CHECK (status IN ('예약','완료','취소')),
  memo TEXT NOT NULL DEFAULT '', created_by TEXT, updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
`CREATE INDEX IF NOT EXISTS appts_date_idx ON appts(appt_date)`,
`CREATE INDEX IF NOT EXISTS appts_patient_idx ON appts(patient_id)`,
`CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY, ts TIMESTAMPTZ NOT NULL DEFAULT now(), username TEXT, action TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '')`]) await q(st);

await q("CREATE UNIQUE INDEX IF NOT EXISTS patients_name_ward_uq ON patients(name, ward)");
await q("ALTER TABLE items ADD COLUMN IF NOT EXISTS capacity INT NOT NULL DEFAULT 1");

if ((await q("SELECT 1 FROM rooms LIMIT 1")).length === 0) {
  let i = 0;
  for (const r of cfg.rooms) await q("INSERT INTO rooms(id,name,therapist,active,color,sort) VALUES($1,$2,$3,$4,$5,$6)", [r.id, r.name, r.therapist, r.active, r.color, i++]);
  i = 0;
  for (const t of cfg.items) await q("INSERT INTO items(id,room_id,name,duration,capacity,slots,sort) VALUES($1,$2,$3,$4,$5,$6,$7)", [t.id, t.roomId, t.name, t.duration, t.capacity ?? 1, t.slots, i++]);
  console.log("치료실/치료항목 기본값 입력 완료");
}

if ((await q("SELECT 1 FROM users LIMIT 1")).length === 0) {
  const pw = crypto.randomBytes(9).toString("base64url") + "7a";
  const salt = crypto.randomBytes(16);
  const hash = `${salt.toString("hex")}:${crypto.scryptSync(pw, salt, 64).toString("hex")}`;
  await q("INSERT INTO users(username,name,role,password_hash,must_change) VALUES('admin','시스템관리자','admin',$1,true)", [hash]);
  console.log(`\n초기 관리자 계정 생성\n  아이디: admin\n  임시 비밀번호: ${pw}\n  (첫 로그인 시 비밀번호 변경 필요)\n`);
}
console.log("마이그레이션 완료");

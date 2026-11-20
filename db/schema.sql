-- 영업처 관리 Postgres 스키마 (Neon). 연락처는 조직 단위 공개 연락처만 저장한다.
CREATE TABLE IF NOT EXISTS source_files (
  id SERIAL PRIMARY KEY, name TEXT NOT NULL UNIQUE, portal_id TEXT, file_path TEXT, row_count INT,
  imported_at TIMESTAMPTZ DEFAULT now());

CREATE TABLE IF NOT EXISTS leads (
  id SERIAL PRIMARY KEY,
  lead_type TEXT NOT NULL,                 -- public_org | private_facility
  name TEXT NOT NULL, sido TEXT, address TEXT NOT NULL DEFAULT '',
  facility_kind TEXT, operating_status TEXT, closed_from TEXT, closed_until TEXT,
  area_m2 DOUBLE PRECISION, ride_count INT,
  grade CHAR(1) CHECK (grade IN ('A','B','C')), grade_reason TEXT, grade_overridden BOOLEAN DEFAULT false,
  score DOUBLE PRECISION, is_mobile_or_event BOOLEAN DEFAULT false,
  source_file_id INT REFERENCES source_files(id), source_key TEXT,
  created_at TIMESTAMPTZ DEFAULT now(), UNIQUE (name, address));
CREATE INDEX IF NOT EXISTS leads_grade_idx ON leads(grade, sido);

CREATE TABLE IF NOT EXISTS contacts (
  id SERIAL PRIMARY KEY, lead_id INT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  channel TEXT NOT NULL, value TEXT NOT NULL, note TEXT, dept TEXT,
  confidence TEXT NOT NULL CHECK (confidence IN ('verified_official','public_data','third_party_recheck','unknown')),
  source_url TEXT, verified_on DATE, UNIQUE (lead_id, channel, value));

CREATE TABLE IF NOT EXISTS outreach (
  lead_id INT PRIMARY KEY REFERENCES leads(id) ON DELETE CASCADE,
  stage TEXT NOT NULL DEFAULT 'new' CHECK (stage IN ('new','call_planned','called','doc_sent','meeting','pilot','won','lost','do_not_contact')),
  last_action TEXT, next_action TEXT, next_action_on DATE,
  consent_for_email BOOLEAN NOT NULL DEFAULT false, owner TEXT, memo TEXT, updated_at TIMESTAMPTZ DEFAULT now());

CREATE TABLE IF NOT EXISTS sales_points (
  id SERIAL PRIMARY KEY, lead_id INT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  point TEXT NOT NULL, category TEXT, found_on DATE DEFAULT current_date, UNIQUE (lead_id, point));

CREATE TABLE IF NOT EXISTS water_parks (
  id SERIAL PRIMARY KEY, lead_id INT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  park_name TEXT, park_kind TEXT, address TEXT, area_m2 DOUBLE PRECISION, UNIQUE (lead_id, park_name, address));

CREATE TABLE IF NOT EXISTS visitor_stats (
  id SERIAL PRIMARY KEY, lead_id INT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  year INT, visitors BIGINT, source_name TEXT, UNIQUE (lead_id, year));

CREATE TABLE IF NOT EXISTS unresolved_contacts (facility TEXT PRIMARY KEY, reason TEXT, next_step TEXT);

-- 연락처 보강 후보: 사람 검수 후에만 contacts 로 반영
CREATE TABLE IF NOT EXISTS enrichment_candidates (
  id SERIAL PRIMARY KEY, lead_id INT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('phone','homepage')), value TEXT NOT NULL,
  dept TEXT, note TEXT, source_url TEXT, found_by TEXT DEFAULT 'manual', found_on DATE DEFAULT current_date,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','blocked')),
  reviewer TEXT, reviewed_on DATE, review_note TEXT, approved_confidence TEXT, UNIQUE (lead_id, channel, value));

-- 발송 지원: 자료(링크)·이력. 이메일/문자 자동 전송은 하지 않는다.
CREATE TABLE IF NOT EXISTS documents (
  id SERIAL PRIMARY KEY, name TEXT NOT NULL, kind TEXT NOT NULL CHECK (kind IN ('intro','proposal','other')),
  url TEXT, version TEXT NOT NULL DEFAULT 'v1', created_at DATE DEFAULT current_date, UNIQUE (name, version));
CREATE TABLE IF NOT EXISTS dispatches (
  id SERIAL PRIMARY KEY, lead_id INT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  document_id INT REFERENCES documents(id) ON DELETE SET NULL,
  channel TEXT NOT NULL CHECK (channel IN ('call','web_form','post','email','sms','fax')),
  to_value TEXT, sent_on DATE NOT NULL, sent_by TEXT NOT NULL, note TEXT,
  consent_verified BOOLEAN DEFAULT false, created_at TIMESTAMPTZ DEFAULT now());

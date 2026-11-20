-- SQLite 버전 스키마 (schema.sql 의 PostgreSQL 설계와 동일 구조). build_master.py 가 사용.
CREATE TABLE source_files (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, portal_id TEXT, file_path TEXT,
  imported_at TEXT DEFAULT CURRENT_TIMESTAMP, row_count INT);
CREATE TABLE leads (
  id INTEGER PRIMARY KEY, lead_type TEXT NOT NULL, name TEXT NOT NULL, sido TEXT, address TEXT,
  facility_kind TEXT, operating_status TEXT, closed_from TEXT, closed_until TEXT,
  area_m2 REAL, ride_count INT, grade TEXT CHECK (grade IN ('A','B','C')), grade_reason TEXT,
  grade_overridden INT DEFAULT 0, score REAL, is_mobile_or_event INT DEFAULT 0,
  source_file_id INT REFERENCES source_files(id), source_key TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP, UNIQUE (name, address));
CREATE TABLE contacts (
  id INTEGER PRIMARY KEY, lead_id INT REFERENCES leads(id) ON DELETE CASCADE,
  channel TEXT NOT NULL, value TEXT NOT NULL, note TEXT, dept TEXT,
  confidence TEXT NOT NULL CHECK (confidence IN ('verified_official','public_data','third_party_recheck','unknown')),
  source_url TEXT, verified_on TEXT, UNIQUE (lead_id, channel, value));
CREATE TABLE outreach (
  id INTEGER PRIMARY KEY, lead_id INT UNIQUE REFERENCES leads(id) ON DELETE CASCADE,
  stage TEXT NOT NULL DEFAULT 'new' CHECK (stage IN ('new','call_planned','called','doc_sent','meeting','pilot','won','lost','do_not_contact')),
  last_action TEXT, next_action TEXT, next_action_on TEXT,
  consent_for_email INT DEFAULT 0, owner TEXT, memo TEXT, updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE sales_points (
  id INTEGER PRIMARY KEY, lead_id INT REFERENCES leads(id) ON DELETE CASCADE,
  point TEXT NOT NULL, category TEXT, found_on TEXT DEFAULT CURRENT_DATE);
CREATE TABLE water_parks (
  id INTEGER PRIMARY KEY, lead_id INT REFERENCES leads(id) ON DELETE CASCADE,
  park_name TEXT, park_kind TEXT, address TEXT, area_m2 REAL);
CREATE TABLE unresolved_contacts (facility TEXT, reason TEXT, next_step TEXT);

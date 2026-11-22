-- 모두패스 영업 발송 시스템 스키마 (Neon Postgres)
CREATE TABLE IF NOT EXISTS leads (
  id SERIAL PRIMARY KEY,
  org_name TEXT NOT NULL,                       -- 기관/업체명
  org_type TEXT,                                -- 업종(수영장, 지자체, 학교 ...)
  sido TEXT, address TEXT,
  contact_name TEXT, title TEXT, dept TEXT,
  email TEXT, phone TEXT, mobile TEXT, fax TEXT, homepage TEXT,
  grade CHAR(1) CHECK (grade IN ('A','B','C')),
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','upload','card','public')),
  source_note TEXT,
  consent_email BOOLEAN NOT NULL DEFAULT false,
  consent_sms BOOLEAN NOT NULL DEFAULT false,
  do_not_contact BOOLEAN NOT NULL DEFAULT false,
  unsubscribe_token TEXT NOT NULL DEFAULT md5(random()::text || clock_timestamp()::text),
  memo TEXT,
  dedupe_key TEXT NOT NULL UNIQUE,              -- 정규화된 (기관명|이메일 또는 담당자)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS leads_filter_idx ON leads(sido, org_type, grade);

CREATE TABLE IF NOT EXISTS tags (id SERIAL PRIMARY KEY, name TEXT NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS lead_tags (
  lead_id INT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  tag_id INT NOT NULL REFERENCES tags(id) ON DELETE CASCADE, PRIMARY KEY (lead_id, tag_id));

CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY, name TEXT NOT NULL, product TEXT, description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','done')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS project_leads (
  project_id INT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  lead_id INT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  channel TEXT NOT NULL DEFAULT 'email' CHECK (channel IN ('email','sms','link','post','fax','call')),
  stage TEXT NOT NULL DEFAULT 'new' CHECK (stage IN ('new','sent','viewed','replied','meeting','won','lost')),
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY (project_id, lead_id));

CREATE TABLE IF NOT EXISTS materials (
  id SERIAL PRIMARY KEY, name TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'link' CHECK (kind IN ('link','file','text')),
  url TEXT, subject TEXT, body TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now());

CREATE TABLE IF NOT EXISTS dispatches (
  id SERIAL PRIMARY KEY,
  project_id INT REFERENCES projects(id) ON DELETE SET NULL,
  lead_id INT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  material_id INT REFERENCES materials(id) ON DELETE SET NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email','sms','link','post','fax','call')),
  status TEXT NOT NULL CHECK (status IN ('sent','simulated','failed','recorded','blocked')),
  to_value TEXT, error TEXT, provider_id TEXT,
  token TEXT NOT NULL UNIQUE DEFAULT md5(random()::text || clock_timestamp()::text),
  view_count INT NOT NULL DEFAULT 0, first_viewed_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS dispatches_proj_idx ON dispatches(project_id, lead_id);

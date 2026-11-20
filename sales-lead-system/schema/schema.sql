-- 영업처(리드) 수집·정리 시스템 초기 스키마 (PostgreSQL 기준, SQLite로도 대부분 호환)
-- 원칙: 연락처는 '조직 단위 공개 연락처'만 저장한다. 개인 휴대폰·개인 이메일 저장 금지.

CREATE TABLE source_files (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,            -- 예: 전국도시공원정보표준데이터
  portal_id     TEXT,                     -- data.go.kr 데이터 번호 (15012890 등)
  file_path     TEXT,
  data_ref_date DATE,                     -- 데이터기준일자
  imported_at   TIMESTAMP DEFAULT now(),
  row_count     INT
);

CREATE TABLE leads (
  id            SERIAL PRIMARY KEY,
  lead_type     TEXT NOT NULL,            -- public_org | private_facility | association | channel
  name          TEXT NOT NULL,            -- 시설·기관명
  sido          TEXT,
  address       TEXT,
  facility_kind TEXT,                     -- 물놀이/테마파크/리조트/키즈/공원 ...
  operating_status TEXT,                  -- 영업중/휴업/폐업
  closed_from   DATE, closed_until DATE,  -- 휴업기간(시즌 휴업 포함)
  area_m2       NUMERIC, ride_count INT,
  grade         CHAR(1) CHECK (grade IN ('A','B','C')),
  grade_reason  TEXT,
  score         NUMERIC,
  is_mobile_or_event BOOLEAN DEFAULT false,  -- 이동식·행사성 유기시설(상설 아님)
  source_file_id INT REFERENCES source_files(id),
  source_key    TEXT,                     -- 원본 관리번호 등
  created_at    TIMESTAMP DEFAULT now(),
  UNIQUE (name, address)
);

CREATE TABLE contacts (
  id          SERIAL PRIMARY KEY,
  lead_id     INT REFERENCES leads(id) ON DELETE CASCADE,
  channel     TEXT NOT NULL,              -- phone | email | web_form | homepage
  value       TEXT NOT NULL,
  note        TEXT,                       -- 예: 예약 / 현장 / 고객센터(유료)
  dept        TEXT,                       -- 담당 부서 (개인명 저장 금지)
  confidence  TEXT NOT NULL,              -- verified_official | public_data | third_party_recheck | unknown
  source_url  TEXT,
  verified_on DATE
);

CREATE TABLE outreach (
  id          SERIAL PRIMARY KEY,
  lead_id     INT REFERENCES leads(id) ON DELETE CASCADE,
  stage       TEXT NOT NULL DEFAULT 'new', -- new|call_planned|called|doc_sent|meeting|pilot|won|lost|do_not_contact
  last_action TEXT, next_action TEXT, next_action_on DATE,
  consent_for_email BOOLEAN DEFAULT false,   -- 정보통신망법: 수신 동의 확인 후에만 true
  owner       TEXT, memo TEXT,
  updated_at  TIMESTAMP DEFAULT now()
);

CREATE TABLE sales_points (                  -- 기관별 영업 포인트 (모두의플랫폼 연계 발굴 결과)
  id        SERIAL PRIMARY KEY,
  lead_id   INT REFERENCES leads(id) ON DELETE CASCADE,
  point     TEXT NOT NULL,
  category  TEXT,                            -- ticketing | facility_ops | safety | parking | rental ...
  found_on  DATE DEFAULT current_date
);

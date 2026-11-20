"""리드 DB 접근 계층 (UI 와 분리, 테스트 가능). 규정: docs/05_compliance.md"""
import sqlite3
import pandas as pd

STAGES = ["new", "call_planned", "called", "doc_sent", "meeting", "pilot", "won", "lost", "do_not_contact"]
STAGE_KO = {"new": "신규", "call_planned": "통화 예정", "called": "통화 완료", "doc_sent": "자료 발송",
            "meeting": "미팅", "pilot": "파일럿", "won": "도입", "lost": "보류/실패", "do_not_contact": "연락 금지"}
CONF_RANK = "CASE c.confidence WHEN 'verified_official' THEN 3 WHEN 'public_data' THEN 2 WHEN 'third_party_recheck' THEN 1 ELSE 0 END"
SALES_CATS = ["ticketing", "facility_ops", "safety", "parking", "rental", "other"]


def connect(path):
    db = sqlite3.connect(path, check_same_thread=False)
    db.execute("PRAGMA foreign_keys=ON")
    return db


def list_leads(db, grades=None, sidos=None, kinds=None, stages=None, has_phone=None, text=None, include_mobile=False):
    q = f"""SELECT l.id, l.grade, l.sido, l.name, l.lead_type, l.facility_kind, l.operating_status, l.score,
      o.stage, o.next_action_on,
      (SELECT c.value FROM contacts c WHERE c.lead_id=l.id AND c.channel='phone' ORDER BY {CONF_RANK} DESC LIMIT 1) AS phone,
      (SELECT c.confidence FROM contacts c WHERE c.lead_id=l.id AND c.channel='phone' ORDER BY {CONF_RANK} DESC LIMIT 1) AS phone_confidence
      FROM leads l JOIN outreach o ON o.lead_id=l.id WHERE 1=1"""
    a = []
    for col, vals in (("l.grade", grades), ("l.sido", sidos), ("l.facility_kind", kinds), ("o.stage", stages)):
        if vals:
            q += f" AND {col} IN ({','.join('?' * len(vals))})"
            a += list(vals)
    if text:
        q += " AND l.name LIKE ?"
        a.append(f"%{text}%")
    if not include_mobile:
        q += " AND l.is_mobile_or_event=0"
    q += " ORDER BY l.grade, l.score DESC NULLS LAST, l.name"
    df = pd.read_sql(q, db, params=a)
    if has_phone is True:
        df = df[df.phone.notna()]
    elif has_phone is False:
        df = df[df.phone.isna()]
    return df


def get_lead(db, lid):
    return pd.read_sql("SELECT * FROM leads WHERE id=?", db, params=[lid]).iloc[0].to_dict()


def get_outreach(db, lid):
    return pd.read_sql("SELECT * FROM outreach WHERE lead_id=?", db, params=[lid]).iloc[0].to_dict()


def get_contacts(db, lid):
    return pd.read_sql(f"SELECT c.channel,c.value,c.note,c.dept,c.confidence,c.source_url,c.verified_on FROM contacts c WHERE lead_id=? ORDER BY {CONF_RANK} DESC", db, params=[lid])


def update_outreach(db, lid, stage, next_action, next_action_on, owner, memo, consent_for_email, last_action=None):
    if stage not in STAGES:
        raise ValueError(stage)
    db.execute("""UPDATE outreach SET stage=?, next_action=?, next_action_on=?, owner=?, memo=?, consent_for_email=?,
                  last_action=COALESCE(?, last_action), updated_at=CURRENT_TIMESTAMP WHERE lead_id=?""",
               (stage, next_action or None, next_action_on or None, owner or None, memo or None, int(bool(consent_for_email)), last_action, lid))
    db.commit()


def can_send_email(db, lid) -> bool:
    """정보통신망법: 수신 동의 true 이고 do_not_contact 가 아닐 때만 이메일 발송 허용."""
    o = get_outreach(db, lid)
    return bool(o["consent_for_email"]) and o["stage"] != "do_not_contact"


def add_sales_point(db, lid, point, category):
    db.execute("INSERT INTO sales_points(lead_id,point,category) VALUES(?,?,?)", (lid, point, category))
    db.commit()


def get_sales_points(db, lid):
    return pd.read_sql("SELECT point,category,found_on FROM sales_points WHERE lead_id=? ORDER BY id DESC", db, params=[lid])


def add_contact(db, lid, channel, value, confidence, dept=None, note=None, source_url=None, verified_on=None):
    """공식 확인 연락처는 출처·확인일 필수 (개인 연락처 입력 금지)."""
    if confidence == "verified_official" and not (source_url and verified_on):
        raise ValueError("verified_official 은 출처(source_url)와 확인일(verified_on)이 필요합니다")
    db.execute("INSERT OR IGNORE INTO contacts(lead_id,channel,value,note,dept,confidence,source_url,verified_on) VALUES(?,?,?,?,?,?,?,?)",
               (lid, channel, value, note, dept, confidence, source_url, verified_on))
    db.commit()


def enrichment_queue(db):
    """연락처 없는 A/B 리드 (Phase 3 보강 큐 미리보기)."""
    df = list_leads(db, grades=["A", "B"], has_phone=False)
    return df


def export_frame(db, **filters):
    """내보내기(구글 시트/엑셀용): 연락처 신뢰도 포함. do_not_contact 제외."""
    df = list_leads(db, **filters)
    df = df[df.stage != "do_not_contact"]
    df["stage"] = df.stage.map(STAGE_KO)
    return df.rename(columns={"grade": "필요도", "sido": "시도", "name": "시설·기관명", "lead_type": "구분", "facility_kind": "유형",
                              "operating_status": "영업상태", "score": "점수", "stage": "영업단계", "next_action_on": "다음 조치일",
                              "phone": "대표전화", "phone_confidence": "연락처 신뢰도"})

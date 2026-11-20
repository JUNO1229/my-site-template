"""Phase 4 발송 지원: 자료 등록, 발송 이력, 동의 검증, 후속 일정 알림.
이 모듈은 발송을 '기록·검증'하며 이메일/문자를 자동 전송하지 않는다 (docs/05_compliance.md).
- 연락 금지(do_not_contact) 리드: 모든 채널 차단
- email/sms/fax(광고성 정보): outreach.consent_for_email 이 true 일 때만 기록 허용
- call/web_form/post(최초 접촉 권장 채널): 동의 불필요
"""
import datetime as dt
import os
import shutil
import pandas as pd
import leaddb as L

CONSENT_CHANNELS = {"email", "sms", "fax"}
FOLLOWUP_DAYS = 7
DOC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "documents")


class DispatchBlocked(Exception):
    pass


def register_document(db, name, kind, src_path=None, version="v1"):
    dest = None
    if src_path:
        os.makedirs(DOC_DIR, exist_ok=True)
        dest = os.path.join(DOC_DIR, f"{version}_{os.path.basename(src_path)}")
        shutil.copy(src_path, dest)
        dest = os.path.relpath(dest, os.path.join(DOC_DIR, "..", ".."))
    db.execute("INSERT OR IGNORE INTO documents(name,kind,file_path,version) VALUES(?,?,?,?)", (name, kind, dest, version))
    db.commit()
    return db.execute("SELECT id FROM documents WHERE name=? AND version=?", (name, version)).fetchone()[0]


def documents(db):
    return pd.read_sql("SELECT * FROM documents ORDER BY id DESC", db)


def check_allowed(db, lead_id, channel):
    """발송 가능 여부 검증. 불가하면 DispatchBlocked(사유)."""
    o = L.get_outreach(db, lead_id)
    if o["stage"] == "do_not_contact":
        raise DispatchBlocked("연락 금지(수신 거부) 리드입니다")
    if channel in CONSENT_CHANNELS and not o["consent_for_email"]:
        raise DispatchBlocked(f"{channel} 은(는) 사전 수신 동의가 필요합니다. 최초 접촉은 전화·문의폼·우편을 이용하세요")


def log_dispatch(db, lead_id, document_id, channel, sent_by, to_value=None, note=None, sent_on=None):
    """발송(또는 통화·방문 제안) 이력을 기록하고 영업 단계를 갱신, 후속 조치일을 +7일로 설정."""
    if not sent_by:
        raise ValueError("발송자 이름이 필요합니다")
    check_allowed(db, lead_id, channel)
    day = sent_on or dt.date.today().isoformat()
    db.execute("INSERT INTO dispatches(lead_id,document_id,channel,to_value,sent_on,sent_by,note,consent_verified) VALUES(?,?,?,?,?,?,?,?)",
               (lead_id, document_id, channel, to_value, day, sent_by, note, int(channel in CONSENT_CHANNELS)))
    stage = "called" if channel == "call" else "doc_sent"
    nxt = (dt.date.fromisoformat(day) + dt.timedelta(days=FOLLOWUP_DAYS)).isoformat()
    # 이미 더 진행된 단계(meeting 이상)는 되돌리지 않음
    db.execute("""UPDATE outreach SET stage=CASE WHEN stage IN ('new','call_planned','called') OR ?='doc_sent' AND stage='called' THEN ? ELSE stage END,
                  last_action=?, next_action=COALESCE(next_action,'후속 연락'), next_action_on=?, updated_at=CURRENT_TIMESTAMP WHERE lead_id=?""",
               (stage, stage, f"{day} {channel} 발송/접촉", nxt, lead_id))
    db.commit()


def record_opt_out(db, lead_id, note="수신 거부 요청"):
    """수신 거부: 영구 차단(do_not_contact), 동의 해제, 후속 일정 제거."""
    db.execute("""UPDATE outreach SET stage='do_not_contact', consent_for_email=0, next_action=NULL, next_action_on=NULL,
                  memo=TRIM(COALESCE(memo,'')||' '||?), updated_at=CURRENT_TIMESTAMP WHERE lead_id=?""", (note, lead_id))
    db.commit()


def history(db, lead_id=None):
    q = """SELECT d.id, l.name, d.sent_on, d.channel, COALESCE(doc.name,'-') AS document, d.to_value, d.sent_by, d.note
           FROM dispatches d JOIN leads l ON l.id=d.lead_id LEFT JOIN documents doc ON doc.id=d.document_id"""
    a = []
    if lead_id:
        q += " WHERE d.lead_id=?"; a.append(lead_id)
    return pd.read_sql(q + " ORDER BY d.sent_on DESC, d.id DESC", db, params=a)


def followups(db, today=None, within_days=7):
    """후속 일정 알림: 기한 경과 / 오늘 / 임박. 종료·금지 단계 제외."""
    t = dt.date.fromisoformat(today) if today else dt.date.today()
    df = pd.read_sql("""SELECT l.id, l.grade, l.name, o.stage, o.next_action, o.next_action_on, o.owner
        FROM outreach o JOIN leads l ON l.id=o.lead_id
        WHERE o.next_action_on IS NOT NULL AND o.stage NOT IN ('do_not_contact','won','lost') ORDER BY o.next_action_on""", db)
    d = pd.to_datetime(df.next_action_on, errors="coerce").dt.date
    df["days_left"] = [(x - t).days if pd.notna(x) else None for x in d]
    df = df[df.days_left.notna() & (df.days_left <= within_days)].copy()
    df["alert"] = df.days_left.map(lambda n: "기한 경과" if n < 0 else "오늘" if n == 0 else "임박")
    return df

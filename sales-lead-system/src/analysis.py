"""Phase 5: 모두의 플랫폼 영업 포인트 분석 — 규칙 기반 제안 + 축적된 포인트/영업 현황 집계."""
import re
import pandas as pd
from common import load_config
import leaddb as L


def suggest_points(db, lead_id):
    """시설 유형·이름에 맞는 영업 포인트 제안(이미 등록된 것은 제외). 사람이 선택해 저장."""
    lead = L.get_lead(db, lead_id)
    text = f"{lead['facility_kind']} {lead['name']}"
    have = set(L.get_sales_points(db, lead_id).point)
    return [r for r in load_config("sources.yaml")["sales_point_rules"]
            if re.search(r["match"], text) and r["point"] not in have]


def points_summary(db):
    return pd.read_sql("""SELECT COALESCE(l.facility_kind,'-') AS 유형, COALESCE(s.category,'other') AS 분류, COUNT(*) AS 건수
        FROM sales_points s JOIN leads l ON l.id=s.lead_id GROUP BY 1,2 ORDER BY 3 DESC""", db)


def funnel(db):
    df = pd.read_sql("SELECT l.grade, o.stage, COUNT(*) n FROM outreach o JOIN leads l ON l.id=o.lead_id GROUP BY 1,2", db)
    t = df.pivot_table(index="grade", columns="stage", values="n", aggfunc="sum", fill_value=0)
    return t.reindex(columns=[s for s in L.STAGES if s in t.columns]).rename(columns=L.STAGE_KO)


def kind_coverage(db):
    """유형별 리드 수·등급 분포·연락처 확보율 — 확대 우선순위 판단용."""
    return pd.read_sql("""SELECT COALESCE(l.facility_kind,'-') AS 유형, COUNT(*) AS 전체,
        SUM(l.grade='A') AS A, SUM(l.grade='B') AS B, SUM(l.grade='C') AS C,
        ROUND(100.0*SUM(EXISTS(SELECT 1 FROM contacts c WHERE c.lead_id=l.id))/COUNT(*),1) AS '연락처 확보율(%)'
        FROM leads l GROUP BY 1 ORDER BY 2 DESC""", db)

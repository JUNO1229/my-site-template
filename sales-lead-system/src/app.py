"""리드 관리 UI (Streamlit). 실행: streamlit run src/app.py"""
import os
import io
import datetime as dt
import pandas as pd
import streamlit as st
import leaddb as L

DB = os.environ.get("LEADS_DB", os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "leads.db"))
CONF_KO = {"verified_official": "공식 확인", "public_data": "공공데이터", "third_party_recheck": "제3자(재확인)", "unknown": "미상"}

st.set_page_config(page_title="영업처 관리", layout="wide")
if not os.path.exists(DB):
    st.error("data/leads.db 가 없습니다. 먼저 `python src/build_master.py` 를 실행하세요.")
    st.stop()
db = L.connect(DB)

tab_list, tab_queue = st.tabs(["리드 목록", "연락처 보강 큐"])

with tab_list:
    all_ = L.list_leads(db, include_mobile=True)
    with st.sidebar:
        st.header("필터")
        grades = st.multiselect("필요도", ["A", "B", "C"], default=["A", "B"])
        sidos = st.multiselect("시도", sorted(all_.sido.dropna().unique()))
        kinds = st.multiselect("유형", sorted(all_.facility_kind.dropna().unique()))
        stages = st.multiselect("영업단계", L.STAGES, format_func=L.STAGE_KO.get)
        ph = st.radio("연락처", ["전체", "있음", "없음"], horizontal=True)
        text = st.text_input("이름 검색")
        mobile = st.checkbox("이동식·행사성 포함", False)
    df = L.list_leads(db, grades, sidos, kinds, stages, {"전체": None, "있음": True, "없음": False}[ph], text, mobile)
    st.caption(f"{len(df)}건")
    show = df.assign(stage=df.stage.map(L.STAGE_KO), phone_confidence=df.phone_confidence.map(CONF_KO)).drop(columns=["lead_type"])
    sel = st.dataframe(show, hide_index=True, on_select="rerun", selection_mode="single-row", width="stretch",
                       column_config={"id": None, "grade": "필요도", "sido": "시도", "name": "시설·기관명", "facility_kind": "유형",
                                      "operating_status": "영업상태", "score": "점수", "stage": "영업단계",
                                      "next_action_on": "다음 조치일", "phone": "대표전화", "phone_confidence": "신뢰도"})
    c1, c2 = st.columns(2)
    ex = L.export_frame(db, grades=grades, sidos=sidos, kinds=kinds, stages=stages, text=text, include_mobile=mobile)
    c1.download_button("CSV 내보내기", ex.to_csv(index=False).encode("utf-8-sig"), "leads.csv", "text/csv")
    try:
        buf = io.BytesIO(); ex.to_excel(buf, index=False)
        c2.download_button("Excel 내보내기", buf.getvalue(), "leads.xlsx")
    except ImportError:
        c2.caption("Excel 은 openpyxl 설치 필요")

    if sel.selection.rows:
        lid = int(df.iloc[sel.selection.rows[0]].id)
        lead, o = L.get_lead(db, lid), L.get_outreach(db, lid)
        st.divider()
        st.subheader(f"[{lead['grade']}] {lead['name']}")
        st.write(f"{lead['sido'] or ''} · {lead['address'] or '-'} · {lead['facility_kind']} · {lead['operating_status']}")
        st.caption(lead["grade_reason"])
        left, right = st.columns(2)
        with left:
            st.markdown("**연락처 (조직 단위 공개 연락처만)**")
            st.dataframe(L.get_contacts(db, lid).assign(confidence=lambda d: d.confidence.map(CONF_KO)), hide_index=True)
            with st.expander("연락처 추가"):
                v = st.text_input("전화번호/URL"); dept = st.text_input("부서(개인명 금지)")
                conf = st.selectbox("신뢰도", list(CONF_KO)[:3], format_func=CONF_KO.get)
                src = st.text_input("출처 URL"); on = st.date_input("확인일", dt.date.today())
                if st.button("연락처 저장") and v:
                    try:
                        L.add_contact(db, lid, "phone", v, conf, dept, None, src or None, str(on)); st.rerun()
                    except ValueError as e:
                        st.error(str(e))
        with right:
            st.markdown("**영업 진행**")
            stage = st.selectbox("단계", L.STAGES, index=L.STAGES.index(o["stage"]), format_func=L.STAGE_KO.get)
            na = st.text_input("다음 조치", o["next_action"] or "")
            nd = st.text_input("다음 조치일(YYYY-MM-DD)", o["next_action_on"] or "")
            owner = st.text_input("담당", o["owner"] or "")
            memo = st.text_area("메모", o["memo"] or "")
            consent = st.checkbox("이메일 수신 동의 확인됨", bool(o["consent_for_email"]),
                                  help="정보통신망법: 동의 없으면 이메일·문자·팩스 발송 불가. 최초 접촉은 전화·문의폼·우편.")
            if stage == "do_not_contact":
                st.warning("연락 금지: 발송 큐와 내보내기에서 영구 제외됩니다.")
            if st.button("저장", type="primary"):
                L.update_outreach(db, lid, stage, na, nd, owner, memo, consent and stage != "do_not_contact")
                st.rerun()
        st.markdown("**영업 포인트**")
        st.dataframe(L.get_sales_points(db, lid), hide_index=True)
        p1, p2 = st.columns([3, 1])
        pt, cat = p1.text_input("포인트 추가"), p2.selectbox("분류", L.SALES_CATS)
        if st.button("포인트 저장") and pt:
            L.add_sales_point(db, lid, pt, cat); st.rerun()
    else:
        st.info("목록에서 행을 선택하면 상세·영업 입력이 열립니다.")

with tab_queue:
    q = L.enrichment_queue(db)
    st.write(f"전화번호 없는 A/B 리드 {len(q)}건 — 공식 사이트에서 사람이 확인 후 [리드 목록]에서 연락처를 추가하세요. (봇 차단 사이트는 우회 금지)")
    st.dataframe(q[["grade", "sido", "name", "facility_kind", "stage"]], hide_index=True, width="stretch")
    st.markdown("**확인 실패 이력**")
    st.dataframe(pd.read_sql("SELECT * FROM unresolved_contacts", db), hide_index=True)

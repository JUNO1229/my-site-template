"""리드 관리 UI (Streamlit). 실행: streamlit run src/app.py"""
import os
import io
import datetime as dt
import pandas as pd
import streamlit as st
import leaddb as L
import enrich as E
import dispatch as D

DB = os.environ.get("LEADS_DB", os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "leads.db"))
CONF_KO = {"verified_official": "공식 확인", "public_data": "공공데이터", "third_party_recheck": "제3자(재확인)", "unknown": "미상"}

st.set_page_config(page_title="영업처 관리", layout="wide")
if not os.path.exists(DB):
    st.error("data/leads.db 가 없습니다. 먼저 `python src/build_master.py` 를 실행하세요.")
    st.stop()
db = L.connect(DB)

tab_list, tab_queue, tab_review, tab_send, tab_alert = st.tabs(["리드 목록", "연락처 보강 큐", "후보 검수", "발송·이력", "후속 알림"])

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

with tab_queue:
    st.divider()
    st.subheader("공식 사이트로 후보 수집")
    st.caption("robots.txt 를 준수하며, 차단·접속 실패는 우회하지 않고 '차단' 후보로 남겨 수동 확인합니다. 수집 결과는 검수 전까지 연락처에 반영되지 않습니다.")
    opts = {f"[{r.grade}] {r.name} ({r.sido})": int(r.id) for r in q.itertuples()}
    if opts:
        pick = st.selectbox("리드", list(opts))
        url = st.text_input("공식 사이트 URL (https://...)")
        a, b = st.columns(2)
        if a.button("사이트에서 번호 후보 수집") and url.startswith("http"):
            res = E.collect_from_site(db, opts[pick], url)
            st.success(f"후보 {len(res['phones'])}건 수집") if res["status"] == "ok" else st.warning("차단/접속 실패 — 수동 확인 목록에 기록됨")
        with b.popover("수동 후보 등록"):
            mv = st.text_input("번호(조직 대표번호만)"); ms = st.text_input("출처 URL"); md = st.text_input("부서")
            if st.button("후보 등록") and mv:
                try:
                    E.add_candidate(db, opts[pick], "phone", mv, ms or None, md or None)
                    st.success("등록됨")
                except ValueError as e:
                    st.error(str(e))

with tab_review:
    c = E.pending(db)
    st.write(f"검수 대기 {len(c)}건")
    reviewer = st.text_input("검수자")
    for r in c.itertuples():
        with st.container(border=True):
            st.write(f"**[{r.grade}] {r.name}** · {r.channel}: `{r.value}` · 상태: {r.status}")
            st.caption(f"출처: {r.source_url or '-'} · {r.note or ''}")
            if r.status == "pending":
                x1, x2, x3 = st.columns(3)
                if x1.button("공식 확인 승인", key=f"o{r.id}"):
                    try: E.approve(db, r.id, reviewer, True); st.rerun()
                    except ValueError as e: st.error(str(e))
                if x2.button("제3자(재확인) 승인", key=f"t{r.id}"):
                    try: E.approve(db, r.id, reviewer, False); st.rerun()
                    except ValueError as e: st.error(str(e))
                if x3.button("반려", key=f"r{r.id}"):
                    E.reject(db, r.id, reviewer or "-"); st.rerun()

with tab_send:
    st.caption("발송을 기록·검증합니다(자동 전송 없음). 이메일·문자·팩스는 수신 동의가 확인된 리드만, 최초 접촉은 전화·문의폼·우편을 권장합니다. 연락 금지 리드는 모든 채널이 차단됩니다.")
    with st.expander("자료 등록(소개서·도입제안서)"):
        dn, dk, dv = st.text_input("자료명"), st.selectbox("종류", ["intro", "proposal", "other"]), st.text_input("버전", "v1")
        up = st.file_uploader("파일(선택)")
        if st.button("자료 저장") and dn:
            path = None
            if up:
                import tempfile
                t = os.path.join(tempfile.mkdtemp(), up.name); open(t, "wb").write(up.getvalue()); path = t
            D.register_document(db, dn, dk, path, dv); st.rerun()
    docs = D.documents(db)
    st.dataframe(docs[["name", "kind", "version", "file_path"]] if len(docs) else docs, hide_index=True)
    leads_all = L.list_leads(db, grades=["A", "B"])
    lo = {f"[{r.grade}] {r.name} ({L.STAGE_KO[r.stage]})": int(r.id) for r in leads_all.itertuples() if r.stage != "do_not_contact"}
    if lo and len(docs):
        pick = st.selectbox("대상 리드", list(lo), key="sp")
        c1, c2, c3 = st.columns(3)
        ch = c1.selectbox("채널", ["call", "web_form", "post", "email", "sms", "fax"])
        dsel = c2.selectbox("자료", docs.id.tolist(), format_func=lambda i: docs.set_index("id").name[i])
        by = c3.text_input("발송자")
        to, nt = st.text_input("수신처(조직 연락처)"), st.text_input("메모", key="dn")
        b1, b2 = st.columns(2)
        if b1.button("발송/접촉 기록", type="primary"):
            try:
                D.log_dispatch(db, lo[pick], int(dsel), ch, by, to or None, nt or None); st.success("기록됨 · 후속 조치일 +7일"); 
            except (D.DispatchBlocked, ValueError) as e:
                st.error(str(e))
        if b2.button("수신 거부 처리(영구 차단)"):
            D.record_opt_out(db, lo[pick]); st.warning("연락 금지로 전환됨"); st.rerun()
    st.markdown("**발송 이력**")
    st.dataframe(D.history(db), hide_index=True, width="stretch")

with tab_alert:
    f = D.followups(db)
    st.write(f"후속 조치 {len(f)}건 (기한 경과·오늘·7일 이내)")
    st.dataframe(f.assign(stage=f.stage.map(L.STAGE_KO))[["alert", "grade", "name", "stage", "next_action", "next_action_on", "owner"]],
                 hide_index=True, width="stretch")

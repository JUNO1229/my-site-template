"use client";
import { useEffect, useMemo, useState } from "react";
import { Avatar } from "./Ui";
import { Icon } from "./Icons";
import { useAppts, useStore } from "@/lib/store";
import { useUi } from "@/lib/ui";
import { addDays, dow, todayStr, toMin } from "@/lib/util";
import type { Patient } from "@/lib/types";
import { api } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { pname } from "@/lib/util";

const ward = (p: Patient) => (p.ward === "외" ? "외래" : p.ward ? `${p.ward}병동` : "");
const md = (d: string) => `${Number(d.slice(5, 7))}월 ${Number(d.slice(8))}일(${dow(d)})`;

/** 환자 정보창 — 기본 정보, 치료정보, 참고사항, 치료 현황, 예정·최근 일정 */
export default function PatientDrawer({ p, canSeeAmount, canEdit, onClose, onEdit, onEnd }: {
  p: Patient; canSeeAmount: boolean; canEdit: boolean; onClose: () => void; onEdit: (p: Patient) => void; onEnd: (p: Patient) => void;
}) {
  const { db, me, refresh } = useStore(); const { openAppt } = useUi(); const { toast } = useToast();
  const [target, setTarget] = useState(""); const [merging, setMerging] = useState(false);
  const isTemp = p.source === "temp";
  const merge = async () => {
    if (!target || merging) return; setMerging(true);
    try { const r = await api<{ moved: number }>(`/api/patients/${p.id}/merge`, "POST", { targetId: target }); await refresh(); toast(`스케줄 ${r.moved}건을 실제 환자로 옮기고 합쳤습니다`); close(); }
    catch (e) { toast((e as Error).message, "err"); setMerging(false); }
  };
  const [closing, setClosing] = useState(false);
  const today = todayStr();
  const appts = useAppts(addDays(today, -180), addDays(today, 90), p.id);
  const close = () => { setClosing(true); setTimeout(onClose, 200); };
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape" && !document.querySelector(".overlay:not(.drawer-wrap)")) close(); }; document.addEventListener("keydown", k); return () => document.removeEventListener("keydown", k); }); // eslint-disable-line
  const itemOf = (id: string) => db.items.find((i) => i.id === id);
  const roomOf = (id: string) => db.rooms.find((r) => r.id === itemOf(id)?.roomId);
  const sorted = useMemo(() => [...appts].sort((a, b) => a.date.localeCompare(b.date) || toMin(a.time) - toMin(b.time)), [appts]);
  const upcoming = sorted.filter((a) => a.status === "예약" && a.date >= today).slice(0, 5);
  const recent = [...sorted].filter((a) => a.date <= today && a.status !== "취소" && a.status !== "연기").reverse().slice(0, 6);
  const cnt = (s: string) => appts.filter((a) => a.status === s).length;
  const ended = p.status === "discharged";
  const canNew = !!me && me.role !== "viewer" && !ended;
  const room = p.bed || (p.ward === "외" ? "외래" : "");
  const Row = ({ a }: { a: (typeof appts)[number] }) => (
    <div className="hrow"><span className="hdate">{md(a.date)}<small>{a.time}</small></span>
      <div className="grow"><b>{itemOf(a.itemId)?.name}{a.option && ` · ${a.option}`}</b><small>{roomOf(a.itemId)?.name}</small></div>
      <span className={`pill st-${a.status}`}>{a.status === "완료" && <Icon name="check" size={12} />}{a.status}</span></div>);
  return (
    <div className={`overlay drawer-wrap ${closing ? "out" : ""}`} onClick={close}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={`${p.name} 환자 정보`} onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <Avatar name={p.name} size={56} />
          <div className="grow"><h3>{p.name}</h3>
            <div className="dsub">{p.chartNo && <span>차트 {p.chartNo}</span>}{ward(p) && <span>{ward(p)}</span>}{room && <span>{room}{/^\d/.test(room) ? "호" : ""}</span>}</div>
            <span className={`pill ${ended ? "mut" : "ok"}`}>{ended ? "퇴원·종료" : isTemp ? "임시 · 상담실 등록 대기" : p.ward === "외" ? "외래" : "재원"}</span></div>
          <button className="icon-btn" aria-label="닫기" onClick={close}><Icon name="x" /></button>
        </div>
        <div className="drawer-body">
          {isTemp && (
            <div className="tmpnote"><b>임시 환자</b> — 치료실에서 이름만 먼저 입력한 환자입니다. 환자명부에 같은 이름으로 등록하면 스케줄이 자동으로 옮겨집니다.
              {canEdit && <><div className="hint" style={{ margin: "8px 0 6px" }}>이미 등록된 환자와 이름이 다르면 직접 합쳐 주세요. (아니면 아래 ‘수정’에서 병동·차트번호를 입력해 그대로 정식 등록)</div>
                <div className="row" style={{ gap: 8, alignItems: "center" }}>
                  <select value={target} onChange={(e) => setTarget(e.target.value)} style={{ flex: 1 }}><option value="">합칠 실제 환자 선택</option>
                    {db.patients.filter((x) => x.source === "registry" && x.status !== "discharged").map((x) => <option key={x.id} value={x.id}>{pname(x)} · 차트 {x.chartNo || "-"}</option>)}</select>
                  <button className="primary" disabled={!target || merging} onClick={() => confirm("임시 환자의 모든 스케줄을 선택한 환자로 옮기고, 임시 환자는 삭제됩니다. 진행할까요?") && merge()}>합치기</button></div></>}
            </div>)}
          <div className="infogrid">
            <div className="ig"><small>입원일 / 치료시작일</small><b>{p.admitDate || "-"}</b></div>
            <div className="ig"><small>{ended ? "퇴원 / 종료일" : "퇴원 예정일"}</small><b>{p.dischargeDate || "-"}</b></div>
            {canSeeAmount && <div className="ig wide"><small>치료계약금액 (본인부담)</small><b>{p.contractAmount != null ? `${p.contractAmount.toLocaleString("ko-KR")}만원` : "-"}</b></div>}
          </div>
          <div className="dsec"><h4>치료정보</h4><p className="dtext">{p.plan || "등록된 치료정보가 없습니다"}</p></div>
          <div className="dsec"><h4>참고사항</h4><p className="dtext">{p.notes || "등록된 참고사항이 없습니다"}</p></div>
          <div className="dsec"><h4>치료 현황 <small>최근 6개월 ~ 향후 3개월</small></h4>
            <div className="kpis"><div className="kpi s-예약"><b>{cnt("예약")}</b>예약</div><div className="kpi s-완료"><b>{cnt("완료")}</b>완료</div><div className="kpi s-연기"><b>{cnt("연기")}</b>연기</div><div className="kpi s-취소"><b>{cnt("취소")}</b>취소</div></div></div>
          <div className="dsec"><h4>다음 치료 일정</h4>{upcoming.length ? <div className="hlist">{upcoming.map((a) => <Row key={a.id} a={a} />)}</div> : <p className="hint">예정된 치료가 없습니다</p>}</div>
          <div className="dsec"><h4>최근 치료 이력</h4>{recent.length ? <div className="hlist">{recent.map((a) => <Row key={a.id} a={a} />)}</div> : <p className="hint">최근 치료 이력이 없습니다</p>}</div>
        </div>
        <div className="drawer-foot">
          {canEdit && <button className={ended ? "btn-restore" : "btn-end"} onClick={() => onEnd(p)}>{ended ? "복귀" : "퇴원/종료"}</button>}
          {canEdit && <button className="btn-soft" onClick={() => { close(); setTimeout(() => onEdit(p), 220); }}><Icon name="edit" size={16} />수정</button>}
          <span style={{ flex: 1 }} />
          {canNew && <button className="primary" onClick={() => openAppt({ date: today, patientId: p.id })}><Icon name="plus" size={16} />스케줄 등록</button>}
        </div>
      </aside>
    </div>
  );
}

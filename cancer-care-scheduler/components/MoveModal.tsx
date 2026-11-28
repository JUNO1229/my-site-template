"use client";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { useToast } from "@/lib/toast";
import { api } from "@/lib/api";
import { OPTIONS, OPTION_LABEL, type Appt } from "@/lib/types";
import { addDays, label, pname } from "@/lib/util";
import { Icon } from "./Icons";
import DateField from "./DateField";

/** 연기 후 다른 날로 옮기기: 원래 일정은 '연기'로 남기고 새 날짜에 같은 치료를 예약한다 */
export default function MoveModal({ appt, onClose }: { appt: Appt; onClose: () => void }) {
  const { db, refresh } = useStore(); const { toast } = useToast();
  const item = db.items.find((i) => i.id === appt.itemId); const room = db.rooms.find((r) => r.id === item?.roomId); const patient = db.patients.find((p) => p.id === appt.patientId);
  const [date, setDate] = useState(addDays(appt.date, 1)); const [time, setTime] = useState(appt.time);
  const [opt, setOpt] = useState<string>(appt.option && appt.option !== "J" ? appt.option : "K"); // 미뤄뒀다 받는 치료 = K 가 기본
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(""); const [canForce, setCanForce] = useState(false); const [closing, setClosing] = useState(false);
  const close = () => { setClosing(true); setTimeout(onClose, 180); };
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") close(); }; document.addEventListener("keydown", k); return () => document.removeEventListener("keydown", k); }); // eslint-disable-line
  const submit = async (force = false) => {
    if (busy || !date || !time) return; setBusy(true); setErr(""); setCanForce(false);
    try {
      await api(`/api/appts/${appt.id}/move`, "POST", { date, time, option: opt, force }); await refresh();
      toast(`${label(date)} ${time}(으)로 옮겼습니다 — 원래 일정은 연기로 남습니다`); close();
    } catch (e) { setErr((e as Error).message); setCanForce((e as Error & { code?: string }).code === "conflict"); setBusy(false); }
  };
  return (
    <div className={`overlay ${closing ? "out" : ""}`} onClick={close}>
      <div className="modal sheet" role="dialog" aria-modal="true" aria-label="연기 후 다른 날로 옮기기" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head"><span className="grab" /><h3>연기 후 다른 날로 옮기기</h3><button className="icon-btn" aria-label="닫기" onClick={close}><Icon name="x" /></button></div>
        <div className="sheet-body">
          <p className="hint planhint"><b>{pname(patient)}</b> · {room?.name}{item && item.name !== room?.name ? ` · ${item.name}` : ""}<br />원래 일정 {label(appt.date)} {appt.time} → <b>연기</b>로 남고, 아래 날짜에 새 예약이 만들어집니다.</p>
          <div className="row">
            <label>옮길 날짜<DateField value={date} onChange={(v) => v && setDate(v)} /></label>
            <label>시작시간<input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></label>
          </div>
          {item && item.slots.length > 0 && <div className="chips" aria-label="추천 시작시간">{item.slots.map((s) => <button key={s} type="button" className={time === s ? "chip on" : "chip"} onClick={() => setTime(s)}>{s}</button>)}</div>}
          <div className="fieldlabel">옮긴 일정의 치료옵션</div>
          <div className="chips">{OPTIONS.map((o) => <button key={o || "none"} type="button" className={`chip ${opt === o ? "on" : ""}`} onClick={() => setOpt(o)}>{OPTION_LABEL[o]}</button>)}</div>
          {err && <p className="err"><Icon name="alert" size={16} /> {err}</p>}
          {canForce && <button type="button" className="btn-ghost danger" disabled={busy} onClick={() => submit(true)}>겹쳐도 일단 옮기기</button>}
        </div>
        <div className="sheet-foot"><button className="btn-ghost" onClick={close}>취소</button><button className="cta" disabled={busy || !date || !time} onClick={() => submit(false)}>{busy ? "옮기는 중…" : "옮기기"}</button></div>
      </div>
    </div>
  );
}

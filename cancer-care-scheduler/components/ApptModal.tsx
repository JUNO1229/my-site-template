"use client";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { OPTIONS, STATUSES, type Appt } from "@/lib/types";
import { pname } from "@/lib/util";
import { canEditRoom } from "@/lib/perm";

export type Draft = Partial<Appt> & { date: string };
export default function ApptModal({ draft, onClose }: { draft: Draft; onClose: () => void }) {
  const { db, me, saveAppt, deleteAppt } = useStore();
  const [err, setErr] = useState("");
  const [f, setF] = useState<Draft>({ time: "09:00", option: "", status: "예약", memo: "", itemId: db.items.find((i) => canEditRoom(me, i.roomId))?.id ?? db.items[0]?.id, patientId: db.patients[0]?.id, ...draft });
  const set = (k: keyof Appt, v: string) => setF((p) => ({ ...p, [k]: v }));
  const item = db.items.find((i) => i.id === f.itemId);
  const patient = db.patients.find((p) => p.id === f.patientId);
  const writable = canEditRoom(me, item?.roomId);
  const submit = async () => { if (!f.patientId || !f.itemId || !f.time) return; try { await saveAppt(f as Appt); onClose(); } catch (e) { setErr((e as Error).message); } };
  const del = async () => { try { await deleteAppt(f.id!); onClose(); } catch (e) { setErr((e as Error).message); } };
  const itemsAllowed = db.items.filter((i) => canEditRoom(me, i.roomId) || i.id === f.itemId);
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{f.id ? "스케줄 수정" : "스케줄 등록"}</h3>
        <label>환자<select value={f.patientId} onChange={(e) => set("patientId", e.target.value)}>
          {db.patients.map((p) => <option key={p.id} value={p.id}>{pname(p)} · 차트 {p.chartNo}</option>)}</select></label>
        {patient && <p className="hint">{patient.plan || "치료정보 없음"}{patient.notes && ` / ${patient.notes}`}</p>}
        <div className="row">
          <label>치료일자<input type="date" value={f.date} onChange={(e) => set("date", e.target.value)} /></label>
          <label>시작시간<input type="time" value={f.time} onChange={(e) => set("time", e.target.value)} /></label>
        </div>
        <label>치료<select value={f.itemId} onChange={(e) => set("itemId", e.target.value)}>
          {db.rooms.filter((r) => itemsAllowed.some((i) => i.roomId === r.id)).map((r) => <optgroup key={r.id} label={r.name}>
            {itemsAllowed.filter((i) => i.roomId === r.id).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</optgroup>)}</select></label>
        {item && item.slots.length > 0 && <div className="chips">{item.slots.map((s) =>
          <button key={s} type="button" className={f.time === s ? "chip on" : "chip"} onClick={() => set("time", s)}>{s}</button>)}</div>}
        <div className="row">
          <label>치료옵션<select value={f.option} onChange={(e) => set("option", e.target.value)}>
            {OPTIONS.map((o) => <option key={o} value={o}>{o || "-"}</option>)}</select></label>
          <label>치료상태<select value={f.status} onChange={(e) => set("status", e.target.value)}>
            {STATUSES.map((s) => <option key={s}>{s}</option>)}</select></label>
        </div>
        <label>비고<input value={f.memo} onChange={(e) => set("memo", e.target.value)} /></label>
        {err && <p className="err">{err}</p>}{!writable && <p className="hint">조회 권한만 있어 수정할 수 없습니다.</p>}
        <div className="actions">
          {f.id && writable && <button className="danger" onClick={del}>삭제</button>}
          <span style={{ flex: 1 }} />
          <button onClick={onClose}>취소</button>
          {writable && <button className="primary" onClick={submit}>저장</button>}
        </div>
      </div>
    </div>
  );
}

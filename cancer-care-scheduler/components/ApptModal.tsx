"use client";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { useToast } from "@/lib/toast";
import { OPTIONS, STATUSES, type Appt } from "@/lib/types";
import { pname } from "@/lib/util";
import { canEditRoom } from "@/lib/perm";
import { Icon } from "./Icons";
import DateField from "./DateField";

export type Draft = Partial<Appt> & { date: string };
export default function ApptModal({ draft, onClose }: { draft: Draft; onClose: () => void }) {
  const { db, me, saveAppt, deleteAppt } = useStore();
  const { toast } = useToast();
  const [closing, setClosing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [f, setF] = useState<Draft>({ time: "09:00", option: "", status: "예약", memo: "", itemId: db.items.find((i) => canEditRoom(me, i.roomId))?.id ?? db.items[0]?.id, patientId: db.patients.find((p) => p.source !== "auto" && p.status !== "discharged")?.id ?? db.patients[0]?.id, ...draft });
  const set = (k: keyof Appt, v: string) => setF((p) => ({ ...p, [k]: v }));
  const item = db.items.find((i) => i.id === f.itemId);
  const patient = db.patients.find((p) => p.id === f.patientId);
  const writable = canEditRoom(me, item?.roomId);
  const valid = !!f.patientId && !!f.itemId && !!f.time && !!f.date;
  const close = () => { setClosing(true); setTimeout(onClose, 180); };
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") close(); }; document.addEventListener("keydown", k); return () => document.removeEventListener("keydown", k); }); // eslint-disable-line
  const submit = async () => {
    if (!valid || busy) return; setBusy(true); setErr("");
    try { await saveAppt(f as Appt); toast(f.id ? "스케줄을 수정했습니다" : "스케줄을 등록했습니다"); close(); }
    catch (e) { setErr((e as Error).message); setBusy(false); }
  };
  const del = async () => { if (!f.id || !confirm("이 스케줄을 삭제할까요?")) return; try { await deleteAppt(f.id); toast("스케줄을 삭제했습니다"); close(); } catch (e) { setErr((e as Error).message); } };
  const allowed = db.items.filter((i) => canEditRoom(me, i.roomId) || i.id === f.itemId);
  return (
    <div className={`overlay ${closing ? "out" : ""}`} onClick={close}>
      <div className="modal sheet" role="dialog" aria-modal="true" aria-label={f.id ? "스케줄 수정" : "스케줄 등록"} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head"><span className="grab" /><h3>{f.id ? "스케줄 수정" : "스케줄 등록"}</h3>
          <button className="icon-btn" aria-label="닫기" onClick={close}><Icon name="x" /></button></div>
        <div className="sheet-body">
          <label>환자<select value={f.patientId} onChange={(e) => set("patientId", e.target.value)}>
            {db.patients.filter((p) => (p.source !== "auto" && p.status !== "discharged") || p.id === f.patientId).map((p) => <option key={p.id} value={p.id}>{pname(p)} · 차트 {p.chartNo || "-"}</option>)}</select></label>
          {patient && (patient.plan || patient.notes) && <p className="hint planhint">{patient.plan}{patient.notes && ` / ${patient.notes}`}</p>}
          <div className="row">
            <label>치료일자<DateField value={f.date} onChange={(v) => set("date", v)} /></label>
            <label>시작시간<input type="time" value={f.time} onChange={(e) => set("time", e.target.value)} /></label>
          </div>
          <label>치료<select value={f.itemId} onChange={(e) => set("itemId", e.target.value)}>
            {db.rooms.filter((r) => allowed.some((i) => i.roomId === r.id)).map((r) => <optgroup key={r.id} label={r.name}>
              {allowed.filter((i) => i.roomId === r.id).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</optgroup>)}</select></label>
          {item && item.slots.length > 0 && <div className="chips" aria-label="추천 시작시간">{item.slots.map((s) =>
            <button key={s} type="button" className={f.time === s ? "chip on" : "chip"} onClick={() => set("time", s)}>{s}</button>)}</div>}
          <div className="fieldlabel">치료상태</div>
          <div className="chips">{STATUSES.map((s) => <button key={s} type="button" className={`chip ${f.status === s ? "on" : ""}`} onClick={() => set("status", s)}>{s}</button>)}</div>
          <div className="fieldlabel">치료옵션</div>
          <div className="chips">{OPTIONS.map((o) => <button key={o || "none"} type="button" className={`chip ${f.option === o ? "on" : ""}`} onClick={() => set("option", o)}>{o || "없음"}</button>)}</div>
          <label>비고<input value={f.memo} onChange={(e) => set("memo", e.target.value)} placeholder="필요한 메모를 입력하세요" /></label>
          {err && <p className="err"><Icon name="alert" size={16} /> {err}</p>}
          {!writable && <p className="hint">조회 권한만 있어 수정할 수 없습니다.</p>}
        </div>
        <div className="sheet-foot">
          {f.id && writable && <button className="btn-ghost danger" onClick={del}><Icon name="trash" size={18} />삭제</button>}
          {writable && <button className="cta" disabled={!valid || busy} onClick={submit}>{busy ? "저장 중…" : f.id ? "저장" : "등록"}</button>}
        </div>
      </div>
    </div>
  );
}

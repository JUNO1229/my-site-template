"use client";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { useToast } from "@/lib/toast";
import { OPTIONS, OPTION_LABEL, STATUSES, type Appt } from "@/lib/types";
import { pname } from "@/lib/util";
import { canEditRoom } from "@/lib/perm";
import { Icon } from "./Icons";
import { api } from "@/lib/api";
import DateField from "./DateField";

export type Draft = Partial<Appt> & { date: string };
export default function ApptModal({ draft, onClose }: { draft: Draft; onClose: () => void }) {
  const { db, me, saveAppt, deleteAppt, refresh } = useStore();
  const [tmpOpen, setTmpOpen] = useState(false); const [tmpName, setTmpName] = useState(""); const [tmpBusy, setTmpBusy] = useState(false);
  const { toast } = useToast();
  const [closing, setClosing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(""); const [canForce, setCanForce] = useState(false);
  const [lastKeep, setLastKeep] = useState(false); const [q, setQ] = useState(""); const [added, setAdded] = useState<string[]>([]);
  const openedAt = useRef(Date.now()); const qRef = useRef<HTMLInputElement>(null);
  const [f, setF] = useState<Draft>({ time: "09:00", option: "", status: "예약", memo: "", itemId: db.items.find((i) => canEditRoom(me, i.roomId))?.id ?? db.items[0]?.id, patientId: "", ...draft });
  const set = (k: keyof Appt, v: string) => setF((p) => ({ ...p, [k]: v }));
  const item = db.items.find((i) => i.id === f.itemId);
  const patient = db.patients.find((p) => p.id === f.patientId);
  const writable = canEditRoom(me, item?.roomId);
  const valid = !!f.patientId && !!f.itemId && !!f.time && !!f.date;
  const addTemp = async () => {
    if (tmpBusy || tmpName.trim().length < 2) return; setTmpBusy(true); setErr("");
    try {
      const r = await api<{ id: string; reused?: boolean }>("/api/patients/temp", "POST", { name: tmpName.trim() });
      await refresh(); setF((p) => ({ ...p, patientId: r.id })); setTmpOpen(false); setTmpName(""); setQ("");
      toast(r.reused ? "이미 임시 등록된 환자입니다. 선택했습니다" : "임시 환자로 등록했습니다 — 상담실에서 정보를 입력하면 자동으로 합쳐집니다");
    } catch (e) { setErr((e as Error).message); } finally { setTmpBusy(false); }
  };
  const close = () => { setClosing(true); setTimeout(onClose, 180); };
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") close(); }; document.addEventListener("keydown", k); return () => document.removeEventListener("keydown", k); }); // eslint-disable-line
  /** keep=true: 등록 후 창을 닫지 않고 환자만 비워 다음 환자를 이어서 입력한다 */
  const submit = async (keep = false, force = false) => {
    if (!valid || busy) return;
    if (!f.id && Date.now() - openedAt.current < 600) return; // 창이 막 열릴 때의 더블클릭 오입력 방지
    setBusy(true); setErr(""); setCanForce(false);
    try {
      await saveAppt({ ...f, force } as unknown as Appt);
      if (keep && !f.id) {
        setAdded((a) => [...a, `${pname(patient!)} ${f.time}${item ? ` · ${item.name}` : ""}`]);
        toast(`${pname(patient!)}님 등록 — 다음 환자를 선택하세요`); setF((p) => ({ ...p, patientId: "", memo: "" })); setQ(""); setBusy(false);
        setTimeout(() => qRef.current?.focus(), 30);
      } else { toast(f.id ? "스케줄을 수정했습니다" : "스케줄을 등록했습니다"); close(); }
    } catch (e) { setErr((e as Error).message); setCanForce((e as Error & { code?: string }).code === "conflict"); setLastKeep(keep); setBusy(false); }
  };
  const del = async () => { if (!f.id || !confirm("이 스케줄을 삭제할까요?")) return; try { await deleteAppt(f.id); toast("스케줄을 삭제했습니다"); close(); } catch (e) { setErr((e as Error).message); } };
  const allowed = db.items.filter((i) => canEditRoom(me, i.roomId) || i.id === f.itemId);
  return (
    <div className={`overlay ${closing ? "out" : ""}`} onClick={close}>
      <div className="modal sheet" role="dialog" aria-modal="true" aria-label={f.id ? "스케줄 수정" : "스케줄 등록"} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head"><span className="grab" /><h3>{f.id ? "스케줄 수정" : "스케줄 등록"}</h3>
          <button className="icon-btn" aria-label="닫기" onClick={close}><Icon name="x" /></button></div>
        <div className="sheet-body">
          {!f.id && <label>환자 검색<input ref={qRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="이름·차트번호로 찾기" autoComplete="off" /></label>}
          <label>환자<select value={f.patientId} onChange={(e) => set("patientId", e.target.value)}>
            <option value="" disabled>환자를 선택하세요</option>
            {db.patients.filter((p) => (p.source !== "auto" && p.status !== "discharged" && (!q.trim() || (pname(p) + " " + p.chartNo).toLowerCase().includes(q.trim().toLowerCase()))) || p.id === f.patientId).map((p) => <option key={p.id} value={p.id}>{pname(p)} · 차트 {p.chartNo || "-"}</option>)}</select></label>
          {!f.id && (tmpOpen ? (
            <div className="tmpreg"><small className="hint">상담실에서 아직 환자명부에 입력하지 않은 환자입니다. 이름만 먼저 입력하면 임시 환자로 등록되고, 나중에 상담실이 등록하면 스케줄이 자동으로 합쳐집니다.</small>
              <div className="row"><input value={tmpName} onChange={(e) => setTmpName(e.target.value)} placeholder="환자 이름 (예: 홍길동)" maxLength={30} autoFocus onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTemp(); } }} />
                <button type="button" className="btn-soft" disabled={tmpBusy || tmpName.trim().length < 2} onClick={addTemp}>{tmpBusy ? "등록 중…" : "임시 등록"}</button>
                <button type="button" className="btn-ghost" onClick={() => setTmpOpen(false)}>취소</button></div></div>
          ) : <button type="button" className="linkbtn" onClick={() => setTmpOpen(true)}>+ 명단에 없는 환자 (이름만 먼저 임시 등록)</button>)}
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
          <div className="chips">{OPTIONS.map((o) => <button key={o || "none"} type="button" className={`chip ${(f.option === o || (o === "" && f.option === "J")) ? "on" : ""}`} onClick={() => set("option", o)}>{OPTION_LABEL[o]}</button>)}</div>
          <label>비고<input value={f.memo} onChange={(e) => set("memo", e.target.value)} placeholder="필요한 메모를 입력하세요" /></label>
          {added.length > 0 && <p className="hint addedlist"><b>이번에 등록한 스케줄 {added.length}건</b><br />{added.join(" / ")}</p>}
          {err && <p className="err"><Icon name="alert" size={16} /> {err}</p>}
          {canForce && <button type="button" className="btn-ghost danger" disabled={busy} onClick={() => confirm("중복·정원 초과를 확인했습니다. 예외로 등록할까요?") && submit(lastKeep, true)}>그래도 등록 (예외)</button>}
          {!writable && <p className="hint">조회 권한만 있어 수정할 수 없습니다.</p>}
        </div>
        <div className="sheet-foot">
          {f.id && writable && <button className="btn-ghost danger" onClick={del}><Icon name="trash" size={18} />삭제</button>}
          {writable && !f.id && <button className="btn-ghost" disabled={!valid || busy} onClick={() => submit(true)}>등록 후 계속 입력</button>}
          {writable && <button className="cta" disabled={!valid || busy} onClick={() => submit(false)}>{busy ? "저장 중…" : f.id ? "저장" : added.length ? "등록 후 닫기" : "등록"}</button>}
        </div>
      </div>
    </div>
  );
}

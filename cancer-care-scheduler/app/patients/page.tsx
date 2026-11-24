"use client";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { canEditPatients, canViewSickrooms, isAdmin } from "@/lib/perm";
import { WARDS_LIST } from "@/lib/wards";
import type { Patient } from "@/lib/types";
import { todayStr } from "@/lib/util";
import { cmpBed, vacantBeds } from "@/lib/sickroom";
import { PageSkeleton } from "@/components/Ui";
import PatientDrawer from "@/components/PatientDrawer";
import DateField from "@/components/DateField";
import { useToast } from "@/lib/toast";

const blank: Omit<Patient, "id"> = { chartNo: "", name: "", ward: "1", bed: "", admitDate: "", dischargeDate: "", plan: "", notes: "", contractAmount: null };
export default function Patients() {
  const { db, ready, me, savePatient, deletePatient, setPatientStatus } = useStore();
  const [err, setErr] = useState("");
  const editable = canEditPatients(me);
  const [q, setQ] = useState("");
  const [showVacant, setShowVacant] = useState(false);
  const [view, setView] = useState<"in" | "out" | "ended">("in"); // 재원 / 외래 / 퇴원·종료
  const [info, setInfo] = useState<string | null>(null);
  const [end, setEnd] = useState<{ p: Patient; date: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  useEffect(() => {
    const init = new URLSearchParams(location.search).get("q"); if (init) setQ(init);
    const on = (e: Event) => setQ((e as CustomEvent<string>).detail ?? "");
    window.addEventListener("global-search", on); return () => window.removeEventListener("global-search", on);
  }, []);
  const [edit, setEdit] = useState<(Omit<Patient, "id"> & { id?: string }) | null>(null);
  if (!ready) return <PageSkeleton />;
  const registry = db.patients.filter((p) => p.source !== "auto");
  const isEnded = (p: Patient) => p.status === "discharged";
  const isOut = (p: Patient) => p.ward === "외";
  const inN = registry.filter((p) => !isEnded(p) && !isOut(p)).length, outN = registry.filter((p) => !isEnded(p) && isOut(p)).length, endedN = registry.filter(isEnded).length;
  const inView = (p: Patient) => (view === "ended" ? isEnded(p) : !isEnded(p) && (view === "out") === isOut(p));
  const list = registry.filter((p) => inView(p) && (!q || p.name.includes(q) || p.chartNo.includes(q)));
  const infoP = db.patients.find((p) => p.id === info) ?? null;
  const vacant = vacantBeds(db.sickrooms, db.patients, todayStr());
  type Row = { p?: Patient; bed: string; vacant?: boolean };
  const bedOf = (p: Patient) => (p.ward === "외" && !p.bed ? "외래" : p.bed);
  const patientRows: Row[] = list.map((p) => ({ p, bed: bedOf(p) }));
  const vacantRows: Row[] = view === "in" && showVacant && !q ? vacant.map((v) => ({ bed: v.label, vacant: true })) : [];
  const rows: Row[] = [...patientRows, ...vacantRows]
    .sort((x, y) => cmpBed(x.bed, y.bed) || Number(!!x.vacant) - Number(!!y.vacant) || (x.p?.name ?? "").localeCompare(y.p?.name ?? "", "ko"));
  const set = (k: keyof Patient, v: string) => setEdit((e) => e && { ...e, [k]: v });
  return (
    <>
      <div className="fillpage">
      <div className="toolbar"><h2>환자명부</h2>
        <div className="seg" role="tablist">
          <button className={view === "in" ? "on" : ""} role="tab" aria-selected={view === "in"} onClick={() => setView("in")}>재원 {inN}</button>
          <button className={view === "out" ? "on" : ""} role="tab" aria-selected={view === "out"} onClick={() => setView("out")}>외래 {outN}</button>
          <button className={view === "ended" ? "on" : ""} role="tab" aria-selected={view === "ended"} onClick={() => setView("ended")}>퇴원·종료 {endedN}</button>
        </div>
        {view === "in" && canViewSickrooms(me) && <label className="chk"><input type="checkbox" checked={showVacant} onChange={(e) => setShowVacant(e.target.checked)} />빈병실 포함 보기 (빈 병상 {vacant.length})</label>}
        <input className="qinput" placeholder="이름·차트번호 검색" value={q} onChange={(e) => setQ(e.target.value)} />
        {editable && <button className="primary" onClick={() => setEdit(blank)}>+ 환자 등록</button>}</div>
      <div className="tblwrap fixhead">
        <table className="tbl compact"><thead><tr><th>병동</th><th>병실</th><th>환자명</th><th>차트번호</th><th>입원일</th><th>{view === "ended" ? "퇴원·종료일" : "퇴원예정"}</th>{editable && <th title="치료계약금액(본인부담, 만원)">계약금액</th>}<th>치료정보</th><th>참고사항</th><th /></tr></thead>
          <tbody>{rows.map((r, i) => r.vacant || !r.p ? (
            <tr key={`v${i}`} className="vacant"><td>{/^\d/.test(r.bed) ? r.bed[0] : ""}</td><td>{r.bed}</td><td>(빈병실)</td><td colSpan={editable ? 7 : 6} /></tr>
          ) : (() => { const p = r.p; return (
            <tr key={p.id} className={`clickable ${isEnded(p) ? "ended" : ""}`} tabIndex={0} onClick={() => setInfo(p.id)} onKeyDown={(e) => { if (e.key === "Enter") setInfo(p.id); }}><td>{p.ward}</td><td>{r.bed}</td><td>{p.name}</td><td>{p.chartNo}</td><td>{p.admitDate}</td><td>{p.dischargeDate}</td>
              {editable && <td style={{ textAlign: "right" }}>{p.contractAmount != null ? `${p.contractAmount.toLocaleString("ko-KR")}만원` : ""}</td>}
              <td className="plan">{p.plan}</td><td className="notes">{p.notes}</td>
              <td className="rowact" onClick={(e) => e.stopPropagation()}>{editable && (isEnded(p) ? <button className="btn-restore" onClick={() => setEnd({ p, date: todayStr() })}>복귀</button> : <button className="btn-end" onClick={() => setEnd({ p, date: todayStr() })}>퇴원/종료</button>)}{editable && <button onClick={() => setEdit(p)}>수정</button>}</td></tr>); })())}</tbody></table>
      </div>
      </div>
      {infoP && <PatientDrawer p={infoP} canSeeAmount={editable} canEdit={editable} onClose={() => setInfo(null)} onEdit={(x) => setEdit(x)} onEnd={(x) => setEnd({ p: x, date: todayStr() })} />}
      {end && (
        <div className="overlay" onClick={() => !busy && setEnd(null)}><div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
          <h3>{isEnded(end.p) ? "복귀 처리" : "퇴원/종료 처리"}</h3>
          <p>{isEnded(end.p) ? <><b>{end.p.name}</b> 님을 다시 재원·외래 목록으로 되돌립니다. 퇴원/종료일은 지워집니다.</> : <><b>{end.p.name}</b> 님을 퇴원/종료 처리합니다.{end.p.bed && ` 병실 ${end.p.bed}는 빈병실로 전환됩니다.`} 기존 치료 기록은 그대로 보관되며 "퇴원·종료" 목록에서 복귀할 수 있습니다.</>}</p>
          {!isEnded(end.p) && <label>퇴원/종료일<DateField value={end.date} onChange={(v) => setEnd({ ...end, date: v })} /></label>}
          {err && <p className="err">{err}</p>}
          <div className="actions"><span style={{ flex: 1 }} /><button onClick={() => setEnd(null)} disabled={busy}>취소</button>
            <button className="primary" disabled={busy || (!isEnded(end.p) && !end.date)} onClick={async () => {
              setBusy(true); setErr("");
              try { await setPatientStatus(end.p.id, isEnded(end.p) ? "active" : "discharged", end.date); toast(isEnded(end.p) ? "복귀 처리했습니다" : "퇴원/종료 처리했습니다"); setEnd(null); setInfo((i) => (i === end.p.id ? null : i)); }
              catch (e) { setErr((e as Error).message); } setBusy(false); }}>{isEnded(end.p) ? "복귀" : "퇴원/종료 처리"}</button></div>
        </div></div>)}
      {edit && (
        <div className="overlay" onClick={() => setEdit(null)}><div className="modal" onClick={(e) => e.stopPropagation()}>
          <h3>{edit.id ? "환자 수정" : "환자 등록"}</h3>
          <div className="row"><label>환자명<input value={edit.name} onChange={(e) => set("name", e.target.value)} /></label>
            <label>차트번호<input value={edit.chartNo} onChange={(e) => set("chartNo", e.target.value)} /></label></div>
          <div className="row"><label>병동<select value={edit.ward} onChange={(e) => set("ward", e.target.value)}>
            {WARDS_LIST.map((w) => <option key={w} value={w}>{w || "(없음)"}</option>)}</select></label>
            <label>병실<input value={edit.bed} onChange={(e) => set("bed", e.target.value)} /></label></div>
          <div className="row"><label>입원일<DateField value={edit.admitDate} allowClear onChange={(v) => set("admitDate", v)} /></label>
            <label>퇴원(예정)일<DateField value={edit.dischargeDate} allowClear onChange={(v) => set("dischargeDate", v)} /></label></div>
          <label>치료계약금액(본인부담, 만원 단위)<input type="number" min={0} value={edit.contractAmount ?? ""} onChange={(e) => setEdit((x) => x && { ...x, contractAmount: e.target.value === "" ? null : Number(e.target.value) })} /></label>
          <label>치료정보<input value={edit.plan} onChange={(e) => set("plan", e.target.value)} /></label>
          <label>참고사항<input value={edit.notes} onChange={(e) => set("notes", e.target.value)} /></label>
          <div className="actions">
            {edit.id && isAdmin(me) && <button className="danger" onClick={async () => { if (confirm("환자와 모든 스케줄이 삭제됩니다.")) { try { await deletePatient(edit.id!); toast("환자를 삭제했습니다"); setEdit(null); } catch (e) { setErr((e as Error).message); } } }}>삭제</button>}
            <span style={{ flex: 1 }} /><button onClick={() => setEdit(null)}>취소</button>
            <button className="primary" onClick={async () => { if (!edit.name) return; try { await savePatient(edit); toast("환자 정보를 저장했습니다"); setEdit(null); setErr(""); } catch (e) { setErr((e as Error).message); } }}>저장</button></div>{err && <p className="err">{err}</p>}
        </div></div>)}
    </>
  );
}

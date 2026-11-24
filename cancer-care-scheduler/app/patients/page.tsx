"use client";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { canEditPatients, isAdmin } from "@/lib/perm";
import { WARDS_LIST } from "@/lib/wards";
import type { Patient } from "@/lib/types";
import { pname } from "@/lib/util";

// 병실 오름차순(101, 102 …), 외래·병실 미지정은 맨 아래
const roomNo = (p: Patient) => { const n = parseInt(p.bed, 10); return Number.isFinite(n) ? n : Infinity; };
const byRoom = (a: Patient, b: Patient) => (roomNo(a) - roomNo(b) || 0) || a.name.localeCompare(b.name, "ko");
const roomLabel = (p: Patient) => (Number.isFinite(roomNo(p)) ? p.bed : p.ward === "외" ? "외래" : p.bed);
const blank: Omit<Patient, "id"> = { chartNo: "", name: "", ward: "1", bed: "", admitDate: "", dischargeDate: "", plan: "", notes: "", contractAmount: null };
export default function Patients() {
  const { db, ready, me, savePatient, deletePatient } = useStore();
  const [err, setErr] = useState("");
  const editable = canEditPatients(me);
  const [q, setQ] = useState("");
  const [past, setPast] = useState(false);
  const [edit, setEdit] = useState<(Omit<Patient, "id"> & { id?: string }) | null>(null);
  if (!ready) return <p>불러오는 중…</p>;
  const autoCount = db.patients.filter((p) => p.source === "auto").length;
  const list = db.patients.filter((p) => (past || p.source !== "auto") && (!q || p.name.includes(q) || p.chartNo.includes(q))).sort(byRoom);
  const set = (k: keyof Patient, v: string) => setEdit((e) => e && { ...e, [k]: v });
  return (
    <>
      <div className="toolbar"><h2>환자명부</h2>
        <b>{list.length}명</b>
        {autoCount > 0 && <label className="chk"><input type="checkbox" checked={past} onChange={(e) => setPast(e.target.checked)} />과거 환자 포함 ({autoCount}명, 스케줄 기록에서 자동 생성)</label>}
        <input placeholder="이름·차트번호 검색" value={q} onChange={(e) => setQ(e.target.value)} />
        {editable && <button className="primary" onClick={() => setEdit(blank)}>+ 환자 등록</button>}</div>
      <div className="tblwrap">
        <table className="tbl compact"><thead><tr><th>병실</th><th>환자(병동)</th><th>차트번호</th><th>입원일</th><th>퇴원예정</th>{editable && <th>계약금액(본인부담)</th>}<th>치료정보</th><th>참고사항</th><th /></tr></thead>
          <tbody>{list.map((p) => (
            <tr key={p.id}><td>{roomLabel(p)}</td><td>{pname(p)}</td><td>{p.chartNo}</td><td>{p.admitDate}</td><td>{p.dischargeDate}</td>
              {editable && <td style={{ textAlign: "right" }}>{p.contractAmount != null ? `${p.contractAmount.toLocaleString("ko-KR")}만원` : ""}</td>}
              <td className="long" title={p.plan}>{p.plan}</td><td className="long" title={p.notes}>{p.notes}</td>
              <td>{editable && <button onClick={() => setEdit(p)}>수정</button>}</td></tr>))}</tbody></table>
      </div>
      {edit && (
        <div className="overlay" onClick={() => setEdit(null)}><div className="modal" onClick={(e) => e.stopPropagation()}>
          <h3>{edit.id ? "환자 수정" : "환자 등록"}</h3>
          <div className="row"><label>환자명<input value={edit.name} onChange={(e) => set("name", e.target.value)} /></label>
            <label>차트번호<input value={edit.chartNo} onChange={(e) => set("chartNo", e.target.value)} /></label></div>
          <div className="row"><label>병동<select value={edit.ward} onChange={(e) => set("ward", e.target.value)}>
            {WARDS_LIST.map((w) => <option key={w} value={w}>{w || "(없음)"}</option>)}</select></label>
            <label>병실<input value={edit.bed} onChange={(e) => set("bed", e.target.value)} /></label></div>
          <div className="row"><label>입원일<input type="date" value={edit.admitDate} onChange={(e) => set("admitDate", e.target.value)} /></label>
            <label>퇴원(예정)일<input type="date" value={edit.dischargeDate} onChange={(e) => set("dischargeDate", e.target.value)} /></label></div>
          <label>치료계약금액(본인부담, 만원 단위)<input type="number" min={0} value={edit.contractAmount ?? ""} onChange={(e) => setEdit((x) => x && { ...x, contractAmount: e.target.value === "" ? null : Number(e.target.value) })} /></label>
          <label>치료정보<input value={edit.plan} onChange={(e) => set("plan", e.target.value)} /></label>
          <label>참고사항<input value={edit.notes} onChange={(e) => set("notes", e.target.value)} /></label>
          <div className="actions">
            {edit.id && isAdmin(me) && <button className="danger" onClick={async () => { if (confirm("환자와 모든 스케줄이 삭제됩니다.")) { try { await deletePatient(edit.id!); setEdit(null); } catch (e) { setErr((e as Error).message); } } }}>삭제</button>}
            <span style={{ flex: 1 }} /><button onClick={() => setEdit(null)}>취소</button>
            <button className="primary" onClick={async () => { if (!edit.name) return; try { await savePatient(edit); setEdit(null); setErr(""); } catch (e) { setErr((e as Error).message); } }}>저장</button></div>{err && <p className="err">{err}</p>}
        </div></div>)}
    </>
  );
}

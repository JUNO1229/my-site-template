"use client";
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { canEditSickrooms, canViewSickrooms } from "@/lib/perm";
import { usage, type RoomState } from "@/lib/sickroom";
import { todayStr } from "@/lib/util";
import type { Sickroom } from "@/lib/types";
import { PageSkeleton } from "@/components/Ui";
import { useToast } from "@/lib/toast";

const blank: Sickroom = { roomNo: "", beds: 1, startDate: "", endDate: "", note: "" };
const PILL: Record<RoomState, string> = { 운영중: "ok", 시작전: "warn", 종료: "mut" };

export default function Sickrooms() {
  const { db, me, ready, saveSickroom, deleteSickroom } = useStore();
  const [edit, setEdit] = useState<{ r: Sickroom; isNew: boolean } | null>(null);
  const [only, setOnly] = useState<"" | "vacant" | "empty" | "ended">("");
  const [err, setErr] = useState("");
  const editable = canEditSickrooms(me);
  const { toast } = useToast();
  const today = todayStr();
  const rows = useMemo(() => usage(db.sickrooms, db.patients, today), [db.sickrooms, db.patients, today]);
  if (!ready) return <PageSkeleton />;
  if (!canViewSickrooms(me)) return <p className="err">병실관리는 치료실 담당자 계정에서는 사용할 수 없습니다.</p>;
  const active = rows.filter((x) => x.state === "운영중");
  const totals = { rooms: active.length, beds: active.reduce((a, x) => a + x.room.beds, 0), used: active.reduce((a, x) => a + Math.min(x.used, x.room.beds), 0) };
  const list = rows.filter((x) => only === "" || (only === "vacant" && x.state === "운영중" && x.vacant > 0) || (only === "empty" && x.state === "운영중" && x.used === 0) || (only === "ended" && x.state !== "운영중"));
  const set = (k: keyof Sickroom, v: string | number) => setEdit((e) => e && { ...e, r: { ...e.r, [k]: v } });
  const save = async () => { if (!edit) return; try { await saveSickroom(edit.r, edit.isNew); toast(edit.isNew ? "병실을 등록했습니다" : "병실 정보를 저장했습니다"); setEdit(null); setErr(""); } catch (e) { setErr((e as Error).message); } };
  const del = async () => { if (!edit || !confirm(`병실 ${edit.r.roomNo} 정보를 삭제합니다.`)) return; try { await deleteSickroom(edit.r.roomNo); toast("병실을 삭제했습니다"); setEdit(null); setErr(""); } catch (e) { setErr((e as Error).message); } };
  return (
    <>
      <div className="toolbar"><h2>병실관리</h2>
        <div className="seg">{([["", "전체"], ["vacant", "빈 병상 있음"], ["empty", "환자 없는 병실"], ["ended", "시작전·종료"]] as const).map(([k, t]) =>
          <button key={k} className={only === k ? "on" : ""} onClick={() => setOnly(k)}>{t}</button>)}</div>
        {editable && <button className="primary" onClick={() => { setErr(""); setEdit({ r: blank, isNew: true }); }}>+ 병실 등록</button>}</div>
      <div className="kpis">
        <div className="kpi"><b>{totals.rooms}</b>운영 병실</div><div className="kpi"><b>{totals.beds}</b>총 병상</div>
        <div className="kpi s-완료"><b>{totals.used}</b>입원</div><div className="kpi s-예약"><b>{Math.max(0, totals.beds - totals.used)}</b>빈 병상</div>
      </div>
      <p className="hint">입원 현황은 환자명부(자동 생성 환자 제외)의 병실과 병실번호(예: 207-2 → 207호)를 기준으로 계산합니다. 시작일·종료일이 비어 있으면 상시 운영으로 봅니다. 기준일: {today}</p>
      <div className="tblwrap">
        <table className="tbl compact"><thead><tr><th>병실</th><th>병상수</th><th>시작일</th><th>종료일</th><th>상태</th><th>입원</th><th>빈 병상</th><th>비고</th><th /></tr></thead>
          <tbody>{list.map(({ room, state, used, vacant }) => (
            <tr key={room.roomNo} className={state === "운영중" && used === 0 ? "vacant" : ""}>
              <td>{room.roomNo}</td><td>{room.beds}</td><td>{room.startDate}</td><td>{room.endDate}</td>
              <td><span className={`pill ${PILL[state]}`}>{state}</span></td>
              <td>{used}{used > room.beds && <span className="err"> (병상 초과)</span>}</td><td>{state === "운영중" ? vacant : ""}</td>
              <td className="long" title={room.note}>{room.note}</td>
              <td>{editable && <button onClick={() => { setErr(""); setEdit({ r: room, isNew: false }); }}>수정</button>}</td></tr>))}</tbody></table>
      </div>
      {edit && (
        <div className="overlay" onClick={() => setEdit(null)}><div className="modal" onClick={(e) => e.stopPropagation()}>
          <h3>{edit.isNew ? "병실 등록" : `병실 ${edit.r.roomNo} 수정`}</h3>
          <div className="row"><label>병실번호<input value={edit.r.roomNo} disabled={!edit.isNew} onChange={(e) => set("roomNo", e.target.value)} placeholder="예: 207" /></label>
            <label>병상수<input type="number" min={1} max={30} value={edit.r.beds} onChange={(e) => set("beds", Number(e.target.value))} /></label></div>
          <div className="row"><label>시작일<input type="date" value={edit.r.startDate} onChange={(e) => set("startDate", e.target.value)} /></label>
            <label>종료일<input type="date" value={edit.r.endDate} onChange={(e) => set("endDate", e.target.value)} /></label></div>
          <label>비고<input value={edit.r.note} onChange={(e) => set("note", e.target.value)} /></label>
          {err && <p className="err">{err}</p>}
          <div className="actions">{!edit.isNew && <button className="danger" onClick={del}>삭제</button>}<span style={{ flex: 1 }} />
            <button onClick={() => setEdit(null)}>취소</button><button className="primary" onClick={save}>저장</button></div>
        </div></div>)}
    </>
  );
}

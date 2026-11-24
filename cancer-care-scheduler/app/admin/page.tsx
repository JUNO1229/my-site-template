"use client";
import { useCallback, useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { ROLE_DESC, ROLE_LABEL, isAdmin, type Role } from "@/lib/perm";
import { api } from "@/lib/api";
import ImportPanel from "@/components/ImportPanel";
import { useToast } from "@/lib/toast";

interface U { id: number; username: string; name: string; role: Role; roomIds: string[]; active: boolean; mustChange: boolean; lastLogin: string | null; locked: boolean }
interface Log { ts: string; username: string | null; action: string; detail: string }
const ROLES = Object.keys(ROLE_LABEL) as Role[];
const fmt = (s: string | null) => (s ? new Date(s).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }) : "-");

export default function Admin() {
  const { me, db, refresh } = useStore();
  const [tab, setTab] = useState<"users" | "audit" | "data">("users");
  const [users, setUsers] = useState<U[]>([]); const [logs, setLogs] = useState<Log[]>([]);
  const [edit, setEdit] = useState<(Partial<U> & { password?: string; resetPassword?: string }) | null>(null);
  const [err, setErr] = useState(""); const [msg, setMsg] = useState("");
  const { toast } = useToast();
  const load = useCallback(() => {
    api<{ users: U[] }>("/api/users").then((r) => setUsers(r.users)).catch((e) => setErr(e.message));
    api<{ logs: Log[] }>("/api/audit").then((r) => setLogs(r.logs)).catch(() => {});
  }, []);
  useEffect(() => { if (isAdmin(me)) load(); }, [me, load]);
  if (!me) return <p>불러오는 중…</p>;
  if (!isAdmin(me)) return <p className="err">시스템관리자만 접근할 수 있습니다.</p>;

  const save = async () => {
    if (!edit) return; setErr("");
    try {
      if (edit.id) await api(`/api/users/${edit.id}`, "PUT", edit); else await api("/api/users", "POST", edit);
      toast(edit.id ? "계정 정보를 저장했습니다" : "계정을 발급했습니다"); setEdit(null); load();
    } catch (e) { setErr((e as Error).message); }
  };
  const purge = async () => {
    if (!confirm("스케줄 기록에서 자동 생성된 과거 환자와 그 환자의 스케줄을 모두 삭제합니다. 되돌릴 수 없습니다.")) return;
    try { const r = await api<{ deleted: number }>("/api/admin/data", "POST", { action: "purge_auto" }); await refresh(); setMsg(`자동 생성 환자 ${r.deleted}명과 스케줄을 삭제했습니다`); } catch (e) { setErr((e as Error).message); }
  };
  const data = async (action: "demo" | "clear") => {
    if (!confirm(action === "clear" ? "모든 환자와 스케줄을 삭제합니다. 되돌릴 수 없습니다." : "현재 환자·스케줄을 삭제하고 가상 데모 데이터로 교체합니다.")) return;
    try { await api("/api/admin/data", "POST", { action }); await refresh(); setMsg(action === "clear" ? "환자·스케줄을 모두 삭제했습니다" : "데모 데이터를 불러왔습니다"); } catch (e) { setErr((e as Error).message); }
  };
  const toggleRoom = (id: string) => setEdit((e) => e && { ...e, roomIds: e.roomIds?.includes(id) ? e.roomIds.filter((x) => x !== id) : [...(e.roomIds ?? []), id] });

  return (
    <>
      <div className="toolbar"><h2>계정·접속기록</h2>
        <div className="seg">{([["users", "계정 관리"], ["audit", "접속·변경 기록"], ["data", "데이터 가져오기·관리"]] as const).map(([k, t]) =>
          <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{t}</button>)}</div></div>
      {err && <p className="err">{err}</p>}{msg && <p className="ok">{msg}</p>}
      {tab === "users" && (<>
        <div className="toolbar"><button className="primary" onClick={() => setEdit({ role: "therapist", roomIds: [], active: true })}>+ 계정 발급</button>
          <span className="hint">{ROLES.map((r) => `${ROLE_LABEL[r]}: ${ROLE_DESC[r]}`).join("  |  ")}</span></div>
        <div className="tblwrap"><table className="tbl"><thead><tr><th>아이디</th><th>이름</th><th>권한</th><th>담당 치료실</th><th>상태</th><th>최근 로그인</th><th /></tr></thead>
          <tbody>{users.map((u) => (<tr key={u.id}><td>{u.username}</td><td>{u.name}</td><td>{ROLE_LABEL[u.role]}</td>
            <td>{u.role === "therapist" ? u.roomIds.map((id) => db.rooms.find((r) => r.id === id)?.name ?? id).join(", ") : "전체"}</td>
            <td>{!u.active ? "사용중지" : u.locked ? "잠김" : u.mustChange ? "비밀번호 변경 대기" : "정상"}</td><td>{fmt(u.lastLogin)}</td>
            <td><button onClick={() => setEdit({ ...u })}>수정</button></td></tr>))}</tbody></table></div></>)}
      {tab === "audit" && (
        <div className="tblwrap"><table className="tbl"><thead><tr><th>시각(KST)</th><th>사용자</th><th>작업</th><th>내용</th></tr></thead>
          <tbody>{logs.map((l, i) => (<tr key={i}><td>{fmt(l.ts)}</td><td>{l.username ?? "-"}</td><td>{l.action}</td><td>{l.detail}</td></tr>))}</tbody></table></div>)}
      {tab === "data" && (<><ImportPanel />
        <div className="card"><p>현재 환자명부와 스케줄은 <b>가상 데모 데이터</b>일 수 있습니다. 실제 운영 전에 삭제하고 시작하세요.</p>
          <div className="row"><button onClick={() => data("demo")}>데모 데이터로 교체</button><button onClick={purge}>명부에 없는 자동 생성 환자·스케줄 정리</button><button className="danger" onClick={() => data("clear")}>환자·스케줄 전체 삭제</button></div></div></>)}
      {edit && (
        <div className="overlay" onClick={() => setEdit(null)}><div className="modal" onClick={(e) => e.stopPropagation()}>
          <h3>{edit.id ? "계정 수정" : "계정 발급"}</h3>
          <div className="row"><label>아이디<input value={edit.username ?? ""} disabled={!!edit.id} onChange={(e) => setEdit({ ...edit, username: e.target.value })} /></label>
            <label>이름<input value={edit.name ?? ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></label></div>
          <label>권한<select value={edit.role} onChange={(e) => setEdit({ ...edit, role: e.target.value as Role })}>{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></label>
          {edit.role === "therapist" && <div className="chips">{db.rooms.map((r) => (
            <label key={r.id} className="chk"><input type="checkbox" checked={edit.roomIds?.includes(r.id) ?? false} onChange={() => toggleRoom(r.id)} />{r.name}</label>))}</div>}
          {edit.id
            ? <><label>비밀번호 재설정(입력 시 임시 비밀번호로 변경, 다음 로그인 때 변경 요구)<input type="text" value={edit.resetPassword ?? ""} onChange={(e) => setEdit({ ...edit, resetPassword: e.target.value })} placeholder="비워두면 변경 없음" /></label>
              <label className="chk"><input type="checkbox" checked={edit.active ?? true} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} />사용 중</label>
              {edit.locked && <button onClick={async () => { await api(`/api/users/${edit.id}`, "PUT", { unlock: true }); setEdit(null); load(); }}>잠금 해제</button>}</>
            : <label>임시 비밀번호 (8자 이상, 영문+숫자)<input type="text" value={edit.password ?? ""} onChange={(e) => setEdit({ ...edit, password: e.target.value })} /></label>}
          {err && <p className="err">{err}</p>}
          <div className="actions"><span style={{ flex: 1 }} /><button onClick={() => setEdit(null)}>취소</button><button className="primary" onClick={save}>저장</button></div>
        </div></div>)}
    </>
  );
}

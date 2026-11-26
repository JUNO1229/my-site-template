"use client";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { ROLE_LABEL, isAdmin, roleLabel, type Role } from "@/lib/perm";
import { menuFor } from "@/lib/menu";
import { api } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { Icon } from "@/components/Icons";

interface U { id: number; username: string; name: string; role: Role; roomIds: string[]; allRooms?: boolean; active: boolean; mustChange: boolean; lastLogin: string | null }
const fmt = (s: string | null) => (s ? new Date(s).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "short", timeStyle: "short" }) : "접속 이력 없음");
const ROLES: Role[] = ["admin", "manager", "therapist", "viewer"];
const MATRIX: [string, Partial<Record<Role, string>>][] = [
  ["환자명부·이전환자명부 열람", { admin: "✓", manager: "✓", therapist: "✓", viewer: "✓" }],
  ["계약금액 열람", { admin: "✓", manager: "✓" }],
  ["환자 등록·수정", { admin: "✓", manager: "✓" }],
  ["환자 삭제·데이터 가져오기·백업 복원", { admin: "✓" }],
  ["스케줄 등록·수정·삭제", { admin: "✓", manager: "✓", therapist: "배정 치료실만 (총괄 담당자는 전체)" }],
  ["중복·정원 초과 예외 등록", { admin: "✓", manager: "✓", therapist: "총괄 담당자만" }],
  ["모니터링·월간·캘린더·기간별 리스트 열람", { admin: "✓", manager: "✓", therapist: "✓", viewer: "✓" }],
  ["병실관리 열람", { admin: "✓", manager: "✓", viewer: "✓" }],
  ["병실 수정", { admin: "✓", manager: "✓" }],
  ["치료실 설정·계정·접속기록", { admin: "✓" }],
];

export default function DevMon() {
  const { me, db } = useStore(); const { toast } = useToast();
  const [users, setUsers] = useState<U[]>([]); const [rw, setRw] = useState(false); const [busy, setBusy] = useState("");
  useEffect(() => { if (isAdmin(me) && !me?.viewAs) api<{ users: U[] }>("/api/users").then((r) => setUsers(r.users)).catch((e) => toast(e.message, "err")); }, [me]); // eslint-disable-line
  if (!isAdmin(me)) return <div className="card"><p>시스템관리자만 사용할 수 있는 화면입니다.</p></div>;
  const go = async (u: U, href: string) => {
    setBusy(u.username + href);
    try { await api("/api/admin/viewas", "POST", { username: u.username, rw }); location.href = href; }
    catch (e) { toast((e as Error).message, "err"); setBusy(""); }
  };
  const rooms = (u: U) => u.role === "therapist" ? (u.allRooms ? `전체 치료실 관리 (담당 ${u.roomIds.map((id) => db.rooms.find((r) => r.id === id)?.name ?? id).join(", ") || "없음"})` : u.roomIds.map((id) => db.rooms.find((r) => r.id === id)?.name ?? id).join(", ") || "담당 치료실 없음") : "전체 치료실";
  return (
    <div className="devmon">
      <div className="toolbar"><h2>사용자 화면 점검</h2>
        <span className="hint">계정을 골라 그 사용자의 권한·화면으로 바로 이동해 확인합니다. 로그아웃 없이 관리자 로그인이 유지됩니다.</span></div>
      <div className="card" style={{ marginBottom: 14 }}>
        <label className="chk"><input type="checkbox" checked={rw} onChange={(e) => setRw(e.target.checked)} />저장 허용 (테스트용 — 켜면 그 사용자 권한으로 등록·수정이 실제 데이터에 반영됩니다)</label>
        <p className="hint" style={{ margin: "6px 0 0" }}>기본은 읽기 전용이라 어떤 화면을 눌러도 데이터가 바뀌지 않습니다. 점검 중에는 화면 상단에 주황색 바가 표시되고, 거기서 종료할 수 있습니다.</p>
      </div>
      <div className="ulist">
        {users.map((u) => {
          const self = u.id === me?.id; const links = menuFor(u.role);
          return (
            <div key={u.id} className="ucard">
              <div className="uhead"><b>{u.name}</b><small>{u.username}</small><span className="tag">{roleLabel(u)}</span><span className="tag">{rooms(u)}</span>
                {!u.active && <span className="tag off">사용 중지</span>}{u.mustChange && <span className="tag warn">초기 비밀번호 미변경</span>}
                <span className="grow" /><small>최근 접속 {fmt(u.lastLogin)}</small></div>
              {self ? <small>현재 로그인한 본인 계정입니다.</small> : u.role === "admin" ? <small>시스템관리자 계정은 전체 권한이라 점검 대상이 아닙니다.</small> : !u.active ? <small>사용 중지된 계정은 점검할 수 없습니다.</small> : (
                <div className="gochips"><button className="cta" style={{ padding: "6px 16px", width: "auto", flex: "none", whiteSpace: "nowrap" }} disabled={!!busy} onClick={() => go(u, "/")}><Icon name="eye" size={16} /> 이 사용자 화면으로 보기</button>
                  {links.map((m) => <button key={m.href} disabled={!!busy} onClick={() => go(u, m.href)}>{m.label}</button>)}</div>)}
            </div>);
        })}
      </div>
      <div className="sec2">권한별 기능 일람</div>
      <div className="tblwrap"><table className="matrix"><thead><tr><th>기능</th>{ROLES.map((r) => <th key={r}>{ROLE_LABEL[r]}</th>)}</tr></thead>
        <tbody>{MATRIX.map(([f, m]) => <tr key={f}><td>{f}</td>{ROLES.map((r) => <td key={r} className={m[r] ? "ok" : "no"}>{m[r] ?? "—"}</td>)}</tr>)}</tbody></table></div>
    </div>
  );
}

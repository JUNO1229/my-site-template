"use client";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { ROLE_DESC, ROLE_LABEL } from "@/lib/perm";
import { api } from "@/lib/api";

export default function Account() {
  const { me, db, refresh } = useStore();
  const [cur, setCur] = useState(""); const [nw, setNw] = useState(""); const [nw2, setNw2] = useState("");
  const [msg, setMsg] = useState(""); const [err, setErr] = useState("");
  if (!me) return <p>불러오는 중…</p>;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(""); setMsg("");
    if (nw !== nw2) return setErr("새 비밀번호가 서로 다릅니다");
    try { await api("/api/auth/password", "POST", { current: cur, next: nw }); setMsg("비밀번호가 변경되었습니다"); setCur(""); setNw(""); setNw2(""); await refresh(); if (me.mustChange) location.href = "/"; }
    catch (x) { setErr((x as Error).message); }
  };
  return (
    <div style={{ maxWidth: 480 }}>
      <h2>내 계정</h2>
      <div className="card"><div><b>{me.name}</b> ({me.username})</div><div>{ROLE_LABEL[me.role]} — <span className="hint">{ROLE_DESC[me.role]}</span></div>
        {me.role === "therapist" && <div className="hint">담당: {me.roomIds.map((id) => db.rooms.find((r) => r.id === id)?.name ?? id).join(", ")}</div>}</div>
      {me.mustChange && <p className="err">보안을 위해 처음 로그인 시 비밀번호를 변경해야 합니다.</p>}
      <form className="card" onSubmit={submit}><h3 style={{ margin: 0 }}>비밀번호 변경</h3>
        <label>현재 비밀번호<input type="password" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" required /></label>
        <label>새 비밀번호 (8자 이상, 영문+숫자)<input type="password" value={nw} onChange={(e) => setNw(e.target.value)} autoComplete="new-password" required /></label>
        <label>새 비밀번호 확인<input type="password" value={nw2} onChange={(e) => setNw2(e.target.value)} autoComplete="new-password" required /></label>
        {err && <p className="err">{err}</p>}{msg && <p className="ok">{msg}</p>}
        <button className="primary">변경</button></form>
    </div>
  );
}

"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import { Icon } from "@/components/Icons";

export default function Login() {
  const [u, setU] = useState(""); const [pw, setPw] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr("");
    try { const r = await api<{ mustChange: boolean }>("/api/auth/login", "POST", { username: u, password: pw }); location.href = r.mustChange ? "/account" : "/"; }
    catch (x) { setErr((x as Error).message); setBusy(false); }
  };
  return (
    <div className="login-wrap">
      <form className="login" onSubmit={submit}>
        <span className="logo"><Icon name="activity" size={28} /></span>
        <h2>암센터 치료관리</h2><p className="hint">계정으로 로그인해 주세요. 계정은 시스템관리자가 발급합니다.</p>
        <label>아이디<input value={u} onChange={(e) => setU(e.target.value)} autoComplete="username" autoFocus required /></label>
        <label>비밀번호<input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" required /></label>
        {err && <p className="err"><Icon name="alert" size={16} />{err}</p>}
        <button className="cta" disabled={busy}>{busy ? "확인 중…" : "로그인"}</button>
      </form>
    </div>
  );
}

"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useStore } from "@/lib/store";
import { ROLE_LABEL, isAdmin } from "@/lib/perm";
import { api } from "@/lib/api";

export default function Nav() {
  const p = usePathname(); const { me } = useStore();
  if (p.startsWith("/login")) return null;
  const tabs = [["/", "통합 모니터링"], ["/rooms", "치료실별 스케줄"], ["/patients", "환자명부"], ["/calendar", "캘린더"], ["/list", "기간별 리스트"],
    ...(isAdmin(me) ? [["/settings", "치료실 설정"], ["/admin", "계정·접속기록"]] : [])];
  const logout = async () => { await api("/api/auth/logout", "POST").catch(() => {}); location.href = "/login"; };
  return (
    <header className="nav">
      <div className="brand">암센터 치료관리</div>
      <nav>{tabs.map(([h, t]) => (
        <Link key={h} href={h} className={(h === "/" ? p === "/" : p.startsWith(h)) ? "on" : ""}>{t}</Link>))}</nav>
      <span style={{ flex: 1 }} />
      {me && <div className="who"><Link href="/account">{me.name} · {ROLE_LABEL[me.role]}</Link><button onClick={logout}>로그아웃</button></div>}
    </header>
  );
}

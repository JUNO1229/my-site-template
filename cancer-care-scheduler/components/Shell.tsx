"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "./Icons";
import { Avatar } from "./Ui";
import { useStore, useAppts } from "@/lib/store";
import { useUi, useNow } from "@/lib/ui";
import { ROLE_LABEL, canViewSickrooms, isAdmin } from "@/lib/perm";
import { api } from "@/lib/api";
import { findConflicts, label, toMin, todayStr } from "@/lib/util";

export default function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname(); const router = useRouter();
  const { me, db, ready } = useStore(); const { openAppt, theme, toggleTheme } = useUi();
  const [drawer, setDrawer] = useState(false); const [bell, setBell] = useState(false);
  const search = useRef<HTMLInputElement>(null); const bellRef = useRef<HTMLDivElement>(null);
  const today = todayStr(); const now = useNow(); const nowMin = now.getHours() * 60 + now.getMinutes();
  const appts = useAppts(today, today);
  const canNew = !!me && me.role !== "viewer";
  useEffect(() => setDrawer(false), [path]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement; const typing = /INPUT|SELECT|TEXTAREA/.test(t.tagName);
      if (e.key === "/" && !typing) { e.preventDefault(); search.current?.focus(); }
      else if (e.key.toLowerCase() === "n" && !typing && canNew && !e.metaKey && !e.ctrlKey) { e.preventDefault(); openAppt({ date: todayStr() }); }
      else if (e.key === "Escape") { setDrawer(false); setBell(false); }
    };
    const click = (e: MouseEvent) => { if (bell && !bellRef.current?.contains(e.target as Node)) setBell(false); };
    document.addEventListener("keydown", k); document.addEventListener("mousedown", click);
    return () => { document.removeEventListener("keydown", k); document.removeEventListener("mousedown", click); };
  }, [canNew, openAppt, bell]);

  const alerts = useMemo(() => {
    const dur = (id: string) => db.items.find((i) => i.id === id)?.duration ?? 50;
    const unhandled = appts.filter((a) => a.status === "예약" && toMin(a.time) + dur(a.itemId) <= nowMin).length;
    const left = appts.filter((a) => a.status === "예약" && toMin(a.time) + dur(a.itemId) > nowMin).length;
    const conflicts = new Set(findConflicts(appts, db.items).keys()).size;
    return { unhandled, left, conflicts, total: unhandled + conflicts };
  }, [appts, db.items, nowMin]);

  if (path.startsWith("/login")) return <>{children}</>;
  const menu: [string, string, string][] = [
    ["/patients", "환자명부", "users"], ["/", "통합 모니터링", "activity"], ["/rooms", "치료실별 스케줄", "grid"], ["/calendar", "캘린더", "calendar"], ["/list", "기간별 리스트", "list"],
    ...(isAdmin(me) ? [["/settings", "치료실 설정", "sliders"] as [string, string, string]] : []),
    ...(canViewSickrooms(me) ? [["/sickrooms", "병실관리", "bed"] as [string, string, string]] : []),
    ...(isAdmin(me) ? [["/admin", "계정·접속기록", "shield"] as [string, string, string]] : []),
  ];
  const tabs: [string, string, string][] = [["/patients", "환자명부", "users"], ["/", "모니터링", "activity"], ["/rooms", "치료실", "grid"], ["/calendar", "캘린더", "calendar"]];
  const on = (h: string) => (h === "/" ? path === "/" : path.startsWith(h));
  const logout = async () => { await api("/api/auth/logout", "POST").catch(() => {}); location.href = "/login"; };
  const submitSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const q = (new FormData(e.currentTarget).get("q") as string).trim();
    router.push(`/patients${q ? `?q=${encodeURIComponent(q)}` : ""}`); setTimeout(() => window.dispatchEvent(new CustomEvent("global-search", { detail: q })), 50);
  };
  const Item = ({ h, t, ic }: { h: string; t: string; ic: string }) => (
    <Link href={h} className={`nav-item ${on(h) ? "on" : ""}`} aria-current={on(h) ? "page" : undefined}><Icon name={ic} filled={false} /><span>{t}</span></Link>);

  return (
    <div className="shell">
      <div className={`scrim ${drawer ? "show" : ""}`} onClick={() => setDrawer(false)} />
      <aside className={`sidebar ${drawer ? "open" : ""}`} aria-label="주 메뉴">
        <div className="brand"><span className="logo" aria-hidden="true"><Icon name="activity" size={20} /></span><div><b>ResHub-C(리즈허브-C)</b><small>무등산생태요양병원</small></div></div>
        {canNew && <button className="cta side-cta" onClick={() => openAppt({ date: todayStr() })}><Icon name="plus" size={18} />스케줄 등록<kbd>N</kbd></button>}
        <nav>{menu.map(([h, t, ic]) => <Item key={h} h={h} t={t} ic={ic} />)}</nav>
        <div className="side-foot">
          {me && <div className="usercard"><Avatar name={me.name} size={40} /><div><b>{me.name}</b><small>{ROLE_LABEL[me.role]}</small></div></div>}
          <div className="side-actions">
            <button className="btn-soft" onClick={toggleTheme} aria-label="테마 전환"><Icon name={theme === "dark" ? "sun" : "moon"} size={18} />{theme === "dark" ? "라이트" : "다크"}</button>
            <button className="btn-soft" onClick={logout}><Icon name="logout" size={18} />로그아웃</button>
          </div>
        </div>
      </aside>

      <div className="main-col">
        <header className="topbar">
          <button className="icon-btn menu-btn" aria-label="메뉴 열기" onClick={() => setDrawer(true)}><Icon name="menu" /></button>
          <Link href="/account" className="greet" aria-label="내 계정">
            {me && <Avatar name={me.name} size={40} />}
            <div><b>안녕하세요, {me?.name ?? ""}님</b><small>{me ? ROLE_LABEL[me.role] : ""} · {label(today)}</small></div>
          </Link>
          <form className="searchbar" onSubmit={submitSearch} role="search">
            <Icon name="search" size={18} /><input ref={search} name="q" placeholder="환자 이름·차트번호 검색" aria-label="환자 검색" autoComplete="off" /><kbd>/</kbd>
          </form>
          <button className="icon-btn theme-btn" onClick={toggleTheme} aria-label="테마 전환"><Icon name={theme === "dark" ? "sun" : "moon"} /></button>
          <div className="popwrap" ref={bellRef}>
            <button className="icon-btn bellbtn" aria-label={`알림 ${alerts.total}건`} aria-expanded={bell} onClick={() => setBell((b) => !b)}>
              <Icon name="bell" />{alerts.total > 0 && <span className="badge-dot">{alerts.total > 9 ? "9+" : alerts.total}</span>}
            </button>
            {bell && <div className="popmenu bellmenu" role="dialog" aria-label="알림">
              <h4>오늘의 알림</h4>
              <Link href="/" onClick={() => setBell(false)}><Icon name="clock" size={18} /><div><b>남은 예약 {alerts.left}건</b><small>오늘 아직 진행하지 않은 치료</small></div></Link>
              <Link href="/" onClick={() => setBell(false)} className={alerts.unhandled ? "alert" : ""}><Icon name="alert" size={18} /><div><b>처리 안 된 예약 {alerts.unhandled}건</b><small>시간이 지났지만 완료/취소 처리가 없음</small></div></Link>
              <Link href="/" onClick={() => setBell(false)} className={alerts.conflicts ? "alert" : ""}><Icon name="alert" size={18} /><div><b>일정 충돌 {alerts.conflicts}건</b><small>동시 수용 인원 초과 · 환자 시간 겹침</small></div></Link>
            </div>}
          </div>
        </header>
        <main id="main">{ready || path === "/account" ? children : children}</main>
      </div>

      <nav className="tabbar" aria-label="하단 메뉴">
        {tabs.slice(0, 2).map(([h, t, ic]) => <Link key={h} href={h} className={`tab ${on(h) ? "on" : ""}`}><Icon name={ic} filled={on(h)} /><span>{t}</span></Link>)}
        {canNew ? <button className="fab" aria-label="스케줄 등록" onClick={() => openAppt({ date: todayStr() })}><Icon name="plus" size={26} /></button> : <span className="fab-gap" />}
        {tabs.slice(2).map(([h, t, ic]) => <Link key={h} href={h} className={`tab ${on(h) ? "on" : ""}`}><Icon name={ic} filled={on(h)} /><span>{t}</span></Link>)}
      </nav>
    </div>
  );
}

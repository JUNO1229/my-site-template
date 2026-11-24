"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icons";
import CalendarPopup from "@/components/CalendarPopup";
import { CountUp, PageSkeleton } from "@/components/Ui";
import { useAppts, useStore } from "@/lib/store";
import { useUi } from "@/lib/ui";
import { addDays, dow, mondayOf, parse, pad, todayStr, toMin, ymd } from "@/lib/util";
import type { Appt, Status } from "@/lib/types";

type View = "all" | Status;
interface Agg { res: number; done: number; canc: number }
const short = (n: string) => n.replace(/치료실$/, "");
const md = (d: string) => `${Number(d.slice(5, 7))}월 ${Number(d.slice(8))}일(${dow(d)})`;
const add = (a: Agg | undefined, s: Status): Agg => { const x = a ?? { res: 0, done: 0, canc: 0 }; if (s === "예약") x.res++; else if (s === "완료") x.done++; else x.canc++; return x; };
const countOf = (a: Agg | undefined, v: View) => (!a ? 0 : v === "all" ? a.res + a.done : v === "예약" ? a.res : v === "완료" ? a.done : a.canc);

export default function Monthly() {
  const { db, ready } = useStore(); const { openAppt } = useUi(); const router = useRouter();
  const [ym, setYm] = useState(todayStr().slice(0, 7));
  const [view, setView] = useState<View>("all");
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [weekend, setWeekend] = useState<boolean | null>(null);
  const [heat, setHeat] = useState(true);
  const [sel, setSel] = useState<string | null>(null);
  const picker = useRef<HTMLButtonElement>(null); const [pickOpen, setPickOpen] = useState(false);
  const today = todayStr();

  const first = parse(`${ym}-01`); const [y, m] = ym.split("-").map(Number);
  const lastDay = ymd(new Date(y, m, 0));
  const gridStart = mondayOf(ymd(first)); const gridEnd = addDays(mondayOf(lastDay), 6);
  const nDays = Math.round((parse(gridEnd).getTime() - parse(gridStart).getTime()) / 864e5) + 1;
  const appts = useAppts(gridStart, gridEnd);
  const shift = (n: number) => { const d = new Date(y, m - 1 + n, 1); setYm(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`); setSel(null); };
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement; if (/INPUT|SELECT|TEXTAREA/.test(t.tagName) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowLeft") shift(-1); else if (e.key === "ArrowRight") shift(1); else if (e.key.toLowerCase() === "t") { setYm(todayStr().slice(0, 7)); setSel(null); }
    };
    document.addEventListener("keydown", k); return () => document.removeEventListener("keydown", k);
  }); // eslint-disable-line

  const rooms = db.rooms.filter((r) => r.active);
  const roomOfItem = useMemo(() => new Map(db.items.map((i) => [i.id, i.roomId])), [db.items]);
  const { byDay, month, perRoom } = useMemo(() => {
    const ok = new Set(rooms.map((r) => r.id)); const byDay = new Map<string, Map<string, Agg>>();
    const month: Agg = { res: 0, done: 0, canc: 0 }; const perRoom = new Map<string, Agg>();
    for (const a of appts) {
      const rid = roomOfItem.get(a.itemId); if (!rid || !ok.has(rid)) continue;
      if (a.date.startsWith(ym)) { add(month, a.status); perRoom.set(rid, add(perRoom.get(rid), a.status)); }
      if (hidden.has(rid)) continue;
      const dm = byDay.get(a.date) ?? new Map<string, Agg>(); dm.set(rid, add(dm.get(rid), a.status)); byDay.set(a.date, dm);
    }
    return { byDay, month, perRoom };
  }, [appts, rooms, roomOfItem, hidden, ym]); // eslint-disable-line
  if (!ready) return <PageSkeleton />;

  const days = Array.from({ length: nDays }, (_, i) => addDays(gridStart, i));
  const hasWeekend = days.some((d) => d.startsWith(ym) && ["토", "일"].includes(dow(d)) && [...(byDay.get(d)?.values() ?? [])].some((a) => a.res + a.done > 0));
  const showWeekend = weekend ?? hasWeekend;
  const shown = days.filter((d) => showWeekend || !["토", "일"].includes(dow(d)));
  const cols = showWeekend ? 7 : 5;
  const dayTotal = (d: string) => [...(byDay.get(d)?.values() ?? [])].reduce((s, a) => s + countOf(a, view), 0);
  const maxTotal = Math.max(1, ...days.filter((d) => d.startsWith(ym)).map(dayTotal));
  const monthLive = month.res + month.done; const workDays = days.filter((d) => d.startsWith(ym) && dayTotal(d) > 0).length;
  const toggleRoom = (id: string) => setHidden((h) => { const n = new Set(h); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <div className="mpage">
      <div className="toolbar">
        <h2>월간 치료현황</h2>
        <div className="mnav">
          <button className="icon-btn" aria-label="이전 달" onClick={() => shift(-1)}><Icon name="left" /></button>
          <b className="mtitle">{y}년 {m}월</b>
          <button className="icon-btn" aria-label="다음 달" onClick={() => shift(1)}><Icon name="right" /></button>
          {ym !== today.slice(0, 7) && <button className="btn-soft" onClick={() => { setYm(today.slice(0, 7)); setSel(null); }}>이번 달</button>}
          <button ref={picker} className="icon-btn" aria-label="월 선택" aria-haspopup="dialog" aria-expanded={pickOpen} onClick={() => setPickOpen((o) => !o)}><Icon name="calendar" /></button>
          {pickOpen && <CalendarPopup anchor={picker.current} mode="month" value={ym} onPick={(v) => { setYm(v); setSel(null); }} onClose={() => setPickOpen(false)} />}
        </div>
        <span className="spacer" />
        <div className="seg" role="tablist">{([["all", "전체"], ["예약", "예약"], ["완료", "완료"], ["취소", "취소"]] as const).map(([k, t]) =>
          <button key={k} className={view === k ? "on" : ""} role="tab" aria-selected={view === k} onClick={() => setView(k)}>{t}</button>)}</div>
        <label className="chk"><input type="checkbox" checked={showWeekend} onChange={(e) => setWeekend(e.target.checked)} />주말 표시</label>
        <label className="chk"><input type="checkbox" checked={heat} onChange={(e) => setHeat(e.target.checked)} />혼잡도</label>
        <button className="btn-soft no-print" onClick={() => window.print()}>인쇄</button>
      </div>

      <div className="kpis">
        <div className="kpi"><b><CountUp value={monthLive} /></b>월 전체 치료</div>
        <div className="kpi s-완료"><b><CountUp value={month.done} /></b>완료</div>
        <div className="kpi s-예약"><b><CountUp value={month.res} /></b>예약</div>
        <div className="kpi s-취소"><b><CountUp value={month.canc} /></b>취소</div>
        <div className="kpi"><b><CountUp value={workDays ? Math.round(monthLive / workDays) : 0} /></b>일 평균</div>
      </div>
      <div className="mlegend chips" aria-label="치료실 필터(눌러서 표시/숨김)">
        {rooms.map((r) => { const n = perRoom.get(r.id); const c = n ? n.res + n.done : 0; const off = hidden.has(r.id);
          return <button key={r.id} className={`chip rchip ${off ? "off" : "on"}`} aria-pressed={!off} onClick={() => toggleRoom(r.id)}><i className="rdot" style={{ background: r.color }} />{short(r.name)}<b>{c}</b></button>; })}
      </div>

      <div className="mcal" style={{ ["--cols" as string]: cols }}>
        {shown.slice(0, cols).map((d) => <div key={d} className={`mdh ${dow(d) === "일" ? "sun" : dow(d) === "토" ? "sat" : ""}`}>{dow(d)}</div>)}
        {shown.map((d, i) => {
          const inMonth = d.startsWith(ym); const dm = byDay.get(d); const tot = dayTotal(d);
          const rows = inMonth ? rooms.filter((r) => countOf(dm?.get(r.id), view) > 0) : [];
          return (
            <div key={d} className={`mday ${inMonth ? "" : "out"} ${d === today ? "today" : ""} ${d === sel ? "sel" : ""}`} role={inMonth ? "button" : undefined} tabIndex={inMonth ? 0 : -1}
              style={{ ["--h" as string]: heat && inMonth ? (tot / maxTotal) * 0.24 : 0, animationDelay: `${Math.min(i, 20) * 18}ms` }}
              aria-label={`${md(d)} ${tot}건`} onClick={() => inMonth && setSel(d)} onKeyDown={(e) => { if (inMonth && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); setSel(d); } }}>
              <div className="mtop"><span className="mnum">{Number(d.slice(8))}</span>{inMonth && tot > 0 && <span className="mtot">{tot}건</span>}</div>
              {rows.map((r) => { const a = dm!.get(r.id)!; const n = countOf(a, view); const live = a.res + a.done; const pct = live ? (a.done / live) * 100 : 0;
                return (
                  <div key={r.id} className="mrow" title={`${r.name} ${n}건 (완료 ${a.done} / 예약 ${a.res} / 취소 ${a.canc})`}>
                    <i className="rdot" style={{ background: r.color }} /><span className="nm">{short(r.name)}</span><b>{n}</b>
                    {view === "all" && <span className="mbar"><i style={{ width: `${pct}%`, background: r.color }} /></span>}
                  </div>); })}
              {rows.length > 0 && <div className="mdots" aria-hidden="true">{rows.map((r) => <i key={r.id} className="rdot" style={{ background: r.color }} />)}</div>}
            </div>);
        })}
      </div>
      <p className="hint no-print">날짜를 누르면 치료실별 상세 일정이 열립니다. 막대는 완료 비율, 진한 칸일수록 치료가 많은 날입니다. ←/→ 키로 달을 이동합니다.</p>
      {sel && <DayDrawer date={sel} appts={appts.filter((a) => a.date === sel)} hidden={hidden} onClose={() => setSel(null)} onGo={() => router.push(`/?date=${sel}`)} onNew={() => openAppt({ date: sel })} />}
    </div>
  );
}

function DayDrawer({ date, appts, hidden, onClose, onGo, onNew }: { date: string; appts: Appt[]; hidden: Set<string>; onClose: () => void; onGo: () => void; onNew: () => void }) {
  const { db, me } = useStore(); const { openAppt } = useUi();
  const [closing, setClosing] = useState(false);
  const close = () => { setClosing(true); setTimeout(onClose, 200); };
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape" && !document.querySelector(".overlay:not(.drawer-wrap)")) close(); }; document.addEventListener("keydown", k); return () => document.removeEventListener("keydown", k); }); // eslint-disable-line
  const itemOf = (id: string) => db.items.find((i) => i.id === id);
  const rooms = db.rooms.filter((r) => r.active && !hidden.has(r.id));
  const sorted = [...appts].sort((a, b) => toMin(a.time) - toMin(b.time));
  const cnt = (s: string) => sorted.filter((a) => a.status === s).length;
  const canNew = !!me && me.role !== "viewer";
  return (
    <div className={`overlay drawer-wrap ${closing ? "out" : ""}`} onClick={close}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={`${md(date)} 치료 현황`} onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head"><div className="grow"><h3>{md(date)}</h3>
          <div className="kpis" style={{ margin: 0 }}><div className="kpi s-예약"><b>{cnt("예약")}</b>예약</div><div className="kpi s-완료"><b>{cnt("완료")}</b>완료</div><div className="kpi s-취소"><b>{cnt("취소")}</b>취소</div></div></div>
          <button className="icon-btn" aria-label="닫기" onClick={close}><Icon name="x" /></button></div>
        <div className="drawer-body">
          {rooms.map((r) => {
            const list = sorted.filter((a) => itemOf(a.itemId)?.roomId === r.id); if (!list.length) return null;
            const live = list.filter((a) => a.status !== "취소"); const done = list.filter((a) => a.status === "완료").length;
            return (
              <div className="dsec" key={r.id}>
                <h4><i className="rdot" style={{ background: r.color }} />{r.name}<small>{r.therapist} · 완료 {done}/{live.length}</small></h4>
                <div className="hlist">{list.map((a) => { const p = db.patients.find((x) => x.id === a.patientId); return (
                  <div key={a.id} className="hrow clickable" role="button" tabIndex={0} onClick={() => openAppt(a)} onKeyDown={(e) => { if (e.key === "Enter") openAppt(a); }}>
                    <span className="hdate">{a.time}</span>
                    <div className="grow"><b>{p?.name ?? "?"}</b><small>{itemOf(a.itemId)?.name}{a.option && ` · ${a.option}`}</small></div>
                    <span className={`pill st-${a.status}`}>{a.status === "완료" && <Icon name="check" size={12} />}{a.status}</span></div>); })}</div>
              </div>);
          })}
          {sorted.length === 0 && <p className="empty">이 날의 치료 일정이 없습니다</p>}
        </div>
        <div className="drawer-foot"><button className="btn-soft" onClick={onGo}><Icon name="activity" size={16} />이 날짜 모니터링</button><span style={{ flex: 1 }} />
          {canNew && <button className="primary" onClick={onNew}><Icon name="plus" size={16} />스케줄 등록</button>}</div>
      </aside>
    </div>
  );
}

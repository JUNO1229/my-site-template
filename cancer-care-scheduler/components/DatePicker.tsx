"use client";
import { useEffect, useRef } from "react";
import { Icon } from "./Icons";
import { addDays, dow, mondayOf, todayStr } from "@/lib/util";

/** C07 가로 데이트 피커 — 선택일만 그라데이션, 좌우 스와이프/←→ 키로 이동 */
export default function DatePicker({ date, setDate }: { date: string; setDate: (d: string) => void }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(mondayOf(date), i));
  const today = todayStr(); const sx = useRef(0); const inp = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement; if (/INPUT|SELECT|TEXTAREA/.test(t.tagName) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowLeft") setDate(addDays(date, -1)); else if (e.key === "ArrowRight") setDate(addDays(date, 1)); else if (e.key.toLowerCase() === "t") setDate(todayStr());
    };
    document.addEventListener("keydown", k); return () => document.removeEventListener("keydown", k);
  }, [date, setDate]);
  const [y, m] = date.split("-");
  return (
    <div className="dp" onTouchStart={(e) => { sx.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => { const dx = e.changedTouches[0].clientX - sx.current; if (Math.abs(dx) > 50) setDate(addDays(date, dx < 0 ? 7 : -7)); }}>
      <div className="dp-head">
        <div className="dp-title"><b>{y}년 {Number(m)}월</b><span>{Number(date.slice(8))}일 ({dow(date)})</span></div>
        <div className="dp-actions">
          <button className="icon-btn" aria-label="이전 주" onClick={() => setDate(addDays(date, -7))}><Icon name="left" /></button>
          <button className="icon-btn" aria-label="다음 주" onClick={() => setDate(addDays(date, 7))}><Icon name="right" /></button>
          {date !== today && <button className="btn-soft" onClick={() => setDate(today)}>오늘</button>}
          <span className="datepop"><button className="icon-btn" aria-label="날짜 선택" onClick={() => inp.current?.showPicker?.()}><Icon name="calendar" /></button>
            <input ref={inp} type="date" tabIndex={-1} aria-hidden="true" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} /></span>
        </div>
      </div>
      <div className="dp-row" role="group" aria-label="주간 날짜">
        {days.map((d) => (
          <button key={d} className={`dcell ${d === date ? "sel" : ""} ${d === today ? "today" : ""}`} aria-pressed={d === date} aria-label={`${d} ${dow(d)}요일`} onClick={() => setDate(d)}>
            <span className="dw">{dow(d)}</span><span className="dn">{Number(d.slice(8))}</span>{d === date && <Icon name="check" size={11} className="dchk" />}
          </button>))}
      </div>
    </div>
  );
}

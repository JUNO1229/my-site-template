"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icons";
import { addDays, dow, mondayOf, pad, parse, todayStr, ymd } from "@/lib/util";

const W = 304;
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const WEEK = ["월", "화", "수", "목", "금", "토", "일"];

interface Props {
  anchor: HTMLElement | null;
  value: string;              // day: YYYY-MM-DD, month: YYYY-MM (비어 있으면 오늘 기준)
  mode?: "day" | "month";
  allowClear?: boolean;
  onPick: (v: string) => void;
  onClear?: () => void;
  onClose: () => void;
}

/** 시스템 스타일 달력 팝업 — 브라우저 기본 달력 대신 사용 (월 이동, 월/연도 선택, 오늘, 지우기, 키보드 조작) */
export default function CalendarPopup({ anchor, value, mode = "day", allowClear, onPick, onClear, onClose }: Props) {
  const today = todayStr();
  const base = mode === "month" ? (value ? `${value}-01` : today) : value || today;
  const [ym, setYm] = useState(base.slice(0, 7));
  const [view, setView] = useState<"day" | "month">(mode);
  const [focus, setFocus] = useState(mode === "day" ? base : "");
  const [dir, setDir] = useState(0);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [sheet, setSheet] = useState(false);
  const [closing, setClosing] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => { setClosing(true); setTimeout(onClose, 130); }, [onClose]);

  const place = useCallback(() => {
    const mobile = window.innerWidth <= 700; setSheet(mobile);
    if (!anchor || mobile) return;
    const r = anchor.getBoundingClientRect(); const h = ref.current?.offsetHeight ?? 380;
    const left = Math.min(Math.max(8, r.left), window.innerWidth - W - 8);
    let top = r.bottom + 6; if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 6);
    setPos({ left, top });
  }, [anchor]);
  useLayoutEffect(() => { place(); }, [place, view, ym]);
  useEffect(() => {
    const onScroll = () => place();
    window.addEventListener("resize", onScroll); window.addEventListener("scroll", onScroll, true);
    const down = (e: MouseEvent) => { const t = e.target as Node; if (!ref.current?.contains(t) && !anchor?.contains(t)) close(); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); e.preventDefault(); close(); anchor?.focus(); } };
    document.addEventListener("mousedown", down); document.addEventListener("keydown", key, true);
    return () => { window.removeEventListener("resize", onScroll); window.removeEventListener("scroll", onScroll, true); document.removeEventListener("mousedown", down); document.removeEventListener("keydown", key, true); };
  }, [anchor, close, place]);
  useEffect(() => { if (view === "day") ref.current?.querySelector<HTMLButtonElement>(`[data-d="${focus}"]`)?.focus({ preventScroll: true }); }, [focus, view, ym]);

  const [y, m] = ym.split("-").map(Number);
  const shift = (n: number) => { const d = new Date(y, m - 1 + n, 1); setDir(n); setYm(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`); };
  const first = ymd(new Date(y, m - 1, 1)); const start = mondayOf(first);
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const pickDay = (d: string) => { onPick(d); close(); };
  const onGridKey = (e: React.KeyboardEvent) => {
    const step: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (e.key in step) { e.preventDefault(); const nd = addDays(focus || today, step[e.key]); setFocus(nd); if (nd.slice(0, 7) !== ym) { setDir(nd > focus ? 1 : -1); setYm(nd.slice(0, 7)); } }
    else if (e.key === "PageDown" || e.key === "PageUp") { e.preventDefault(); const n = e.key === "PageDown" ? 1 : -1; const d = parse(focus || today); d.setMonth(d.getMonth() + n); setFocus(ymd(d)); shift(n); }
  };

  const node = (
    <>
      {sheet && <div className="cal-scrim" onMouseDown={close} />}
      <div ref={ref} className={`calpop ${sheet ? "sheet" : ""} ${closing ? "out" : ""}`} role="dialog" aria-label="날짜 선택" style={sheet || !pos ? undefined : { left: pos.left, top: pos.top }} onKeyDown={view === "day" ? onGridKey : undefined}>
        <div className="calpop-head">
          <button type="button" className="cal-nav" aria-label={view === "day" ? "이전 달" : "이전 해"} onClick={() => (view === "day" ? shift(-1) : shift(-12))}><Icon name="left" size={18} /></button>
          <button type="button" className="calpop-title" onClick={() => setView(view === "day" ? "month" : "day")} aria-label="월 선택 전환">{view === "day" ? `${y}년 ${m}월` : `${y}년`}<Icon name={view === "day" ? "right" : "left"} size={14} className="caret" /></button>
          <button type="button" className="cal-nav" aria-label={view === "day" ? "다음 달" : "다음 해"} onClick={() => (view === "day" ? shift(1) : shift(12))}><Icon name="right" size={18} /></button>
        </div>
        {view === "day" ? (
          <div key={ym} className={`calpop-body ${dir > 0 ? "from-r" : dir < 0 ? "from-l" : ""}`}>
            <div className="calpop-dow">{WEEK.map((w) => <span key={w} className={w === "일" ? "sun" : w === "토" ? "sat" : ""}>{w}</span>)}</div>
            <div className="calpop-grid" role="grid">
              {days.map((d) => { const w = dow(d); const out = !d.startsWith(ym);
                return <button type="button" key={d} data-d={d} tabIndex={d === focus ? 0 : -1} role="gridcell" aria-selected={d === value} aria-label={`${d} ${w}요일`}
                  className={`cday ${out ? "out" : ""} ${d === value ? "sel" : ""} ${d === today ? "today" : ""} ${w === "일" ? "sun" : w === "토" ? "sat" : ""}`}
                  onClick={() => pickDay(d)}>{Number(d.slice(8))}</button>; })}
            </div>
          </div>
        ) : (
          <div key={`m${y}`} className="calpop-body cmonths">
            {MONTHS.map((mm) => { const v = `${y}-${pad(mm)}`; return (
              <button type="button" key={mm} className={`cmon ${v === (value || "").slice(0, 7) ? "sel" : ""} ${v === today.slice(0, 7) ? "today" : ""}`}
                onClick={() => { if (mode === "month") { onPick(v); close(); } else { setYm(v); setFocus(`${v}-01`); setView("day"); } }}>{mm}월</button>); })}
          </div>
        )}
        <div className="calpop-foot">
          <button type="button" className="btn-soft" onClick={() => (mode === "month" ? (onPick(today.slice(0, 7)), close()) : pickDay(today))}>{mode === "month" ? "이번 달" : "오늘"}</button>
          {allowClear && value && <button type="button" className="btn-soft clr" onClick={() => { onClear?.(); close(); }}>지우기</button>}
        </div>
      </div>
    </>
  );
  return createPortal(node, document.body);
}

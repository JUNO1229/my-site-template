"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const GRAD = ["a", "b"] as const;
export const gradOf = (i: number) => GRAD[i % 2];
export function Avatar({ name, size = 40, i = 0, ring = false }: { name: string; size?: number; i?: number; ring?: boolean }) {
  const h = [...name].reduce((a, c) => a + c.charCodeAt(0), i);
  return <span className={`avatar g-${gradOf(h)} ${ring ? "ring" : ""}`} style={{ width: size, height: size, fontSize: size * 0.4 }} aria-hidden="true">{name.slice(0, 1) || "?"}</span>;
}
export function AvatarStack({ names, max = 3 }: { names: string[]; max?: number }) {
  const shown = names.slice(0, max), more = names.length - shown.length;
  return <span className="avstack">{shown.map((n, i) => <Avatar key={i} name={n} size={24} i={i} ring />)}{more > 0 && <span className="avatar more" style={{ width: 24, height: 24 }}>+{more}</span>}</span>;
}
/** 진행률 바 — 진입 시 0 → 값 (약 300ms) */
export function ProgressBar({ value }: { value: number }) {
  const [w, setW] = useState(0);
  useEffect(() => { const t = requestAnimationFrame(() => setW(Math.max(0, Math.min(100, value)))); return () => cancelAnimationFrame(t); }, [value]);
  return <div className="pbar" role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}><div style={{ width: `${w}%` }} /></div>;
}
/** 숫자 카운트업 */
export function CountUp({ value, ms = 500 }: { value: number; ms?: number }) {
  const [v, setV] = useState(0); const from = useRef(0);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { setV(value); return; }
    const start = performance.now(), a = from.current; let raf = 0;
    const tick = (t: number) => { const k = Math.min(1, (t - start) / ms); setV(Math.round(a + (value - a) * (1 - Math.pow(1 - k, 3)))); if (k < 1) raf = requestAnimationFrame(tick); else from.current = value; };
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return <>{v.toLocaleString("ko-KR")}</>;
}
export function Skeleton({ h = 16, w = "100%", r = 10 }: { h?: number; w?: number | string; r?: number }) {
  return <span className="skel" style={{ height: h, width: w, borderRadius: r }} />;
}
export function PageSkeleton() {
  return (
    <div className="page-skel" aria-busy="true" aria-label="불러오는 중">
      <Skeleton h={28} w={220} /><div className="skel-row">{[0, 1, 2, 3].map((i) => <Skeleton key={i} h={150} w={160} r={20} />)}</div>
      <Skeleton h={64} r={20} /><Skeleton h={64} r={20} /><Skeleton h={64} r={20} />
    </div>
  );
}
/** 팝오버 메뉴(⋮) */
export function PopMenu({ items, label = "메뉴", tone = "" }: { items: { label: string; icon?: string; onClick: () => void; danger?: boolean }[]; label?: string; tone?: string }) {
  const [open, setOpen] = useState(false); const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null); const menuRef = useRef<HTMLDivElement>(null);
  /* 메뉴는 body에 띄워(fixed) 카드·스크롤 영역에 가려지거나 잘리지 않게 한다 */
  useLayoutEffect(() => {
    if (!open) { setPos(null); return; }
    const btn = ref.current?.querySelector("button"); const m = menuRef.current; if (!btn || !m) return;
    const r = btn.getBoundingClientRect(), w = m.offsetWidth, h = m.offsetHeight;
    const top = r.bottom + 8 + h > innerHeight - 8 ? Math.max(8, r.top - 8 - h) : r.bottom + 8;
    setPos({ top, left: Math.min(Math.max(8, r.right - w), innerWidth - w - 8) });
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const off = (e: MouseEvent | KeyboardEvent) => { if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node) && !menuRef.current?.contains(e.target as Node)) setOpen(false); };
    const close = () => setOpen(false);
    document.addEventListener("mousedown", off); document.addEventListener("keydown", off);
    window.addEventListener("scroll", close, true); window.addEventListener("resize", close);
    return () => { document.removeEventListener("mousedown", off); document.removeEventListener("keydown", off); window.removeEventListener("scroll", close, true); window.removeEventListener("resize", close); };
  }, [open]);
  if (!items.length) return null;
  return (
    <div className="popwrap" ref={ref} onClick={(e) => e.stopPropagation()}>
      <button className={`icon-btn ${tone}`} aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="12" cy="19" r="1.6" /></svg>
      </button>
      {open && createPortal(
        <div className="popmenu popmenu-fixed" role="menu" ref={menuRef} onClick={(e) => e.stopPropagation()} style={{ top: pos?.top ?? 0, left: pos?.left ?? 0, visibility: pos ? "visible" : "hidden" }}>{items.map((it, i) => (
          <button key={i} role="menuitem" className={it.danger ? "danger" : ""} onClick={() => { setOpen(false); it.onClick(); }}>{it.label}</button>))}</div>, document.body)}
    </div>
  );
}

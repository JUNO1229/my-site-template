"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/** 화면 전체의 마우스 올림 설명(title)을 브라우저 기본 모양 대신 시스템 스타일 정보창으로 보여준다.
 *  title 속성은 data-tip 으로 옮겨 기본 툴팁이 뜨지 않게 한다. */
export default function TitleTips() {
  const [tip, setTip] = useState<{ text: string; el: HTMLElement } | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const box = useRef<HTMLDivElement>(null); const timer = useRef<ReturnType<typeof setTimeout> | null>(null); const cur = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const hide = () => { if (timer.current) clearTimeout(timer.current); cur.current = null; setTip(null); setPos(null); };
    const over = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null; if (!t?.closest) return;
      const el = t.closest<HTMLElement>("[title],[data-tip]");
      if (!el || el.closest(".hovertip")) { if (cur.current) hide(); return; }
      const title = el.getAttribute("title");
      if (title !== null) { // 기본 툴팁 대신 쓰도록 옮긴다
        if (title) el.setAttribute("data-tip", title); else el.removeAttribute("data-tip");
        el.removeAttribute("title");
        if (title && !el.getAttribute("aria-label") && !el.textContent?.trim()) el.setAttribute("aria-label", title);
      }
      const text = el.getAttribute("data-tip"); if (!text) { if (cur.current) hide(); return; }
      if (cur.current === el) return;
      hide(); cur.current = el; timer.current = setTimeout(() => { if (cur.current === el && document.contains(el)) setTip({ text, el }); }, 350);
    };
    const out = (e: MouseEvent) => { const to = e.relatedTarget as Node | null; if (cur.current && (!to || !cur.current.contains(to))) hide(); };
    document.addEventListener("mouseover", over, true); document.addEventListener("mouseout", out, true);
    document.addEventListener("mousedown", hide, true); document.addEventListener("keydown", hide, true); window.addEventListener("scroll", hide, true); window.addEventListener("blur", hide);
    return () => { hide(); document.removeEventListener("mouseover", over, true); document.removeEventListener("mouseout", out, true);
      document.removeEventListener("mousedown", hide, true); document.removeEventListener("keydown", hide, true); window.removeEventListener("scroll", hide, true); window.removeEventListener("blur", hide); };
  }, []);
  useEffect(() => {
    if (!tip || !box.current) return;
    const r = tip.el.getBoundingClientRect(), w = box.current.offsetWidth, h = box.current.offsetHeight;
    const top = r.bottom + 8 + h > innerHeight - 8 ? Math.max(8, r.top - 8 - h) : r.bottom + 8;
    setPos({ top, left: Math.min(Math.max(8, r.left + r.width / 2 - w / 2), innerWidth - w - 8) });
  }, [tip]);
  if (!tip) return null;
  return createPortal(<div ref={box} className="hovertip simple" role="tooltip" style={{ top: pos?.top ?? 0, left: pos?.left ?? 0, visibility: pos ? "visible" : "hidden" }}>{tip.text}</div>, document.body);
}

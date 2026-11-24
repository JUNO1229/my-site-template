"use client";
import { useRef, useState } from "react";
import CalendarPopup from "./CalendarPopup";
import { Icon } from "./Icons";
import { dow } from "@/lib/util";

/** 날짜 입력칸 — 누르면 시스템 스타일 달력이 열린다 */
export default function DateField({ value, onChange, allowClear, placeholder = "날짜 선택", compact, ariaLabel }: {
  value: string; onChange: (v: string) => void; allowClear?: boolean; placeholder?: string; compact?: boolean; ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false); const btn = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button type="button" ref={btn} className={`datefield ${compact ? "compact" : ""} ${open ? "open" : ""} ${value ? "" : "empty"}`} aria-haspopup="dialog" aria-expanded={open} aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}>
        <span>{value ? `${value} (${dow(value)})` : placeholder}</span><Icon name="calendar" size={18} />
      </button>
      {open && <CalendarPopup anchor={btn.current} value={value} allowClear={allowClear} onPick={onChange} onClear={() => onChange("")} onClose={() => setOpen(false)} />}
    </>
  );
}

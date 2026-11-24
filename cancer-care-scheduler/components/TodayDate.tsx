"use client";
import { useEffect, useState } from "react";
import { dow, ymd } from "@/lib/util";
import { Icon } from "./Icons";

/** 오늘의 날짜 칩 — "오늘 2026-11-24(화)". 자정이 지나면 자동으로 바뀐다 */
export default function TodayDate() {
  const [d, setD] = useState<string | null>(null);
  useEffect(() => { const f = () => setD(ymd(new Date())); f(); const t = setInterval(f, 30000); return () => clearInterval(t); }, []);
  return (
    <span className="todaychip" title="오늘 날짜">
      <Icon name="calendar" size={15} />{d ? <><b>오늘</b> {d}({dow(d)})</> : <>&nbsp;</>}
    </span>
  );
}

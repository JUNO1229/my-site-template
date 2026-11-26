"use client";
import { useEffect, useState } from "react";
import { dow, pad, ymd } from "@/lib/util";

/** 실시간 시계 — "2026-11-24(화) 23:47:05" 형식, 1초마다 갱신(초까지 표시), 자정이 지나면 날짜도 바뀐다 */
export default function LiveClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!now) return <span className="clock" aria-hidden="true">&nbsp;</span>; // 서버/클라이언트 시각 차이로 인한 표시 불일치를 피하려고 마운트 후에 표시
  return (
    <time className="clock" dateTime={now.toISOString()} title={now.toLocaleTimeString("ko-KR")}>
      <span className="cy">{ymd(now).slice(0, 5)}</span>{ymd(now).slice(5)}({dow(ymd(now))}) {pad(now.getHours())}:{pad(now.getMinutes())}:{pad(now.getSeconds())}
    </time>
  );
}

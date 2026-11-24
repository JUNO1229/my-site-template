"use client";
import { addDays, label, todayStr } from "@/lib/util";
export default function DateBar({ date, setDate, step = 1 }: { date: string; setDate: (d: string) => void; step?: number }) {
  return (
    <div className="datebar">
      <button onClick={() => setDate(addDays(date, -step))}>◀</button>
      <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
      <b>{label(date)}</b>
      <button onClick={() => setDate(addDays(date, step))}>▶</button>
      <button onClick={() => setDate(todayStr())}>오늘</button>
    </div>
  );
}

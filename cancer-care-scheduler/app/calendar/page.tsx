"use client";
import { useState } from "react";
import { useAppts, useStore } from "@/lib/store";
import { addDays, parse, pad, pname, todayStr, toMin, ymd } from "@/lib/util";
import { PageSkeleton } from "@/components/Ui";
import { useFitRows } from "@/lib/ui";

export default function CalendarPage() {
  const { db, ready } = useStore();
  const [pid, setPid] = useState("");
  const [ym, setYm] = useState(todayStr().slice(0, 7));
  const current = db.patients.filter((p) => p.source !== "auto" && p.status !== "discharged");
  const patient = db.patients.find((p) => p.id === pid) ?? current[0] ?? db.patients[0];
  const first = parse(`${ym}-01`);
  const gridStart = addDays(ymd(first), -((first.getDay() + 6) % 7));
  const appts = useAppts(gridStart, addDays(gridStart, 41), patient?.id ?? "none");
  const calRef = useFitRows([ready, ym, patient?.id, appts.length]); // 달력을 화면 아래 끝까지 채운다
  if (!ready) return <PageSkeleton />;
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i)).filter((_, i, a) => i < 35 || a[35].startsWith(ym));
  const shift = (n: number) => { const d = new Date(first); d.setMonth(d.getMonth() + n); setYm(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`); };
  return (
    <div className="pcal">
      <div className="toolbar no-print"><h2>환자별 치료캘린더</h2>
        <select value={patient?.id} onChange={(e) => setPid(e.target.value)}>{current.map((p) => <option key={p.id} value={p.id}>{pname(p)}</option>)}</select>
        <div className="datebar"><button onClick={() => shift(-1)}>◀</button><b>{ym}</b><button onClick={() => shift(1)}>▶</button></div>
        <button onClick={() => window.print()}>인쇄</button></div>
      <h3 className="print-title">무등산생태요양병원 {pname(patient)} 님의 {Number(ym.slice(5))}월 치료스케줄</h3>
      <div className="cal fit" ref={calRef} style={{ "--weeks": cells.length / 7 } as React.CSSProperties}>
        {["월", "화", "수", "목", "금", "토", "일"].map((d) => <div key={d} className="dh">{d}</div>)}
        {cells.map((d) => {
          const list = appts.filter((a) => a.date === d && a.patientId === patient?.id && a.status !== "취소").sort((a, b) => toMin(a.time) - toMin(b.time));
          return (
            <div key={d} className={`day ${d.startsWith(ym) ? "" : "out"} ${d === todayStr() ? "today" : ""}`}>
              <div className="dn">{Number(d.slice(8))}</div>
              <div className="evs">{list.map((a) => <div key={a.id} className={`ev s-${a.status}`} title={`${a.time} ${db.items.find((i) => i.id === a.itemId)?.name ?? ""}${a.option ? " · " + a.option : ""} (${a.status})`}><b>{a.time}</b> {db.items.find((i) => i.id === a.itemId)?.name}{a.option && <em>{a.option}</em>}</div>)}</div>
            </div>);
        })}
      </div>
    </div>
  );
}

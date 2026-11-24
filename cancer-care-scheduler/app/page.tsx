"use client";
import { useMemo, useState } from "react";
import DateBar from "@/components/DateBar";
import ApptModal, { type Draft } from "@/components/ApptModal";
import { useStore } from "@/lib/store";
import { findConflicts, pname, todayStr, toMin } from "@/lib/util";
import type { Appt } from "@/lib/types";

export default function Monitor() {
  const { db, ready } = useStore();
  const [date, setDate] = useState(todayStr());
  const [view, setView] = useState<"cards" | "timeline">("cards");
  const [draft, setDraft] = useState<Draft | null>(null);
  const conflicts = useMemo(() => findConflicts(db, date), [db, date]);
  const day = useMemo(() => db.appts.filter((a) => a.date === date).sort((a, b) => toMin(a.time) - toMin(b.time)), [db, date]);
  const rooms = db.rooms.filter((r) => r.active);
  const roomOf = (a: Appt) => db.items.find((i) => i.id === a.itemId)?.roomId;
  const count = (list: Appt[], s: string) => list.filter((a) => a.status === s).length;
  if (!ready) return <p>불러오는 중…</p>;

  const chip = (a: Appt) => {
    const p = db.patients.find((x) => x.id === a.patientId); const it = db.items.find((i) => i.id === a.itemId);
    return (
      <button key={a.id} className={`appt s-${a.status} ${conflicts.has(a.id) ? "conflict" : ""}`}
        title={conflicts.get(a.id) ?? p?.plan} onClick={() => setDraft(a)}>
        <span className="t">{a.time}</span><span className="n">{pname(p)}</span>
        <span className="i">{it?.name}{a.option && ` ${a.option}`}</span><span className="st">{a.status}</span>
      </button>
    );
  };

  return (
    <>
      <div className="toolbar">
        <h2>통합 모니터링</h2><DateBar date={date} setDate={setDate} />
        <div className="seg"><button className={view === "cards" ? "on" : ""} onClick={() => setView("cards")}>치료실별</button>
          <button className={view === "timeline" ? "on" : ""} onClick={() => setView("timeline")}>시간표</button></div>
        <button className="primary" onClick={() => setDraft({ date })}>+ 스케줄 등록</button>
      </div>
      <div className="kpis">
        <div className="kpi"><b>{day.length}</b>전체</div>
        <div className="kpi s-예약"><b>{count(day, "예약")}</b>예약</div>
        <div className="kpi s-완료"><b>{count(day, "완료")}</b>치료완료</div>
        <div className="kpi s-취소"><b>{count(day, "취소")}</b>예약취소</div>
        <div className={`kpi ${conflicts.size ? "bad" : ""}`}><b>{conflicts.size}</b>충돌</div>
      </div>
      {view === "cards" ? (
        <div className="rooms" style={{ gridTemplateColumns: `repeat(${rooms.length}, minmax(190px, 1fr))` }}>
          {rooms.map((r) => {
            const list = day.filter((a) => roomOf(a) === r.id);
            return (
              <section key={r.id} className="room" style={{ borderTopColor: r.color }}>
                <header><div><b>{r.name}</b><small>{r.therapist}</small></div>
                  <div className="mini">{count(list, "완료")}/{list.length - count(list, "취소")}</div></header>
                <div className="list">{list.length ? list.map(chip) : <p className="empty">스케줄 없음</p>}</div>
                <button className="add" onClick={() => setDraft({ date, itemId: db.items.find((i) => i.roomId === r.id)?.id })}>+ 추가</button>
              </section>
            );
          })}
        </div>
      ) : <Timeline day={day} chip={chip} />}
      {draft && <ApptModal draft={draft} onClose={() => setDraft(null)} />}
    </>
  );

  function Timeline({ day, chip }: { day: Appt[]; chip: (a: Appt) => React.ReactNode }) {
    const lanes = db.items.filter((i) => rooms.some((r) => r.id === i.roomId));
    const hours = Array.from({ length: 10 }, (_, k) => 8 + k);
    return (
      <div className="tl" style={{ gridTemplateColumns: `56px repeat(${lanes.length}, minmax(130px, 1fr))` }}>
        <div className="h" />
        {lanes.map((l) => <div key={l.id} className="h" style={{ color: rooms.find((r) => r.id === l.roomId)?.color }}>
          {rooms.find((r) => r.id === l.roomId)?.name}<br /><b>{l.name}</b></div>)}
        {hours.map((h) => (
          <div key={h} style={{ display: "contents" }}>
            <div className="hr">{String(h).padStart(2, "0")}:00</div>
            {lanes.map((l) => <div key={l.id} className="cell">
              {day.filter((a) => a.itemId === l.id && Math.floor(toMin(a.time) / 60) === h).map(chip)}</div>)}
          </div>
        ))}
      </div>
    );
  }
}

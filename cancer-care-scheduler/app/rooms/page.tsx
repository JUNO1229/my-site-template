"use client";
import { useMemo, useState } from "react";
import DatePicker from "@/components/DatePicker";
import ApptCard from "@/components/ApptCard";
import { PageSkeleton } from "@/components/Ui";
import { useAppts, useStore } from "@/lib/store";
import { useFitRows, useNow, useStatusChange, useUi } from "@/lib/ui";
import { canEditRoom } from "@/lib/perm";
import { addDays, findConflicts, label, mondayOf, todayStr, toMin } from "@/lib/util";

export default function RoomPage() {
  const { db, ready, me } = useStore(); const { openAppt } = useUi(); const setStatus = useStatusChange();
  const [roomId, setRoomId] = useState("");
  const [date, setDate] = useState(todayStr());
  const rooms = db.rooms.filter((r) => r.active);
  const own = me?.role === "therapist" ? rooms.find((r) => me.roomIds.includes(r.id)) : undefined;
  const room = rooms.find((r) => r.id === roomId) ?? own ?? rooms[0];
  const mon = mondayOf(date); const days = [0, 1, 2, 3, 4].map((i) => addDays(mon, i));
  const appts = useAppts(mon, addDays(mon, 4));
  const now = useNow(); const today = todayStr(); const nowMin = now.getHours() * 60 + now.getMinutes();
  const conflicts = useMemo(() => findConflicts(appts, db.items), [appts, db.items]);
  const weekRef = useFitRows([ready, room?.id, date, appts.length]);
  if (!ready || !room) return <PageSkeleton />;
  const lanes = db.items.filter((i) => i.roomId === room.id);
  return (
    <div className="mon roomweek">
      <div className="toolbar"><h2>치료실별 스케줄</h2>
        <div className="seg">{rooms.map((r) => <button key={r.id} className={r.id === room.id ? "on" : ""} onClick={() => setRoomId(r.id)}>{r.name}</button>)}</div>
        {room.therapist && <span className="hint">담당 {room.therapist}</span>}</div>
      <DatePicker date={date} setDate={setDate} />
      <div className="rooms fit" ref={weekRef} style={{ "--n": 5, "--cols": "repeat(5,minmax(0,1fr))" } as React.CSSProperties}>
        {days.map((d, di) => {
          const list = appts.filter((a) => a.date === d && lanes.some((l) => l.id === a.itemId)).sort((a, b) => toMin(a.time) - toMin(b.time));
          return (
            <section key={d} className={`room ${d === date ? "sel" : ""}`} style={{ animationDelay: `${di * 60}ms` }}>
              <header><div><b className="dh-compact">{Number(d.slice(5, 7))}월 {Number(d.slice(8))}일 ({label(d).slice(-2, -1)})</b>{d === today && <small>오늘</small>}</div><span className="mini">{list.filter((a) => a.status === "완료").length}/{list.filter((a) => a.status !== "취소").length}</span></header>
              <div className="list" style={{ "--rows": Math.max(10, list.length) } as React.CSSProperties}>
                {list.length ? list.map((a, i) => (
                  <ApptCard key={a.id} a={a} patient={db.patients.find((p) => p.id === a.patientId)} item={db.items.find((x) => x.id === a.itemId)} room={room} conflict={conflicts.get(a.id)}
                    today={today} nowMin={nowMin} me={me} onOpen={openAppt} onStatus={setStatus} showRoom={false} delay={Math.min(i, 10) * 35} compact hideItem={lanes.length <= 1} />)) : <p className="empty">스케줄 없음</p>}
              </div>
              {canEditRoom(me, room.id) && <button className="add" onClick={() => openAppt({ date: d, itemId: lanes[0]?.id })}>+ 추가</button>}
            </section>);
        })}
      </div>
    </div>
  );
}

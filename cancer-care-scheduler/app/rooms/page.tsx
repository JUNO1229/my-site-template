"use client";
import { useMemo, useState } from "react";
import DateBar from "@/components/DateBar";
import ApptModal, { type Draft } from "@/components/ApptModal";
import { useAppts, useStore } from "@/lib/store";
import { canEditRoom } from "@/lib/perm";
import { addDays, findConflicts, label, mondayOf, pname, todayStr, toMin } from "@/lib/util";

export default function RoomPage() {
  const { db, ready, me } = useStore();
  const [roomId, setRoomId] = useState("");
  const [date, setDate] = useState(todayStr());
  const [draft, setDraft] = useState<Draft | null>(null);
  const rooms = db.rooms.filter((r) => r.active);
  const own = me?.role === "therapist" ? rooms.find((r) => me.roomIds.includes(r.id)) : undefined;
  const room = rooms.find((r) => r.id === roomId) ?? own ?? rooms[0];
  const mon = mondayOf(date);
  const appts = useAppts(mon, addDays(mon, 4));
  const days = [0, 1, 2, 3, 4].map((i) => addDays(mon, i));
  const lanes = db.items.filter((i) => i.roomId === room?.id);
  const conflicts = useMemo(() => findConflicts(appts, db.items), [appts, db.items]);
  if (!ready || !room) return <p>불러오는 중…</p>;
  return (
    <>
      <div className="toolbar">
        <h2>치료실별 스케줄</h2>
        <div className="seg">{rooms.map((r) => <button key={r.id} className={r.id === room.id ? "on" : ""} onClick={() => setRoomId(r.id)}>{r.name}</button>)}</div>
        <DateBar date={date} setDate={setDate} step={7} />
        <span className="hint">담당 {room.therapist}</span>
      </div>
      <div className="week">
        {days.map((d) => {
          const list = appts.filter((a) => a.date === d && lanes.some((l) => l.id === a.itemId)).sort((a, b) => toMin(a.time) - toMin(b.time));
          return (
            <section key={d} className="room" style={{ borderTopColor: room.color }}>
              <header><b>{label(d)}</b><span className="mini">{list.filter((a) => a.status !== "취소").length}건</span></header>
              <div className="list">
                {list.length ? list.map((a) => (
                  <button key={a.id} className={`appt s-${a.status} ${conflicts.has(a.id) ? "conflict" : ""}`} title={conflicts.get(a.id)} onClick={() => setDraft(a)}>
                    <span className="t">{a.time}</span><span className="n">{pname(db.patients.find((p) => p.id === a.patientId))}</span>
                    <span className="i">{db.items.find((i) => i.id === a.itemId)?.name}{a.option && ` ${a.option}`}</span><span className="st">{a.status}</span>
                  </button>)) : <p className="empty">스케줄 없음</p>}
              </div>
              {canEditRoom(me, room.id) && <button className="add" onClick={() => setDraft({ date: d, itemId: lanes[0]?.id })}>+ 추가</button>}
            </section>
          );
        })}
      </div>
      {draft && <ApptModal draft={draft} onClose={() => setDraft(null)} />}
    </>
  );
}

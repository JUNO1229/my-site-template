"use client";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { isAdmin } from "@/lib/perm";
import { api } from "@/lib/api";
import type { Item, Room } from "@/lib/types";
import { PageSkeleton } from "@/components/Ui";
import { useToast } from "@/lib/toast";

export default function Settings() {
  const { db, me, ready, refresh } = useStore();
  const [rooms, setRooms] = useState<Room[]>([]); const [items, setItems] = useState<(Item & { slotText: string })[]>([]);
  const [msg, setMsg] = useState(""); const [err, setErr] = useState("");
  const { toast } = useToast();
  useEffect(() => { setRooms(db.rooms); setItems(db.items.map((i) => ({ ...i, slotText: i.slots.join(",") }))); }, [db]);
  if (!ready) return <PageSkeleton />;
  if (!isAdmin(me)) return <p className="err">시스템관리자만 접근할 수 있습니다.</p>;
  const saveAll = async () => {
    setErr(""); setMsg("");
    try {
      for (const r of rooms) await api(`/api/rooms/${r.id}`, "PUT", r);
      for (const i of items) await api(`/api/items/${i.id}`, "PUT", { ...i, slots: i.slotText.split(",").map((s) => s.trim()).filter(Boolean) });
      await refresh(); setMsg(""); toast("치료실 설정을 저장했습니다");
    } catch (e) { setErr((e as Error).message); }
  };
  return (
    <>
      <div className="toolbar"><h2>치료실 설정</h2><button className="primary" onClick={saveAll}>전체 저장</button>{msg && <span className="ok">{msg}</span>}{err && <span className="err">{err}</span>}</div>
      {rooms.map((r) => (
        <section key={r.id} className="card">
          <div className="row"><label>치료실<input value={r.name} onChange={(e) => setRooms(rooms.map((x) => x.id === r.id ? { ...x, name: e.target.value } : x))} /></label>
            <label>담당자<input value={r.therapist} onChange={(e) => setRooms(rooms.map((x) => x.id === r.id ? { ...x, therapist: e.target.value } : x))} /></label>
            <label className="chk"><input type="checkbox" checked={r.active} onChange={(e) => setRooms(rooms.map((x) => x.id === r.id ? { ...x, active: e.target.checked } : x))} />모니터링 표시</label></div>
          {items.filter((i) => i.roomId === r.id).map((i) => (
            <div key={i.id} className="row sub"><label>치료항목<input value={i.name} onChange={(e) => setItems(items.map((x) => x.id === i.id ? { ...x, name: e.target.value } : x))} /></label>
              <label>소요(분)<input type="number" value={i.duration} onChange={(e) => setItems(items.map((x) => x.id === i.id ? { ...x, duration: Number(e.target.value) } : x))} /></label>
              <label>동시 수용 인원<input type="number" min={1} value={i.capacity} onChange={(e) => setItems(items.map((x) => x.id === i.id ? { ...x, capacity: Number(e.target.value) } : x))} /></label>
              <label>시작시간 목록(HH:MM, 쉼표)<input value={i.slotText} onChange={(e) => setItems(items.map((x) => x.id === i.id ? { ...x, slotText: e.target.value } : x))} /></label></div>))}
        </section>))}
    </>
  );
}

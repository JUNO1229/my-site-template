"use client";
import { useEffect, useMemo, useState } from "react";
import DatePicker from "@/components/DatePicker";
import ApptCard from "@/components/ApptCard";
import { CountUp, PageSkeleton, ProgressBar } from "@/components/Ui";
import { Icon } from "@/components/Icons";
import { useAppts, useStore } from "@/lib/store";
import { useFitRows, useNow, useStatusChange, useUi } from "@/lib/ui";
import { canEditRoom } from "@/lib/perm";
import { api } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { findConflicts, toMin, todayStr } from "@/lib/util";
import { isOff, type Appt } from "@/lib/types";

export default function Monitor() {
  const { db, ready, me, refresh } = useStore(); const { toast } = useToast(); const { openAppt } = useUi(); const setStatus = useStatusChange();
  const [date, setDate] = useState(todayStr());
  const [view, setView] = useState<"cards" | "timeline">("cards");
  const [roomId, setRoomId] = useState("");
  const appts = useAppts(date, date);
  const now = useNow(); const today = todayStr(); const nowMin = now.getHours() * 60 + now.getMinutes();
  const conflicts = useMemo(() => findConflicts(appts, db.items), [appts, db.items]);
  // 치료실 카드 순서: 관리자·스케줄관리자는 끌어서 바꾸면 모두에게 적용, 그 외 계정은 이 브라우저에만 저장
  const shared = me?.role === "admin" || me?.role === "manager";
  const [localOrder, setLocalOrder] = useState<string[]>([]); const [dragId, setDragId] = useState(""); const [overId, setOverId] = useState("");
  useEffect(() => { try { setLocalOrder(JSON.parse(localStorage.getItem("ccs-room-order") || "[]")); } catch { /* ignore */ } }, []);
  const rooms = useMemo(() => {
    const act = db.rooms.filter((r) => r.active);
    if (shared || !localOrder.length) return act;
    const pos = (id: string) => { const i = localOrder.indexOf(id); return i < 0 ? 999 : i; };
    return [...act].sort((a, b) => pos(a.id) - pos(b.id));
  }, [db.rooms, shared, localOrder]);
  const moveRoom = async (from: string, to: string) => {
    if (!from || !to || from === to) return;
    const ids = rooms.map((r) => r.id); const i = ids.indexOf(from); ids.splice(i, 1); ids.splice(ids.indexOf(to) + (i < ids.indexOf(to) ? 1 : 0), 0, from);
    if (shared) { // 비활성 치료실은 뒤에 그대로 유지
      const all = [...ids, ...db.rooms.filter((r) => !r.active).map((r) => r.id)];
      try { await api("/api/rooms/order", "POST", { ids: all }); await refresh(); toast("치료실 순서를 저장했습니다 (모두에게 적용)"); } catch (e) { toast((e as Error).message, "err"); }
    } else { setLocalOrder(ids); try { localStorage.setItem("ccs-room-order", JSON.stringify(ids)); } catch { /* ignore */ } toast("치료실 순서를 저장했습니다 (이 브라우저에만 적용)"); }
  };
  const itemOf = (a: Appt) => db.items.find((i) => i.id === a.itemId);
  const roomOf = (a: Appt) => db.rooms.find((r) => r.id === itemOf(a)?.roomId);
  const sorted = useMemo(() => [...appts].sort((a, b) => toMin(a.time) - toMin(b.time)), [appts]);
  const shown = roomId ? sorted.filter((a) => itemOf(a)?.roomId === roomId) : sorted;
  const count = (list: Appt[], s: string) => list.filter((a) => a.status === s).length;
  const dur = (a: Appt) => itemOf(a)?.duration ?? 50;
  const conflictCount = shown.filter((a) => conflicts.has(a.id)).length; // 선택한 치료실 기준

  useEffect(() => { const d = new URLSearchParams(location.search).get("date"); if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) setDate(d); }, []);
  useEffect(() => {
    if (view !== "timeline" || date !== today) return;
    const t = setTimeout(() => document.getElementById("nowline")?.scrollIntoView({ behavior: "smooth", block: "center" }), 350);
    return () => clearTimeout(t);
  }, [view, date, today, ready]);
  const roomsRef = useFitRows([ready, view, roomId, date, appts.length, db.rooms.length]);
  if (!ready) return <PageSkeleton />;

  const card = (a: Appt, i: number) => (
    <ApptCard key={a.id} a={a} patient={db.patients.find((p) => p.id === a.patientId)} item={itemOf(a)} room={roomOf(a)} conflict={conflicts.get(a.id)}
      today={today} nowMin={nowMin} me={me} onOpen={openAppt} onStatus={setStatus} showRoom={view === "timeline" || !!roomId} delay={Math.min(i, 12) * 35} compact={view === "cards"} hideItem={db.items.filter((x) => x.roomId === itemOf(a)?.roomId).length <= 1} />);

  return (
    <div className="mon">
      <div className="toolbar">
        <h2>치료실 통합모니터링</h2>
                <div className="kchips" aria-label="일정 요약">
          <span className="kc">전체 <b><CountUp value={shown.length} /></b></span><span className="kc s-예약">예약 <b><CountUp value={count(shown, "예약")} /></b></span>
          <span className="kc s-완료">치료완료 <b><CountUp value={count(shown, "완료")} /></b></span><span className="kc s-연기">연기 <b><CountUp value={count(shown, "연기")} /></b></span><span className="kc s-취소">예약취소 <b><CountUp value={count(shown, "취소")} /></b></span>
          <span className={`kc ${conflictCount ? "bad" : ""}`}>충돌 <b><CountUp value={conflictCount} /></b></span></div>{roomId && <button className="btn-soft" onClick={() => setRoomId("")}>전체 치료실 보기</button>}<span className="spacer" />
        <div className="seg" role="tablist"><button className={view === "cards" ? "on" : ""} onClick={() => setView("cards")} role="tab" aria-selected={view === "cards"}>치료실별</button>
          <button className={view === "timeline" ? "on" : ""} onClick={() => setView("timeline")} role="tab" aria-selected={view === "timeline"}>타임라인</button></div>
        {me && me.role !== "viewer" && <button className="primary desk-only" onClick={() => openAppt({ date })}><Icon name="plus" size={18} />스케줄 등록</button>}
      </div>
      <DatePicker date={date} setDate={setDate} />

      <div className="dash">
        <div>
          {view === "timeline" && (
            <div className="rfilter" role="group" aria-label="치료실 필터">
              <button className={!roomId ? "on" : ""} onClick={() => setRoomId("")}>전체 {sorted.length}</button>
              {rooms.map((r) => <button key={r.id} className={roomId === r.id ? "on" : ""} onClick={() => setRoomId(roomId === r.id ? "" : r.id)}>{r.name} {sorted.filter((a) => itemOf(a)?.roomId === r.id).length}</button>)}
            </div>)}
          {view === "cards" ? (
            <div className="rooms fit" ref={roomsRef} style={{ "--n": (roomId ? rooms.filter((r) => r.id === roomId) : rooms).length, "--cols": (roomId ? rooms.filter((r) => r.id === roomId) : rooms).map((r) => (sorted.some((a) => itemOf(a)?.roomId === r.id) ? "minmax(150px,1fr)" : "minmax(100px,.5fr)")).join(" ") } as React.CSSProperties}>
              {(roomId ? rooms.filter((r) => r.id === roomId) : rooms).map((r, ri) => {
                const list = sorted.filter((a) => itemOf(a)?.roomId === r.id); const total = list.filter((a) => !isOff(a.status)).length, done = count(list, "완료"), left = total - done, pct = total ? (done / total) * 100 : 0;
                return (
                  <section key={r.id} className={`room merged ${dragId === r.id ? "dragging" : ""} ${overId === r.id && dragId !== r.id ? "dropover" : ""}`} style={{ animationDelay: `${ri * 60}ms` }}
                    onDragOver={(e) => { if (dragId) { e.preventDefault(); setOverId(r.id); } }} onDragLeave={() => setOverId((o) => (o === r.id ? "" : o))}
                    onDrop={(e) => { e.preventDefault(); const f = dragId; setDragId(""); setOverId(""); moveRoom(f, r.id); }}>
                    <header className={`rhead g-${ri % 2 ? "b" : "a"} ${roomId === r.id ? "sel" : ""}`} draggable={!roomId} onDragStart={(e) => { setDragId(r.id); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", r.id); }} onDragEnd={() => { setDragId(""); setOverId(""); }} role="button" tabIndex={0} aria-pressed={roomId === r.id}
                      title={roomId === r.id ? "전체 치료실 보기" : "머리글을 끌어서 순서 변경 · 클릭하면 이 치료실만 보기"} onClick={() => setRoomId(roomId === r.id ? "" : r.id)} onKeyDown={(e) => { if (e.key === "Enter") setRoomId(roomId === r.id ? "" : r.id); }}>
                      <div className="rh-top"><b>{r.name}</b>{!roomId && <span className="grip" aria-hidden="true">⠿</span>}</div>
                      <div className="rh-sub"><span>{r.therapist ? `담당 ${r.therapist}` : ""}</span><span className="rbadge">{total === 0 ? "일정 없음" : left === 0 ? "모두 완료" : `${left}건 남음`}</span></div>
                      <div className="rh-bar"><ProgressBar value={pct} /><span>{done}/{total}</span></div>
                    </header>
                    <div className="list" style={{ "--rows": Math.max(10, list.length) } as React.CSSProperties}>{list.length ? list.map((a, i) => card(a, i)) : <p className="empty">스케줄 없음</p>}</div>
                    {canEditRoom(me, r.id) && <button className="add" onClick={() => openAppt({ date, itemId: db.items.find((i) => i.roomId === r.id)?.id })}>+ 추가</button>}
                  </section>);
              })}
            </div>
          ) : (
            <Timeline shown={shown} card={card} nowMin={nowMin} isToday={date === today} />
          )}
        </div>
      </div>
    </div>
  );
}

function Timeline({ shown, card, nowMin, isToday }: { shown: Appt[]; card: (a: Appt, i: number) => React.ReactNode; nowMin: number; isToday: boolean }) {
  if (!shown.length) return <p className="empty">이 날의 스케줄이 없습니다</p>;
  const before = isToday ? shown.filter((a) => toMin(a.time) <= nowMin) : shown;
  const after = isToday ? shown.filter((a) => toMin(a.time) > nowMin) : [];
  let idx = 0; let lastHour = -1;
  const rows = (list: Appt[]) => {
    const g = new Map<number, Appt[]>(); list.forEach((a) => { const h = Math.floor(toMin(a.time) / 60); g.set(h, [...(g.get(h) ?? []), a]); });
    return [...g.entries()].map(([h, l]) => (
      <div className="tl-row" key={`${h}-${l[0].id}`}><div className="tl-hour">{(() => { const show = h !== lastHour; lastHour = h; return show ? `${String(h).padStart(2, "0")}:00` : ""; })()}</div><div className="tl-cards">{l.map((a) => card(a, idx++))}</div></div>));
  };
  const hh = String(Math.floor(nowMin / 60)).padStart(2, "0"), mm = String(nowMin % 60).padStart(2, "0");
  return (
    <div className="tline">
      {rows(before)}
      {isToday && <div className="nowline" id="nowline" aria-label={`현재 시각 ${hh}:${mm}`}><span className="pillnow">{hh}:{mm}</span><i /></div>}
      {rows(after)}
    </div>
  );
}

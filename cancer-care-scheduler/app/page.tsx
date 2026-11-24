"use client";
import { useEffect, useMemo, useState } from "react";
import DatePicker from "@/components/DatePicker";
import ApptCard from "@/components/ApptCard";
import { Avatar, AvatarStack, CountUp, PageSkeleton, PopMenu, ProgressBar } from "@/components/Ui";
import { Icon } from "@/components/Icons";
import { useAppts, useStore } from "@/lib/store";
import { useNow, useStatusChange, useUi } from "@/lib/ui";
import { canEditRoom } from "@/lib/perm";
import { findConflicts, toMin, todayStr } from "@/lib/util";
import type { Appt } from "@/lib/types";

export default function Monitor() {
  const { db, ready, me } = useStore(); const { openAppt } = useUi(); const setStatus = useStatusChange();
  const [date, setDate] = useState(todayStr());
  const [view, setView] = useState<"cards" | "timeline">("cards");
  const [roomId, setRoomId] = useState("");
  const appts = useAppts(date, date);
  const now = useNow(); const today = todayStr(); const nowMin = now.getHours() * 60 + now.getMinutes();
  const conflicts = useMemo(() => findConflicts(appts, db.items), [appts, db.items]);
  const rooms = db.rooms.filter((r) => r.active);
  const itemOf = (a: Appt) => db.items.find((i) => i.id === a.itemId);
  const roomOf = (a: Appt) => db.rooms.find((r) => r.id === itemOf(a)?.roomId);
  const sorted = useMemo(() => [...appts].sort((a, b) => toMin(a.time) - toMin(b.time)), [appts]);
  const shown = roomId ? sorted.filter((a) => itemOf(a)?.roomId === roomId) : sorted;
  const count = (list: Appt[], s: string) => list.filter((a) => a.status === s).length;
  const dur = (a: Appt) => itemOf(a)?.duration ?? 50;
  const conflictCount = shown.filter((a) => conflicts.has(a.id)).length; // 선택한 치료실 기준
  const upcoming = shown.filter((a) => a.status === "예약" && (date !== today || toMin(a.time) + dur(a) > nowMin)).slice(0, 6);

  useEffect(() => {
    if (view !== "timeline" || date !== today) return;
    const t = setTimeout(() => document.getElementById("nowline")?.scrollIntoView({ behavior: "smooth", block: "center" }), 350);
    return () => clearTimeout(t);
  }, [view, date, today, ready]);
  if (!ready) return <PageSkeleton />;

  const card = (a: Appt, i: number) => (
    <ApptCard key={a.id} a={a} patient={db.patients.find((p) => p.id === a.patientId)} item={itemOf(a)} room={roomOf(a)} conflict={conflicts.get(a.id)}
      today={today} nowMin={nowMin} me={me} onOpen={openAppt} onStatus={setStatus} showRoom={view === "timeline" || !!roomId} delay={Math.min(i, 12) * 35} />);

  return (
    <>
      <div className="toolbar">
        <h2>치료실 통합모니터링</h2>
        <span className="pill ok livepill"><i className="dot" />실시간 자동 갱신</span><span className="spacer" />
        <div className="seg" role="tablist"><button className={view === "cards" ? "on" : ""} onClick={() => setView("cards")} role="tab" aria-selected={view === "cards"}>치료실별</button>
          <button className={view === "timeline" ? "on" : ""} onClick={() => setView("timeline")} role="tab" aria-selected={view === "timeline"}>타임라인</button></div>
        {me && me.role !== "viewer" && <button className="primary desk-only" onClick={() => openAppt({ date })}><Icon name="plus" size={18} />스케줄 등록</button>}
      </div>
      <DatePicker date={date} setDate={setDate} />

      <div className="sec"><h3>치료실 현황</h3>{roomId && <button className="link" onClick={() => setRoomId("")}>필터 해제</button>}</div>
      <div className="rcards">
        {rooms.map((r, i) => {
          const list = sorted.filter((a) => itemOf(a)?.roomId === r.id); const live = list.filter((a) => a.status !== "취소");
          const done = count(list, "완료"), total = live.length, left = total - done, pct = total ? (done / total) * 100 : 0;
          return (
            <div key={r.id} className={`rcard g-${i % 2 ? "b" : "a"} ${roomId === r.id ? "sel" : ""}`} style={{ animationDelay: `${i * 60}ms` }} role="button" tabIndex={0} aria-pressed={roomId === r.id}
              onClick={() => setRoomId(roomId === r.id ? "" : r.id)} onKeyDown={(e) => { if (e.key === "Enter") setRoomId(roomId === r.id ? "" : r.id); }}>
              <div className="rc-top"><span className="rbadge">{total === 0 ? "일정 없음" : left === 0 ? "모두 완료" : `${left}건 남음`}</span>
                <PopMenu tone="on-grad" label={`${r.name} 메뉴`} items={[{ label: roomId === r.id ? "필터 해제" : "이 치료실만 보기", onClick: () => setRoomId(roomId === r.id ? "" : r.id) },
                  ...(canEditRoom(me, r.id) ? [{ label: "스케줄 추가", onClick: () => openAppt({ date, itemId: db.items.find((x) => x.roomId === r.id)?.id }) }] : [])]} /></div>
              <h4>{r.name}</h4><div className="sub">담당 {r.therapist}</div>
              <AvatarStack names={r.therapist.split("/").map((s) => s.trim())} />
              <div className="rc-foot"><div className="rc-meta"><span>진행률 {Math.round(pct)}%</span><span>{done}/{total}</span></div><ProgressBar value={pct} /></div>
            </div>);
        })}
      </div>

      <div className="sec"><h3>오늘의 요약</h3></div>
      <div className="kpis">
        <div className="kpi"><b><CountUp value={shown.length} /></b>전체</div>
        <div className="kpi s-예약"><b><CountUp value={count(shown, "예약")} /></b>예약</div>
        <div className="kpi s-완료"><b><CountUp value={count(shown, "완료")} /></b>치료완료</div>
        <div className="kpi s-취소"><b><CountUp value={count(shown, "취소")} /></b>예약취소</div>
        <div className={`kpi ${conflictCount ? "bad" : ""}`}><b><CountUp value={conflictCount} /></b>충돌</div>
      </div>

      <div className={`dash ${view === "cards" ? "has-aside" : ""}`}>
        <div>
          <div className="sec"><h3>{view === "cards" ? "치료실별 일정" : "시간대별 일정"}</h3></div>
          {view === "cards" ? (
            <div className="rooms" style={{ gridTemplateColumns: `repeat(${(roomId ? rooms.filter((r) => r.id === roomId) : rooms).length}, minmax(230px, 1fr))` }}>
              {(roomId ? rooms.filter((r) => r.id === roomId) : rooms).map((r, ri) => {
                const list = sorted.filter((a) => itemOf(a)?.roomId === r.id);
                return (
                  <section key={r.id} className="room" style={{ animationDelay: `${ri * 60}ms` }}>
                    <header><div><b><span className="dotc" style={{ background: r.color }} />{r.name}</b><small>{r.therapist}</small></div>
                      <span className="mini">{count(list, "완료")}/{list.length - count(list, "취소")}</span></header>
                    <div className="list">{list.length ? list.map((a, i) => card(a, i)) : <p className="empty">스케줄 없음</p>}</div>
                    {canEditRoom(me, r.id) && <button className="add" onClick={() => openAppt({ date, itemId: db.items.find((i) => i.roomId === r.id)?.id })}>+ 추가</button>}
                  </section>);
              })}
            </div>
          ) : (
            <Timeline shown={shown} card={card} nowMin={nowMin} isToday={date === today} />
          )}
        </div>
        {view === "cards" && (
          <aside>
            <div className="sec"><h3>다음 치료 일정</h3><button className="link" onClick={() => setView("timeline")}>전체보기</button></div>
            <div className="tlist">
              {upcoming.length === 0 && <p className="empty">남은 예약이 없습니다 🎉</p>}
              {upcoming.map((a, i) => {
                const p = db.patients.find((x) => x.id === a.patientId); const it = itemOf(a); const r = roomOf(a); const can = canEditRoom(me, r?.id);
                return (
                  <div key={a.id} className="titem" style={{ animationDelay: `${i * 50}ms` }} onClick={() => openAppt(a)}>
                    <span className={`ibox g-${i % 2 ? "b" : "a"}`}>{a.time}</span>
                    <div className="grow"><b>{p?.name}</b><small>{it?.name}{a.option && ` · ${a.option}`} · {r?.name}</small></div>
                    <PopMenu label="일정 메뉴" items={[...(can ? [{ label: "완료 처리", onClick: () => setStatus(a, "완료") }, { label: "예약 취소", danger: true, onClick: () => setStatus(a, "취소") }] : []), { label: "상세·수정", onClick: () => openAppt(a) }]} />
                  </div>);
              })}
            </div>
          </aside>
        )}
      </div>
    </>
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

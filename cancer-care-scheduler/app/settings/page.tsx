"use client";
import { useStore } from "@/lib/store";
export default function Settings() {
  const { db, ready, saveRoom, saveItem, resetDemo } = useStore();
  if (!ready) return <p>불러오는 중…</p>;
  return (
    <>
      <div className="toolbar"><h2>설정</h2>
        <button className="danger" onClick={() => { if (confirm("모든 데이터를 데모 데이터로 초기화합니다.")) resetDemo(); }}>데모 데이터로 초기화</button></div>
      <p className="hint">현재 데이터는 이 브라우저에만 저장되는 데모입니다(가상 환자). 병원 공용 사용은 DB 연동이 필요합니다.</p>
      {db.rooms.map((r) => (
        <section key={r.id} className="card">
          <div className="row"><label>치료실<input value={r.name} onChange={(e) => saveRoom({ ...r, name: e.target.value })} /></label>
            <label>담당자<input value={r.therapist} onChange={(e) => saveRoom({ ...r, therapist: e.target.value })} /></label>
            <label className="chk"><input type="checkbox" checked={r.active} onChange={(e) => saveRoom({ ...r, active: e.target.checked })} />모니터링 표시</label></div>
          {db.items.filter((i) => i.roomId === r.id).map((i) => (
            <div key={i.id} className="row sub"><label>치료항목<input value={i.name} onChange={(e) => saveItem({ ...i, name: e.target.value })} /></label>
              <label>소요(분)<input type="number" value={i.duration} onChange={(e) => saveItem({ ...i, duration: Number(e.target.value) || 0 })} /></label>
              <label>시작시간 목록(쉼표)<input value={i.slots.join(",")} onChange={(e) => saveItem({ ...i, slots: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} /></label></div>))}
        </section>))}
    </>
  );
}

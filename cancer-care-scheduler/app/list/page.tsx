"use client";
import { useMemo, useState } from "react";
import { useAppts, useStore } from "@/lib/store";
import { STATUSES } from "@/lib/types";
import { addDays, csvEscape, label, pname, todayStr, toMin } from "@/lib/util";
import { PageSkeleton } from "@/components/Ui";
import DateField from "@/components/DateField";
import { Icon } from "@/components/Icons";
import { useToast } from "@/lib/toast";

export default function ListPage() {
  const { db, ready } = useStore();
  const { toast } = useToast();
  const [from, setFrom] = useState(addDays(todayStr(), -7));
  const [to, setTo] = useState(addDays(todayStr(), 14));
  const [kw, setKw] = useState(""); const [room, setRoom] = useState(""); const [st, setSt] = useState("");
  const appts = useAppts(from, to);
  const rows = useMemo(() => appts.filter((a) => {
    if (a.date < from || a.date > to) return false;
    const it = db.items.find((i) => i.id === a.itemId); const p = db.patients.find((x) => x.id === a.patientId);
    if (room && it?.roomId !== room) return false; if (st && a.status !== st) return false;
    return !kw || `${p?.name}${it?.name}`.includes(kw);
  }).sort((a, b) => a.date.localeCompare(b.date) || toMin(a.time) - toMin(b.time)), [appts, db, from, to, kw, room, st]);
  if (!ready) return <PageSkeleton />;
  const exportCsv = () => {
    const head = ["치료일자", "시작시간", "환자(병동)", "치료실", "치료", "옵션", "상태", "비고"];
    const body = rows.map((a) => { const it = db.items.find((i) => i.id === a.itemId)!;
      return [a.date, a.time, pname(db.patients.find((p) => p.id === a.patientId)), db.rooms.find((r) => r.id === it.roomId)?.name ?? "", it.name, a.option, a.status, a.memo]; });
    const csv = "﻿" + [head, ...body].map((r) => r.map(csvEscape).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const el = document.createElement("a"); el.href = url; el.download = `치료스케줄_${from}_${to}.csv`; el.style.display = "none";
    document.body.appendChild(el); el.click(); el.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000); // 다운로드가 시작된 뒤에 임시 주소를 해제한다
    toast(`${rows.length}건을 CSV로 내보냈습니다`);
  };
  return (
    <>
      <div className="fillpage">
      <div className="toolbar"><h2>기간별 리스트</h2>
        <DateField compact ariaLabel="시작일" value={from} onChange={(v) => v && setFrom(v)} /> ~ <DateField compact ariaLabel="종료일" value={to} onChange={(v) => v && setTo(v)} />
        <select value={room} onChange={(e) => setRoom(e.target.value)}><option value="">전체 치료실</option>{db.rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
        <select value={st} onChange={(e) => setSt(e.target.value)}><option value="">전체 상태</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
        <input className="qinput" placeholder="환자·치료 검색" value={kw} onChange={(e) => setKw(e.target.value)} />
        <b>{rows.length}건</b><button className="btn-card" onClick={exportCsv}><Icon name="download" size={17} />CSV 내보내기</button></div>
      <div className="tblwrap fixhead"><table className="tbl compact"><thead><tr><th>치료일자</th><th>시간</th><th>환자(병동)</th><th>치료</th><th>옵션</th><th>상태</th></tr></thead>
        <tbody>{rows.map((a) => (<tr key={a.id}><td>{label(a.date)}</td><td>{a.time}</td><td>{pname(db.patients.find((p) => p.id === a.patientId))}</td>
          <td>{db.items.find((i) => i.id === a.itemId)?.name}</td><td>{a.option}</td><td><span className={`badge s-${a.status}`}>{a.status}</span></td></tr>))}</tbody></table></div>
      </div>
    </>
  );
}

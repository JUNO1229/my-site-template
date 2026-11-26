"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAppts, useStore } from "@/lib/store";
import { OPTIONS, OPTION_HINT, OPTION_LABEL, STATUSES } from "@/lib/types";
import { addDays, csvEscape, label, pname, todayStr, toMin } from "@/lib/util";
import { PageSkeleton } from "@/components/Ui";
import DateField from "@/components/DateField";
import { Icon } from "@/components/Icons";
import { useToast } from "@/lib/toast";

/** 여러 개를 고를 수 있는 선택 상자 (체크박스 목록) */
function MultiSelect({ label, all, options, value, onChange }: { label: string; all: string; options: { id: string; name: string }[]; value: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false); const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const off = (e: MouseEvent | KeyboardEvent) => { if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", off); document.addEventListener("keydown", off);
    return () => { document.removeEventListener("mousedown", off); document.removeEventListener("keydown", off); };
  }, [open]);
  const names = options.filter((o) => value.includes(o.id)).map((o) => o.name);
  const text = !value.length || value.length === options.length ? all : names.length <= 2 ? names.join(", ") : `${names[0]} 외 ${names.length - 1}`;
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  return (
    <div className="msel" ref={ref}>
      <button type="button" className={`msel-btn ${open ? "open" : ""}`} aria-haspopup="listbox" aria-expanded={open} aria-label={label} onClick={() => setOpen((o) => !o)}><span>{text}</span><Icon name="down" size={16} /></button>
      {open && <div className="msel-pop" role="listbox" aria-multiselectable="true">
        <label className="chk all"><input type="checkbox" checked={!value.length || value.length === options.length} onChange={() => onChange([])} />{all}</label>
        {options.map((o) => <label key={o.id} className="chk"><input type="checkbox" checked={value.includes(o.id)} onChange={() => toggle(o.id)} />{o.name}</label>)}
      </div>}
    </div>
  );
}

export default function ListPage() {
  const { db, ready } = useStore();
  const { toast } = useToast();
  const [from, setFrom] = useState(addDays(todayStr(), -7));
  const [to, setTo] = useState(addDays(todayStr(), 14));
  const [kw, setKw] = useState(""); const [roomSel, setRoomSel] = useState<string[]>([]); const [st, setSt] = useState(""); const [opt, setOpt] = useState("*");
  const appts = useAppts(from, to);
  const rows = useMemo(() => appts.filter((a) => {
    if (a.date < from || a.date > to) return false;
    const it = db.items.find((i) => i.id === a.itemId); const p = db.patients.find((x) => x.id === a.patientId);
    if (roomSel.length && !roomSel.includes(it?.roomId ?? "")) return false; if (st && a.status !== st) return false;
    if (opt !== "*" && (a.option === "J" ? "" : a.option) !== opt) return false; // 옵션 없음 = J
    return !kw || `${p?.name}${it?.name}`.includes(kw);
  }).sort((a, b) => a.date.localeCompare(b.date) || toMin(a.time) - toMin(b.time)), [appts, db, from, to, kw, roomSel, st, opt]);
  if (!ready) return <PageSkeleton />;
  const exportCsv = () => {
    const head = ["치료일자", "시작시간", "환자(병동)", "치료실", "치료", "옵션", "상태", "비고"];
    const body = rows.map((a) => { const it = db.items.find((i) => i.id === a.itemId)!;
      return [a.date, a.time, pname(db.patients.find((p) => p.id === a.patientId)), db.rooms.find((r) => r.id === it.roomId)?.name ?? "", it.name, a.option || "J", a.status, a.memo]; });
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
        <MultiSelect label="치료실 선택" all="전체 치료실" options={db.rooms.filter((r) => r.active).map((r) => ({ id: r.id, name: r.name }))} value={roomSel} onChange={setRoomSel} />
        <select value={st} onChange={(e) => setSt(e.target.value)}><option value="">전체 상태</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
        <select value={opt} aria-label="옵션 선택" onChange={(e) => setOpt(e.target.value)}><option value="*">전체 옵션</option>{OPTIONS.map((o) => <option key={o || "J"} value={o} title={OPTION_HINT[o]}>{OPTION_LABEL[o]}</option>)}</select>
        <input className="qinput" placeholder="환자·치료 검색" value={kw} onChange={(e) => setKw(e.target.value)} />
        <b>{rows.length}건</b><button className="btn-card" onClick={exportCsv}><Icon name="download" size={17} />CSV 내보내기</button></div>
      <div className="tblwrap fixhead"><table className="tbl compact listtbl"><colgroup><col style={{ width: "19%" }} /><col style={{ width: "11%" }} /><col style={{ width: "24%" }} /><col style={{ width: "24%" }} /><col style={{ width: "10%" }} /><col style={{ width: "12%" }} /></colgroup><thead><tr><th>치료일자</th><th>시간</th><th>환자(병동)</th><th>치료</th><th>옵션</th><th>상태</th></tr></thead>
        <tbody>{rows.map((a) => (<tr key={a.id}><td>{label(a.date)}</td><td>{a.time}</td><td>{pname(db.patients.find((p) => p.id === a.patientId))}</td>
          <td>{db.items.find((i) => i.id === a.itemId)?.name}</td><td>{a.option || "J"}</td><td><span className={`badge s-${a.status}`}>{a.status}</span></td></tr>))}</tbody></table></div>
      </div>
    </>
  );
}

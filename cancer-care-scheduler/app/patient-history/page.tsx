"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/Icons";
import { PageSkeleton, Skeleton } from "@/components/Ui";
import DateField from "@/components/DateField";
import { useStore } from "@/lib/store";
import { useToast } from "@/lib/toast";
import { api } from "@/lib/api";
import { cmpBed } from "@/lib/sickroom";
import { csvEscape, dow, fmtMan } from "@/lib/util";

interface SnapItem { date: string; takenAt: string; source: "cron" | "manual"; total: number; inCount: number; outCount: number; endedCount: number; amountSum: number | null; added: number | null; endedNew: number | null; changed: number | null }
interface SP { id: string; name: string; ward: string; bed: string; chartNo: string; admitDate: string; dischargeDate: string; plan: string; notes: string; contractAmount?: number | null; status: string }
type View = "in" | "out" | "ended";
const kstTime = (iso: string) => new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
const dlabel = (d: string) => `${Number(d.slice(8))}일(${dow(d)})`;

export default function PatientHistory() {
  const { me, ready } = useStore(); const { toast } = useToast();
  const [list, setList] = useState<SnapItem[] | null>(null);
  const [sel, setSel] = useState("");
  const [detail, setDetail] = useState<{ date: string; takenAt: string; source: string; patients: SP[] } | null>(null);
  const [loading, setLoading] = useState(false); const [err, setErr] = useState("");
  const [view, setView] = useState<View>("in"); const [q, setQ] = useState(""); const [busy, setBusy] = useState(false);
  const canAmount = me?.role === "admin" || me?.role === "manager";

  const load = useCallback(async (keep?: string) => {
    try { const r = await api<{ snapshots: SnapItem[] }>("/api/snapshots"); setList(r.snapshots); setSel((s) => keep || s || r.snapshots[0]?.date || ""); }
    catch (e) { setErr((e as Error).message); setList([]); }
  }, []);
  useEffect(() => { if (ready) load(); }, [ready, load]);
  useEffect(() => {
    if (!sel) { setDetail(null); return; }
    let alive = true; setLoading(true);
    api<{ date: string; takenAt: string; source: string; patients: SP[] }>(`/api/snapshots/${sel}`).then((r) => { if (alive) { setDetail(r); setErr(""); } }).catch((e) => alive && setErr(e.message)).finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [sel]);

  const item = list?.find((x) => x.date === sel);
  const groups = useMemo(() => { const g = new Map<string, SnapItem[]>(); (list ?? []).forEach((s) => g.set(s.date.slice(0, 7), [...(g.get(s.date.slice(0, 7)) ?? []), s])); return [...g.entries()]; }, [list]);
  const isEnded = (p: SP) => p.status === "discharged", isOut = (p: SP) => p.ward === "외";
  const pts = detail?.patients ?? [];
  const rows = pts.filter((p) => (view === "ended" ? isEnded(p) : !isEnded(p) && (view === "out") === isOut(p)) && (!q || p.name.includes(q) || p.chartNo.includes(q)))
    .sort((a, b) => cmpBed(a.ward === "외" && !a.bed ? "외래" : a.bed, b.ward === "외" && !b.bed ? "외래" : b.bed) || a.name.localeCompare(b.name, "ko"));
  const cnt = { in: pts.filter((p) => !isEnded(p) && !isOut(p)).length, out: pts.filter((p) => !isEnded(p) && isOut(p)).length, ended: pts.filter(isEnded).length };

  const jump = (d: string) => { if (!d) return; if (list?.some((x) => x.date === d)) setSel(d); else toast(`${d}(${dow(d)})의 기록이 없습니다`, "err"); };
  const saveNow = async () => { setBusy(true); try { const r = await api<{ date: string; total: number }>("/api/snapshots", "POST"); toast(`오늘(${r.date}) 환자명부 ${r.total}명을 저장했습니다`); await load(r.date); setSel(r.date); } catch (e) { toast((e as Error).message, "err"); } setBusy(false); };
  const exportCsv = () => {
    if (!detail) return;
    const head = ["병동", "병실", "환자명", "차트번호", "입원일", "퇴원(예정)일", ...(canAmount ? ["계약금액(만원)"] : []), "치료정보", "참고사항", "구분"];
    const body = [...pts].sort((a, b) => cmpBed(a.bed || "외래", b.bed || "외래")).map((p) => [p.ward, p.bed, p.name, p.chartNo, p.admitDate, p.dischargeDate, ...(canAmount ? [p.contractAmount == null ? "" : String(p.contractAmount)] : []), p.plan, p.notes, isEnded(p) ? "퇴원·종료" : isOut(p) ? "외래" : "재원"]);
    const csv = "﻿" + [head, ...body].map((r) => r.map(csvEscape).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); const a = document.createElement("a");
    a.href = url; a.download = `환자명부_${detail.date}.csv`; a.style.display = "none"; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast(`${detail.date} 환자명부 ${pts.length}명을 CSV로 내보냈습니다`);
  };
  if (!ready || list === null) return <PageSkeleton />;

  return (
    <div className="fillpage">
      <div className="toolbar">
        <h2>이전환자명부</h2>
        <span className="hint" style={{ margin: 0 }}>매일 24:00(한국시간)에 그날의 환자명부가 자동 저장됩니다</span>
        <span className="spacer" />
        <DateField compact value={sel} onChange={jump} ariaLabel="날짜로 이동" placeholder="날짜로 이동" />
        {me?.role === "admin" && <button className="btn-card" disabled={busy} onClick={saveNow}><Icon name="history" size={17} />{busy ? "저장 중…" : "오늘 현황 지금 저장"}</button>}
      </div>
      {list.length === 0 ? (
        <div className="card"><p className="empty" style={{ margin: "30px 0" }}>아직 저장된 기록이 없습니다.<br />오늘 밤 24:00부터 매일 자동으로 저장되고, 이곳에서 날짜별로 확인할 수 있습니다.</p></div>
      ) : (
        <div className="hgrid">
          <aside className="snaplist card" aria-label="저장된 날짜 목록">
            {groups.map(([ym, items]) => (
              <section key={ym}><h4>{ym.slice(0, 4)}년 {Number(ym.slice(5))}월</h4>
                {items.map((s) => (
                  <button key={s.date} className={`snapitem ${s.date === sel ? "on" : ""}`} onClick={() => setSel(s.date)} aria-pressed={s.date === sel}>
                    <b>{dlabel(s.date)}</b><span className="sn-c">재원 {s.inCount} · 외래 {s.outCount}</span>
                    <span className="sn-d">{s.added === null ? "첫 기록" : [s.added ? `신규 ${s.added}` : "", s.endedNew ? `퇴원 ${s.endedNew}` : "", s.changed ? `변경 ${s.changed}` : ""].filter(Boolean).join(" · ") || "변동 없음"}{s.source === "manual" && " · 수동"}</span>
                  </button>))}
              </section>))}
          </aside>
          <div className="hmain">
            <div className="hhead">
              <div><b className="hdate">{sel ? `${Number(sel.slice(5, 7))}월 ${Number(sel.slice(8))}일(${dow(sel)}) 환자명부` : "환자명부"}</b>
                <small>{detail ? `${sel} 기준 · ${kstTime(detail.takenAt)} ${detail.source === "manual" ? "수동 저장" : "자동 저장"}(한국시간) · 전체 ${pts.length}명` : ""}</small></div>
              <span className="spacer" />
              <button className="btn-card" onClick={exportCsv} disabled={!detail}><Icon name="download" size={17} />CSV 내보내기</button>
            </div>
            <div className="toolbar" style={{ margin: "0 0 12px" }}>
              <div className="seg" role="tablist">{([["in", "재원", cnt.in], ["out", "외래", cnt.out], ["ended", "퇴원·종료", cnt.ended]] as const).map(([k, t, n]) =>
                <button key={k} className={view === k ? "on" : ""} role="tab" aria-selected={view === k} onClick={() => setView(k)}>{t} {n}</button>)}</div>
              {canAmount && item?.amountSum != null && <div className="sumbox" title={`${sel} 기준 재원+외래 계약금액 합계 ${item.amountSum.toLocaleString("ko-KR")}만원`}><small>계약금액 합계액</small><b>{fmtMan(item.amountSum)}</b></div>}
              <span className="qwrap"><Icon name="search" size={16} /><input className="qinput" placeholder="이름·차트번호 검색" value={q} onChange={(e) => setQ(e.target.value)} /></span>
            </div>
            {err && <p className="err">{err}</p>}
            <div className="tblwrap fixhead">
              {loading && !detail ? <div style={{ padding: 20 }}><Skeleton h={30} /><br /><Skeleton h={30} /><br /><Skeleton h={30} /></div> : (
                <table className="tbl compact"><thead><tr><th>병동</th><th>병실</th><th>환자명</th><th>차트번호</th><th>입원일</th><th>{view === "ended" ? "퇴원·종료일" : "퇴원예정"}</th>{canAmount && <th>계약금액</th>}<th>치료정보</th><th>참고사항</th></tr></thead>
                  <tbody>{rows.map((p) => (
                    <tr key={p.id} className={isEnded(p) ? "ended" : ""}><td>{p.ward}</td><td>{p.ward === "외" && !p.bed ? "외래" : p.bed}</td><td>{p.name}</td><td>{p.chartNo}</td><td>{p.admitDate}</td><td>{p.dischargeDate}</td>
                      {canAmount && <td style={{ textAlign: "right" }}>{p.contractAmount != null ? `${p.contractAmount.toLocaleString("ko-KR")}만원` : ""}</td>}
                      <td className="plan">{p.plan}</td><td className="notes">{p.notes}</td></tr>))}</tbody></table>)}
              {!loading && rows.length === 0 && <p className="empty">해당하는 환자가 없습니다</p>}
            </div>
          </div>
        </div>)}
    </div>
  );
}

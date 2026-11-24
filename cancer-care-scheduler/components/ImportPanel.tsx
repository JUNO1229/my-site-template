"use client";
import { useState } from "react";
import { analyze, type ImportPlan } from "@/lib/importer";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";

const chunk = <T,>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

export default function ImportPanel() {
  const { db, refresh } = useStore();
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [wipe, setWipe] = useState(false);
  const [busy, setBusy] = useState(false); const [log, setLog] = useState<string[]>([]); const [err, setErr] = useState("");
  const say = (m: string) => setLog((l) => [...l, m]);

  const pick = async (fl: FileList | null) => {
    setErr(""); setLog([]); setPlan(null);
    if (!fl?.length) return;
    const files = await Promise.all([...fl].map(async (f) => ({ name: f.name, text: await f.text() })));
    setPlan(analyze(files));
  };
  const run = async () => {
    if (!plan) return;
    if (wipe && !confirm("현재 등록된 환자·스케줄(데모 포함)을 모두 삭제한 뒤 가져옵니다. 계속할까요?")) return;
    setBusy(true); setErr(""); setLog([]);
    try {
      if (wipe) { await api("/api/admin/data", "POST", { action: "clear" }); say("기존 환자·스케줄 삭제 완료"); }
      let ins = 0, upd = 0;
      for (const c of chunk(plan.patients, 500)) { const r = await api<{ inserted: number; updated: number }>("/api/admin/import", "POST", { kind: "patients", rows: c }); ins += r.inserted; upd += r.updated; }
      if (plan.patients.length) say(`환자명부: 신규 ${ins}명, 갱신 ${upd}명`);
      let st = 0;
      for (const c of chunk(plan.stubs, 500)) st += (await api<{ inserted: number }>("/api/admin/import", "POST", { kind: "stubs", rows: c })).inserted;
      if (plan.stubs.length) say(`명부에 없는 환자 ${st}명을 스케줄 기록에서 생성`);
      let a = 0, sk = 0; const parts = chunk(plan.appts, 1500);
      for (let i = 0; i < parts.length; i++) {
        const r = await api<{ inserted: number; skipped: number }>("/api/admin/import", "POST", { kind: "appts", rows: parts[i] }); a += r.inserted; sk += r.skipped;
        say(`스케줄 ${Math.min((i + 1) * 1500, plan.appts.length)} / ${plan.appts.length} 처리 중…`);
      }
      say(`스케줄: 신규 ${a}건, 이미 있어 건너뜀 ${sk}건`);
      await api("/api/admin/import", "PUT", { summary: `환자 ${ins}+${upd}, 명부외 환자 ${st}, 스케줄 ${a}(건너뜀 ${sk}) 파일 ${plan.files.map((f) => f.name).join(",")}` });
      await refresh(); say("✅ 가져오기 완료");
    } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  };
  const skipped = plan ? Object.entries(plan.skipped) : []; const unk = plan ? Object.entries(plan.unknownTreat) : [];
  return (
    <div className="card">
      <h3 style={{ margin: 0 }}>구글 시트에서 가져오기</h3>
      <ol className="hint" style={{ margin: 0, paddingLeft: 18 }}>
        <li>구글 시트에서 <b>환자명부 탭</b>과 <b>치료스케줄관리 탭</b>을 각각 열고 <b>파일 → 다운로드 → 쉼표로 구분된 값(.csv)</b>으로 저장합니다. (치료실별 파일이 여러 개면 각 파일의 스케줄 탭을 모두 저장)</li>
        <li>저장한 CSV 파일을 <b>한꺼번에 선택</b>하면 종류(환자명부/스케줄)를 자동으로 구분합니다. 나눠서 올려도 기존 데이터에 이어서 추가됩니다(삭제 체크가 꺼져 있을 때).</li>
        <li>아래 미리보기를 확인하고 "가져오기 실행"을 누릅니다. 같은 파일을 다시 올려도 중복 등록되지 않습니다.</li>
      </ol>
      <input type="file" accept=".csv,text/csv" multiple onChange={(e) => pick(e.target.files)} disabled={busy} />
      {plan && (<>
        <table className="tbl"><thead><tr><th>파일</th><th>종류</th><th>읽은 행</th></tr></thead>
          <tbody>{plan.files.map((f, i) => <tr key={i}><td>{f.name}</td><td>{f.kind}</td><td>{f.rows}</td></tr>)}</tbody></table>
        <div className="kpis">
          <div className="kpi"><b>{plan.patients.length}</b>환자명부</div>
          <div className="kpi"><b>{plan.stubs.length}</b>명부에 없는 환자</div>
          <div className="kpi"><b>{plan.appts.length}</b>스케줄</div>
          <div className="kpi">{plan.range ? `${plan.range[0]} ~ ${plan.range[1]}` : "-"}</div>
        </div>
        {unk.length > 0 && <p className="err">인식하지 못한 치료명(제외됨): {unk.map(([k, v]) => `${k} ${v}건`).join(", ")}</p>}
        {skipped.length > 0 && <p className="hint">제외: {skipped.map(([k, v]) => `${k} ${v}건`).join(", ")}</p>}
        <label className="chk"><input type="checkbox" checked={wipe} onChange={(e) => setWipe(e.target.checked)} />⚠ 가져오기 전에 현재 환자·스케줄을 모두 삭제 (현재 {db.patients.length}명). 파일을 하나씩 나눠 올릴 때는 켜지 마세요 — 앞서 올린 데이터가 지워집니다.</label>
        <button className="primary" disabled={busy || !(plan.patients.length + plan.appts.length)} onClick={run}>{busy ? "가져오는 중…" : "가져오기 실행"}</button>
      </>)}
      {err && <p className="err">{err}</p>}
      {log.map((l, i) => <div key={i} className={l.startsWith("✅") ? "ok" : "hint"}>{l}</div>)}
    </div>
  );
}

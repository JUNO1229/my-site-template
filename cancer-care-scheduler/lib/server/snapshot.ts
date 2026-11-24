/* eslint-disable @typescript-eslint/no-explicit-any */
import { q } from "./db";

export interface SnapPatient { id: string; name: string; ward: string; bed: string; chartNo: string; admitDate: string; dischargeDate: string; plan: string; notes: string; contractAmount: number | null; status: string }
const toSnap = (r: any): SnapPatient => ({ id: r.id, name: r.name, ward: r.ward, bed: r.bed, chartNo: r.chart_no, admitDate: r.admit_date, dischargeDate: r.discharge_date, plan: r.plan, notes: r.notes, contractAmount: r.contract_amount, status: r.status });
const KEYS: (keyof SnapPatient)[] = ["name", "ward", "bed", "chartNo", "admitDate", "dischargeDate", "plan", "notes", "contractAmount", "status"];

/** 지정한 날짜 기준으로 환자명부(자동 생성 환자 제외)를 저장한다. 같은 날짜가 있으면 덮어쓴다. */
export async function takeSnapshot(date: string, source: "cron" | "manual") {
  const rows = (await q("SELECT * FROM patients WHERE source<>'auto' ORDER BY name")).map(toSnap);
  const ended = rows.filter((p) => p.status === "discharged");
  const cur = rows.filter((p) => p.status !== "discharged");
  const out = cur.filter((p) => p.ward === "외"), inn = cur.filter((p) => p.ward !== "외");
  const amount = cur.reduce((s, p) => s + (p.contractAmount ?? 0), 0);
  // 직전 기록과 비교해 변동 건수 계산
  const prev = (await q("SELECT data FROM patient_snapshots WHERE snap_date<$1 ORDER BY snap_date DESC LIMIT 1", [date]))[0];
  let added: number | null = null, endedNew: number | null = null, changed: number | null = null;
  if (prev) {
    const pm = new Map<string, SnapPatient>((prev.data as SnapPatient[]).map((p) => [p.id, p]));
    added = 0; endedNew = 0; changed = 0;
    for (const p of rows) {
      const o = pm.get(p.id);
      if (!o) { added++; continue; }
      if (o.status !== "discharged" && p.status === "discharged") endedNew++;
      else if (KEYS.some((k) => o[k] !== p[k])) changed++;
    }
  }
  await q(`INSERT INTO patient_snapshots(snap_date,taken_at,source,total,in_cnt,out_cnt,ended_cnt,amount_sum,added,ended_new,changed,data)
    VALUES($1,now(),$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)
    ON CONFLICT (snap_date) DO UPDATE SET taken_at=now(),source=EXCLUDED.source,total=EXCLUDED.total,in_cnt=EXCLUDED.in_cnt,out_cnt=EXCLUDED.out_cnt,
      ended_cnt=EXCLUDED.ended_cnt,amount_sum=EXCLUDED.amount_sum,added=EXCLUDED.added,ended_new=EXCLUDED.ended_new,changed=EXCLUDED.changed,data=EXCLUDED.data`,
    [date, source, rows.length, inn.length, out.length, ended.length, amount, added, endedNew, changed, JSON.stringify(rows)]);
  return { date, total: rows.length, in: inn.length, out: out.length, ended: ended.length };
}

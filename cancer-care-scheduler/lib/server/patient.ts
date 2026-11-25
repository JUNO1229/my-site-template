import { isDate, need, str, WARDS } from "./validate";

export function validPatient(b: Record<string, unknown>) {
  const name = str(b.name, 50); need(name, "환자명을 입력해 주세요");
  const ward = str(b.ward); need(WARDS.includes(ward), "병동이 올바르지 않습니다");
  const d = (v: unknown) => { const s = str(v); need(!s || isDate(s), "날짜 형식이 올바르지 않습니다"); return s; };
  const amt = b.contractAmount === null || b.contractAmount === "" || b.contractAmount === undefined ? null : Number(b.contractAmount);
  need(amt === null || (Number.isInteger(amt) && amt >= 0 && amt <= 2000000000), "계약금액은 0 이상의 정수여야 합니다");
  return { contractAmount: amt, name, ward, chartNo: str(b.chartNo, 30), bed: str(b.bed, 20), admit: d(b.admitDate), discharge: d(b.dischargeDate), plan: str(b.plan, 500), notes: str(b.notes, 500) };
}

import { q } from "./db";
import { HttpError } from "./auth";

/** 임시 환자(source='temp')의 스케줄을 실제 환자로 옮기고 임시 환자를 삭제한다. */
export async function mergeTemp(tempId: string, realId: string) {
  const t = (await q("SELECT id,name,source FROM patients WHERE id=$1", [tempId]))[0];
  if (!t || t.source !== "temp") throw new HttpError(400, "임시 환자만 합칠 수 있습니다");
  const r = (await q("SELECT id,source FROM patients WHERE id=$1", [realId]))[0];
  if (!r || r.source === "temp" || r.source === "auto") throw new HttpError(400, "합칠 대상은 환자명부에 등록된 환자여야 합니다");
  const moved = await q("WITH u AS (UPDATE appts SET patient_id=$2,updated_at=now() WHERE patient_id=$1 RETURNING 1) SELECT count(*)::int AS n FROM u", [tempId, realId]);
  await q("DELETE FROM patients WHERE id=$1 AND source='temp'", [tempId]);
  return { moved: moved[0].n as number, name: t.name as string };
}
/** 환자명부에 같은 이름의 환자가 (정확히 1명) 등록되면 같은 이름의 임시 환자를 자동으로 합친다. */
export async function adoptTemps() {
  const pairs = await q(`SELECT t.id AS tid, (array_agg(r.id))[1] AS rid FROM patients t JOIN patients r ON r.name=t.name AND r.source='registry'
    WHERE t.source='temp' GROUP BY t.id HAVING count(r.id)=1`);
  let moved = 0, n = 0;
  for (const p of pairs) { const m = await mergeTemp(p.tid, p.rid); moved += m.moved; n++; }
  return { merged: n, moved };
}

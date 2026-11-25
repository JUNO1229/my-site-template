import { audit, body, HttpError, route } from "@/lib/server/auth";
import { q } from "@/lib/server/db";
import { makeSeed } from "@/lib/seed";
import { backupBefore, restoreBackup } from "@/lib/server/backup";

function kstNow() {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date());
  const g = (t: string) => f.find((p) => p.type === t)!.value;
  return { today: `${g("year")}-${g("month")}-${g("day")}`, nowMin: Number(g("hour")) % 24 * 60 + Number(g("minute")) };
}
export const dynamic = "force-dynamic";
/** 삭제 직전 자동 백업 목록 (최근 10개) */
export const GET = route(async () => {
  const rows = await q("SELECT id,created_at,reason,created_by,n_patients,n_appts FROM data_backups ORDER BY id DESC");
  return { backups: rows.map((r) => ({ id: Number(r.id), createdAt: r.created_at, reason: r.reason, by: r.created_by, patients: r.n_patients, appts: r.n_appts })) };
}, { roles: ["admin"] });

export const POST = route(async (req, _c, me) => {
  const b = await body(req);
  if (b.action === "restore") {
    if (b.confirm !== "복원") throw new HttpError(400, "확인 문구가 올바르지 않습니다");
    await backupBefore("복원 직전 자동 백업", me.username);
    if (!(await restoreBackup(Number(b.id)))) throw new HttpError(404, "백업을 찾을 수 없습니다");
    await audit(me.username, "data_restore", `backup#${Number(b.id)}`); return { ok: true };
  }
  if (b.action === "purge_auto" || b.action === "demo" || b.action === "clear") {
    // 되돌릴 수 없는 작업이므로 확인 문구가 없으면 서버가 거절하고, 실행 직전에 전체를 백업한다
    if (b.confirm !== "삭제") throw new HttpError(400, "확인 문구('삭제')가 올바르지 않습니다");
    await backupBefore(b.action === "clear" ? "전체 삭제 직전" : b.action === "demo" ? "데모 교체 직전" : "자동 생성 환자 정리 직전", me.username);
  }
  if (b.action === "purge_auto") {
    const r = await q("WITH d AS (DELETE FROM patients WHERE source='auto' RETURNING 1) SELECT count(*)::int AS n FROM d");
    await audit(me.username, "data_purge_auto", `${r[0].n}명`); return { deleted: r[0].n };
  }
  if (b.action !== "demo" && b.action !== "clear") throw new HttpError(400, "잘못된 요청입니다");
  await q("DELETE FROM appts"); await q("DELETE FROM patients");
  if (b.action === "demo") {
    const { today, nowMin } = kstNow(); const s = makeSeed(today, nowMin);
    await q(`INSERT INTO patients(id,chart_no,name,ward,bed,admit_date,discharge_date,plan,notes,contract_amount)
      SELECT id,chart_no,name,ward,bed,admit_date,discharge_date,plan,notes,contract_amount FROM json_populate_recordset(null::patients,$1::json)`,
      [JSON.stringify(s.patients.map((p) => ({ id: p.id, chart_no: p.chartNo, name: p.name, ward: p.ward, bed: p.bed, admit_date: p.admitDate, discharge_date: p.dischargeDate, plan: p.plan, notes: p.notes, contract_amount: p.contractAmount })))]);
    await q(`INSERT INTO appts(id,patient_id,appt_date,appt_time,item_id,opt,status,memo)
      SELECT id,patient_id,appt_date,appt_time,item_id,opt,status,memo FROM json_populate_recordset(null::appts,$1::json)`,
      [JSON.stringify(s.appts.map((a) => ({ id: a.id, patient_id: a.patientId, appt_date: a.date, appt_time: a.time, item_id: a.itemId, opt: a.option, status: a.status, memo: a.memo })))]);
  }
  await audit(me.username, `data_${b.action}`);
}, { roles: ["admin"] });

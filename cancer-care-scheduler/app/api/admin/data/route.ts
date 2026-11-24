import { audit, body, HttpError, route } from "@/lib/server/auth";
import { q } from "@/lib/server/db";
import { makeSeed } from "@/lib/seed";

function kstNow() {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date());
  const g = (t: string) => f.find((p) => p.type === t)!.value;
  return { today: `${g("year")}-${g("month")}-${g("day")}`, nowMin: Number(g("hour")) % 24 * 60 + Number(g("minute")) };
}
export const POST = route(async (req, _c, me) => {
  const b = await body(req);
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

import { audit, body, HttpError, route } from "@/lib/server/auth";
import { q } from "@/lib/server/db";
import { mAppt } from "@/lib/server/map";
import { isDate, need } from "@/lib/server/validate";
import { checkConflicts, validAppt } from "@/lib/server/appt";
import crypto from "node:crypto";

export const dynamic = "force-dynamic";
export const GET = route(async (req) => {
  const u = new URL(req.url); const from = u.searchParams.get("from"), to = u.searchParams.get("to"), pid = u.searchParams.get("patientId");
  need(isDate(from) && isDate(to), "기간이 올바르지 않습니다");
  if ((Date.parse(to!) - Date.parse(from!)) / 86400000 > 400) throw new HttpError(400, "조회 기간이 너무 깁니다(최대 400일)");
  const rows = pid
    ? await q("SELECT * FROM appts WHERE appt_date BETWEEN $1 AND $2 AND patient_id=$3 ORDER BY appt_date,appt_time", [from, to, pid])
    : await q("SELECT * FROM appts WHERE appt_date BETWEEN $1 AND $2 ORDER BY appt_date,appt_time", [from, to]);
  return { appts: rows.map(mAppt) };
});

export const POST = route(async (req, _c, me) => {
  const b = await body(req); const v = await validAppt(b, me); const id = crypto.randomUUID();
  const forced = await checkConflicts(v, undefined, me, b.force === true);
  await q("INSERT INTO appts(id,patient_id,appt_date,appt_time,item_id,opt,status,memo,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
    [id, v.patientId, v.date, v.time, v.itemId, v.opt, v.status, v.memo, me.username]);
  await audit(me.username, "appt_create", `${v.date} ${v.time} ${v.itemId} patient=${v.patientId}${forced ? " (중복·정원 예외 등록)" : ""}`);
  return { id };
}, { roles: ["admin", "manager", "therapist"] });

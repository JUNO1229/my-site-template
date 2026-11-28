import { audit, body, HttpError, route } from "@/lib/server/auth";
import { q } from "@/lib/server/db";
import { canEditRoom } from "@/lib/perm";
import { checkConflicts } from "@/lib/server/appt";
import { isDate, isTime, need, OPTS, str } from "@/lib/server/validate";
import crypto from "node:crypto";

/** 연기 후 다른 날로 옮기기 — 원래 일정은 '연기'로 남기고, 같은 환자·치료로 새 날짜에 예약을 만든다 */
export const POST = route(async (req, ctx, me) => {
  const { id } = await ctx.params; const b = await body(req);
  const old = (await q("SELECT a.*,i.room_id FROM appts a JOIN items i ON i.id=a.item_id WHERE a.id=$1", [id]))[0];
  if (!old) throw new HttpError(404, "스케줄을 찾을 수 없습니다");
  if (!canEditRoom(me, old.room_id)) throw new HttpError(403, "이 치료실의 스케줄을 수정할 권한이 없습니다");
  if (old.status === "완료" || old.status === "취소") throw new HttpError(400, "완료·취소된 일정은 옮길 수 없습니다");
  if (old.status === "연기" && /로 옮김/.test(old.memo ?? "")) throw new HttpError(400, "이미 다른 날로 옮긴 일정입니다. 옮겨진 새 일정을 수정해 주세요");
  need(isDate(b.date) && isTime(b.time), "날짜/시간이 올바르지 않습니다");
  const date = b.date as string, time = b.time as string;
  if (date === old.appt_date && time === old.appt_time) throw new HttpError(400, "원래 일정과 같은 날짜·시간입니다");
  let opt = str(b.option); if (opt === "J") opt = ""; if (opt === "무료") opt = "기타"; need(OPTS.includes(opt), "옵션이 올바르지 않습니다");
  const forced = await checkConflicts({ date, time, patientId: old.patient_id, itemId: old.item_id, status: "예약" }, id, me, b.force === true);
  const nid = crypto.randomUUID(); const mmdd = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8))}`;
  await q("INSERT INTO appts(id,patient_id,appt_date,appt_time,item_id,opt,status,memo,created_by) VALUES($1,$2,$3,$4,$5,$6,'예약',$7,$8)",
    [nid, old.patient_id, date, time, old.item_id, opt, `${mmdd(old.appt_date)} ${old.appt_time}에서 연기`.slice(0, 300), me.username]);
  await q("UPDATE appts SET status='연기', memo=$2, updated_at=now() WHERE id=$1", [id, [old.memo, `→ ${mmdd(date)} ${time}로 옮김`].filter(Boolean).join(" ").slice(0, 300)]);
  await audit(me.username, "appt_move", `${id} ${old.appt_date} ${old.appt_time} → ${date} ${time}${forced ? " (겹친 채 등록)" : ""}`);
  return { id: nid };
}, { roles: ["admin", "manager", "therapist"] });

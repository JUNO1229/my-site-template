import { audit, body, HttpError, route } from "@/lib/server/auth";
import { q } from "@/lib/server/db";
import { canEditRoom } from "@/lib/perm";
import { validAppt } from "@/lib/server/appt";

async function existingRoom(id: string) {
  const r = (await q("SELECT i.room_id FROM appts a JOIN items i ON i.id=a.item_id WHERE a.id=$1", [id]))[0];
  if (!r) throw new HttpError(404, "스케줄을 찾을 수 없습니다");
  return r.room_id as string;
}
export const PUT = route(async (req, ctx, me) => {
  const { id } = await ctx.params;
  if (!canEditRoom(me, await existingRoom(id))) throw new HttpError(403, "이 치료실의 스케줄을 수정할 권한이 없습니다");
  const v = await validAppt(await body(req), me);
  await q("UPDATE appts SET patient_id=$2,appt_date=$3,appt_time=$4,item_id=$5,opt=$6,status=$7,memo=$8,updated_at=now() WHERE id=$1",
    [id, v.patientId, v.date, v.time, v.itemId, v.opt, v.status, v.memo]);
  await audit(me.username, "appt_update", `${id} ${v.date} ${v.time} ${v.status}`);
}, { roles: ["admin", "manager", "therapist"] });
export const DELETE = route(async (_r, ctx, me) => {
  const { id } = await ctx.params;
  if (!canEditRoom(me, await existingRoom(id))) throw new HttpError(403, "이 치료실의 스케줄을 삭제할 권한이 없습니다");
  await q("DELETE FROM appts WHERE id=$1", [id]);
  await audit(me.username, "appt_delete", id);
}, { roles: ["admin", "manager", "therapist"] });

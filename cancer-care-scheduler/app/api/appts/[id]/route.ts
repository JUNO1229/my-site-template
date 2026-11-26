import { audit, body, HttpError, route } from "@/lib/server/auth";
import { q } from "@/lib/server/db";
import { canEditRoom } from "@/lib/perm";
import { checkConflicts, validAppt } from "@/lib/server/appt";

async function existingRoom(id: string) {
  const r = (await q("SELECT i.room_id FROM appts a JOIN items i ON i.id=a.item_id WHERE a.id=$1", [id]))[0];
  if (!r) throw new HttpError(404, "스케줄을 찾을 수 없습니다");
  return r.room_id as string;
}
export const PUT = route(async (req, ctx, me) => {
  const { id } = await ctx.params;
  if (!canEditRoom(me, await existingRoom(id))) throw new HttpError(403, "이 치료실의 스케줄을 수정할 권한이 없습니다");
  const b = await body(req); const v = await validAppt(b, me);
  // 날짜·시간·치료·환자가 바뀌거나 취소를 되돌릴 때만 검사 (이미 겹쳐 있는 기존 일정의 상태 변경은 막지 않는다)
  const old = (await q("SELECT patient_id,appt_date,appt_time,item_id,status FROM appts WHERE id=$1", [id]))[0];
  const moved = old.patient_id !== v.patientId || old.appt_date !== v.date || old.appt_time !== v.time || old.item_id !== v.itemId || (old.status === "취소" && v.status !== "취소");
  const forced = moved ? await checkConflicts(v, id, me, b.force === true) : false;
  await q("UPDATE appts SET patient_id=$2,appt_date=$3,appt_time=$4,item_id=$5,opt=$6,status=$7,memo=$8,updated_at=now() WHERE id=$1",
    [id, v.patientId, v.date, v.time, v.itemId, v.opt, v.status, v.memo]);
  await audit(me.username, "appt_update", `${id} ${v.date} ${v.time} ${v.status}${forced ? " (겹친 채 등록)" : ""}`);
}, { roles: ["admin", "manager", "therapist"] });
export const DELETE = route(async (_r, ctx, me) => {
  const { id } = await ctx.params;
  if (!canEditRoom(me, await existingRoom(id))) throw new HttpError(403, "이 치료실의 스케줄을 삭제할 권한이 없습니다");
  await q("DELETE FROM appts WHERE id=$1", [id]);
  await audit(me.username, "appt_delete", id);
}, { roles: ["admin", "manager", "therapist"] });

import { HttpError } from "./auth";
import { q } from "./db";
import { isDate, isTime, need, OPTS, STATUS, str } from "./validate";
import { canEditRoom, type Me } from "../perm";

export async function validAppt(b: Record<string, unknown>, me: Me) {
  need(isDate(b.date) && isTime(b.time), "날짜/시간이 올바르지 않습니다");
  need(typeof b.patientId === "string" && typeof b.itemId === "string", "환자와 치료를 선택해 주세요");
  const status = str(b.status) || "예약", opt = str(b.option);
  need(STATUS.includes(status) && OPTS.includes(opt), "상태/옵션이 올바르지 않습니다");
  const item = (await q("SELECT room_id FROM items WHERE id=$1", [b.itemId]))[0];
  need(item, "치료항목이 없습니다");
  need((await q("SELECT 1 FROM patients WHERE id=$1", [b.patientId])).length, "환자가 없습니다");
  if (!canEditRoom(me, item.room_id)) throw new HttpError(403, "이 치료실의 스케줄을 수정할 권한이 없습니다");
  return { date: b.date as string, time: b.time as string, patientId: b.patientId as string, itemId: b.itemId as string, status, opt, memo: str(b.memo, 300) };
}

import { audit, body, HttpError, route } from "@/lib/server/auth";
import { q } from "@/lib/server/db";
import { isDate } from "@/lib/server/validate";

/** 퇴원/종료 처리 또는 복귀. 퇴원/종료일(discharge_date)은 처리일로 기록한다. */
export const PUT = route(async (req, ctx, me) => {
  const { id } = await ctx.params; const b = await body(req);
  const status = b.status === "discharged" ? "discharged" : b.status === "active" ? "active" : "";
  if (!status) throw new HttpError(400, "잘못된 요청입니다");
  const date = typeof b.date === "string" ? b.date : "";
  if (status === "discharged" && !isDate(date)) throw new HttpError(400, "퇴원/종료일을 입력해 주세요");
  const r = await q("UPDATE patients SET status=$2, discharge_date=$3 WHERE id=$1 RETURNING name", [id, status, status === "discharged" ? date : ""]);
  if (!r.length) throw new HttpError(404, "환자를 찾을 수 없습니다");
  await audit(me.username, status === "discharged" ? "patient_discharge" : "patient_restore", `${id} ${date}`);
}, { roles: ["admin", "manager"] });

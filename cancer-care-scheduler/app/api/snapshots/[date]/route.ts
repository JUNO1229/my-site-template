import { HttpError, route } from "@/lib/server/auth";
import { q } from "@/lib/server/db";
import type { SnapPatient } from "@/lib/server/snapshot";

export const dynamic = "force-dynamic";
/** 특정 일자의 환자명부. 계약금액은 관리자·상담실장에게만 제공 */
export const GET = route(async (_r, ctx, me) => {
  const { date } = await ctx.params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new HttpError(400, "날짜 형식이 올바르지 않습니다");
  const r = (await q("SELECT snap_date,taken_at,source,data FROM patient_snapshots WHERE snap_date=$1", [date]))[0];
  if (!r) throw new HttpError(404, "해당 날짜의 기록이 없습니다");
  const canAmount = me.role === "admin" || me.role === "manager";
  const patients = (r.data as SnapPatient[]).map((p) => (canAmount ? p : { ...p, contractAmount: undefined }));
  return { date: r.snap_date, takenAt: r.taken_at, source: r.source, patients };
});

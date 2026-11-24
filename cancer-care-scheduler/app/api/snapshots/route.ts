import { audit, route } from "@/lib/server/auth";
import { q } from "@/lib/server/db";
import { kst } from "@/lib/server/kst";
import { takeSnapshot } from "@/lib/server/snapshot";

export const dynamic = "force-dynamic";
/** 저장된 일자 목록(최신순) */
export const GET = route(async (_r, _c, me) => {
  const rows = await q("SELECT snap_date,taken_at,source,total,in_cnt,out_cnt,ended_cnt,amount_sum,added,ended_new,changed FROM patient_snapshots ORDER BY snap_date DESC LIMIT 800");
  const canAmount = me.role === "admin" || me.role === "manager";
  return { snapshots: rows.map((r) => ({ date: r.snap_date, takenAt: r.taken_at, source: r.source, total: r.total, inCount: r.in_cnt, outCount: r.out_cnt, endedCount: r.ended_cnt,
    amountSum: canAmount ? Number(r.amount_sum) : null, added: r.added, endedNew: r.ended_new, changed: r.changed })) };
});
/** 관리자가 오늘 현황을 지금 저장(같은 날짜는 24:00 자동 저장 때 최종본으로 덮어씀) */
export const POST = route(async (_r, _c, me) => {
  const r = await takeSnapshot(kst().date, "manual");
  await audit(me.username, "snapshot_manual", `${r.date} 총 ${r.total}명`);
  return { ok: true, ...r };
}, { roles: ["admin"] });

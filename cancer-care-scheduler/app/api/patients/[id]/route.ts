import { audit, body, route } from "@/lib/server/auth";
import { q } from "@/lib/server/db";
import { validPatient } from "@/lib/server/patient";

export const PUT = route(async (req, ctx, me) => {
  const { id } = await ctx.params; const v = validPatient(await body(req));
  await q("UPDATE patients SET chart_no=$2,name=$3,ward=$4,bed=$5,admit_date=$6,discharge_date=$7,plan=$8,notes=$9,contract_amount=$10,source=CASE WHEN source='temp' THEN 'registry' ELSE source END WHERE id=$1",
    [id, v.chartNo, v.name, v.ward, v.bed, v.admit, v.discharge, v.plan, v.notes, v.contractAmount]);
  await audit(me.username, "patient_update", id);
}, { roles: ["admin", "manager"] });
export const DELETE = route(async (_r, ctx, me) => {
  const { id } = await ctx.params;
  const p = (await q("SELECT name,ward,chart_no,(SELECT count(*)::int FROM appts WHERE patient_id=$1) AS n FROM patients WHERE id=$1", [id]))[0];
  await q("DELETE FROM patients WHERE id=$1", [id]);
  await audit(me.username, "patient_delete", p ? `${p.name}(${p.ward}) 차트${p.chart_no || "-"} · 스케줄 ${p.n}건 함께 삭제` : id);
}, { roles: ["admin"] });

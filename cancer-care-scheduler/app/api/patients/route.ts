import { audit, body, route } from "@/lib/server/auth";
import { q } from "@/lib/server/db";
import { adoptTemps, validPatient } from "@/lib/server/patient";
import crypto from "node:crypto";

export const POST = route(async (req, _c, me) => {
  const v = validPatient(await body(req)); const id = crypto.randomUUID();
  await q("INSERT INTO patients(id,chart_no,name,ward,bed,admit_date,discharge_date,plan,notes,contract_amount) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
    [id, v.chartNo, v.name, v.ward, v.bed, v.admit, v.discharge, v.plan, v.notes, v.contractAmount]);
  await audit(me.username, "patient_create", id);
  const a = await adoptTemps(); // 같은 이름의 임시 환자가 있으면 스케줄을 옮겨 합친다
  if (a.merged) await audit(me.username, "patient_temp_adopt", `임시 환자 ${a.merged}명 합침 · 스케줄 ${a.moved}건 이동`);
  return { id, merged: a.merged, moved: a.moved };
}, { roles: ["admin", "manager"] });

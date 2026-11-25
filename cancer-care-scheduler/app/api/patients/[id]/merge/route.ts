import { audit, body, route } from "@/lib/server/auth";
import { mergeTemp } from "@/lib/server/patient";
import { str } from "@/lib/server/validate";

/** 임시 환자를 실제 환자로 합친다 (스케줄 이동 후 임시 환자 삭제) */
export const POST = route(async (req, ctx, me) => {
  const { id } = await ctx.params; const target = str((await body(req)).targetId, 60);
  const r = await mergeTemp(id, target);
  await audit(me.username, "patient_temp_merge", `${r.name} → ${target} · 스케줄 ${r.moved}건 이동`);
  return r;
}, { roles: ["admin", "manager"] });

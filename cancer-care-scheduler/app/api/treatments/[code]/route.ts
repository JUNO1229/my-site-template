import { audit, HttpError, route } from "@/lib/server/auth";
import { q } from "@/lib/server/db";

export const DELETE = route(async (_r, ctx, me) => {
  const { code } = await ctx.params;
  const r = (await q("SELECT name,builtin FROM treatment_catalog WHERE code=$1", [code]))[0];
  if (!r) throw new HttpError(404, "치료항목을 찾을 수 없습니다");
  if (r.builtin) throw new HttpError(400, "기본 항목은 삭제할 수 없습니다. '사용 안 함'으로 바꿔 주세요");
  await q("DELETE FROM treatment_catalog WHERE code=$1", [code]); await audit(me.username, "treatment_delete", `${r.name} (${code})`);
}, { roles: ["admin", "manager"] });

import { audit, body, route } from "@/lib/server/auth";
import { q } from "@/lib/server/db";
import { need, str } from "@/lib/server/validate";

export const PUT = route(async (req, ctx, me) => {
  const { id } = await ctx.params; const b = await body(req);
  const name = str(b.name, 50); need(name, "치료실 이름을 입력해 주세요");
  await q("UPDATE rooms SET name=$2, therapist=$3, active=$4 WHERE id=$1", [id, name, str(b.therapist, 80), b.active === true]);
  await audit(me.username, "room_update", id);
}, { roles: ["admin"] });

import { audit, body, route } from "@/lib/server/auth";
import { q } from "@/lib/server/db";
import { isTime, need, str } from "@/lib/server/validate";

export const PUT = route(async (req, ctx, me) => {
  const { id } = await ctx.params; const b = await body(req);
  const name = str(b.name, 50); need(name, "치료항목 이름을 입력해 주세요");
  const dur = Number(b.duration); need(Number.isInteger(dur) && dur > 0 && dur <= 240, "소요시간이 올바르지 않습니다");
  const cap = Number(b.capacity ?? 1); need(Number.isInteger(cap) && cap >= 1 && cap <= 50, "동시 수용 인원이 올바르지 않습니다");
  const slots = Array.isArray(b.slots) ? b.slots.map((s) => str(s, 5)).filter(Boolean) : [];
  need(slots.every(isTime), "시작시간 형식은 HH:MM 입니다");
  await q("UPDATE items SET name=$2, duration=$3, slots=$4, capacity=$5 WHERE id=$1", [id, name, dur, slots, cap]);
  await audit(me.username, "item_update", id);
}, { roles: ["admin"] });

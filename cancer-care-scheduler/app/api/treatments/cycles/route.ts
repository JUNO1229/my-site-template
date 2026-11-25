import { audit, body, HttpError, route } from "@/lib/server/auth";
import { q } from "@/lib/server/db";
import { str } from "@/lib/server/validate";

const n = (v: unknown, max: number) => { if (v === null || v === "" || v === undefined) return null; const x = Number(v); if (!Number.isInteger(x) || x < 0 || x > max) throw new HttpError(400, "숫자는 0 이상 정수로 입력해 주세요"); return x; };
/** 치료주기 프리셋 추가·수정 (id 가 있으면 수정) */
export const POST = route(async (req, _c, me) => {
  const b = await body(req); const label = str(b.label, 30); if (!label) throw new HttpError(400, "주기 이름을 입력해 주세요");
  const pw = n(b.perWeek, 14), pm = n(b.perMonth, 60), eo = n(b.everyOtherWeek, 4);
  if (pw === null && pm === null && eo === null) throw new HttpError(400, "주당·월 횟수 중 하나는 입력해 주세요");
  if (b.id) { const r = await q("UPDATE treatment_cycles SET label=$2,per_week=$3,per_month=$4,every_other_week=$5 WHERE id=$1 RETURNING id", [Number(b.id), label, pw, pm, eo]); if (!r.length) throw new HttpError(404, "주기를 찾을 수 없습니다"); }
  else await q("INSERT INTO treatment_cycles(label,per_week,per_month,every_other_week,sort) VALUES($1,$2,$3,$4,(SELECT coalesce(max(sort),0)+1 FROM treatment_cycles))", [label, pw, pm, eo]);
  await audit(me.username, "treatment_cycle_save", label);
}, { roles: ["admin", "manager"] });
export const DELETE = route(async (req, _c, me) => {
  const id = Number(new URL(req.url).searchParams.get("id")); if (!Number.isInteger(id)) throw new HttpError(400, "잘못된 요청입니다");
  await q("DELETE FROM treatment_cycles WHERE id=$1", [id]); await audit(me.username, "treatment_cycle_delete", String(id));
}, { roles: ["admin", "manager"] });

import { audit, body, HttpError, route } from "@/lib/server/auth";
import { q } from "@/lib/server/db";

/** 치료실 표시 순서 저장 — room id 배열 순서대로 (모두에게 적용) */
export const POST = route(async (req, _c, me) => {
  const ids = (await body(req)).ids;
  if (!Array.isArray(ids) || ids.length > 50 || ids.some((x) => typeof x !== "string")) throw new HttpError(400, "잘못된 요청입니다");
  await q("UPDATE rooms r SET sort=x.i FROM (SELECT c AS id, (ordinality-1)::int AS i FROM unnest($1::text[]) WITH ORDINALITY AS u(c,ordinality)) x WHERE r.id=x.id", [ids]);
  await audit(me.username, "room_reorder", ids.join(","));
}, { roles: ["admin", "manager"] });

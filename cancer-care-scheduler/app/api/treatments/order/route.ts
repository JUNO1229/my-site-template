import { audit, body, HttpError, route } from "@/lib/server/auth";
import { q } from "@/lib/server/db";

/** 표시 순서 저장 — 항목 code 배열 순서대로 */
export const POST = route(async (req, _c, me) => {
  const b = await body(req); const codes = b.codes;
  if (!Array.isArray(codes) || codes.length > 200 || codes.some((c) => typeof c !== "string")) throw new HttpError(400, "잘못된 요청입니다");
  await q("UPDATE treatment_catalog t SET sort=x.i FROM (SELECT c AS code, (ordinality-1)::int AS i FROM unnest($1::text[]) WITH ORDINALITY AS u(c,ordinality)) x WHERE t.code=x.code", [codes]);
  await audit(me.username, "treatment_reorder", `${codes.length}건`);
}, { roles: ["admin", "manager"] });

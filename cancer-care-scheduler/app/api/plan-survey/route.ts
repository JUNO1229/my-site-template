import { audit, body, HttpError, route } from "@/lib/server/auth";
import { q } from "@/lib/server/db";
import { str } from "@/lib/server/validate";

export const dynamic = "force-dynamic";
/** 치료정보 구조 설문 — 내 답변 + (관리자·스케줄관리자는) 전체 답변 */
export const GET = route(async (_r, _c, me) => {
  const all = me.role === "admin" || me.role === "manager";
  const rows = await q(`SELECT row_key,username,name,verdict,answer,updated_at FROM plan_survey_answers ${all ? "" : "WHERE username=$1"} ORDER BY updated_at DESC`, all ? [] : [me.username]);
  return { me: me.username, answers: rows.map((r) => ({ key: r.row_key, user: r.username, name: r.name, verdict: r.verdict, answer: r.answer, at: r.updated_at })) };
});
export const PUT = route(async (req, _c, me) => {
  const b = await body(req); const key = str(b.key, 60), verdict = str(b.verdict, 10), answer = str(b.answer, 2000);
  if (!/^[A-Za-z0-9:_-]{1,60}$/.test(key)) throw new HttpError(400, "잘못된 요청입니다");
  if (!["", "ok", "fix"].includes(verdict)) throw new HttpError(400, "잘못된 요청입니다");
  if (!verdict && !answer) await q("DELETE FROM plan_survey_answers WHERE row_key=$1 AND username=$2", [key, me.username]);
  else await q(`INSERT INTO plan_survey_answers(row_key,username,name,verdict,answer) VALUES($1,$2,$3,$4,$5)
    ON CONFLICT (row_key,username) DO UPDATE SET verdict=EXCLUDED.verdict,answer=EXCLUDED.answer,name=EXCLUDED.name,updated_at=now()`, [key, me.username, me.name, verdict, answer]);
  return { ok: true };
}, { roles: ["admin", "manager", "therapist"] });

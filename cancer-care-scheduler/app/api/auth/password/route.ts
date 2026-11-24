import { audit, body, checkPasswordPolicy, hashPassword, HttpError, route, verifyPassword, COOKIE } from "@/lib/server/auth";
import { q } from "@/lib/server/db";
import { cookies } from "next/headers";
import crypto from "node:crypto";

export const POST = route(async (req, _c, me) => {
  const b = await body(req);
  const u = (await q("SELECT password_hash FROM users WHERE id=$1", [me.id]))[0];
  if (typeof b.current !== "string" || !verifyPassword(b.current, u.password_hash)) throw new HttpError(400, "현재 비밀번호가 올바르지 않습니다");
  const next = checkPasswordPolicy(b.next);
  if (next === b.current) throw new HttpError(400, "이전과 다른 비밀번호를 사용해 주세요");
  await q("UPDATE users SET password_hash=$2, must_change=false WHERE id=$1", [me.id, hashPassword(next)]);
  const t = (await cookies()).get(COOKIE)?.value!;
  await q("DELETE FROM sessions WHERE user_id=$1 AND token_hash<>$2", [me.id, crypto.createHash("sha256").update(t).digest("hex")]);
  await audit(me.username, "password_change");
}, { allowMustChange: true });

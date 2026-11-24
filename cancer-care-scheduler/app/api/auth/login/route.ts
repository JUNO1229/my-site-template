import { audit, body, createSession, HttpError, route, verifyPassword } from "@/lib/server/auth";
import { q } from "@/lib/server/db";
import { str } from "@/lib/server/validate";

const DUMMY = "00000000000000000000000000000000:" + "0".repeat(128);
export const POST = route(async (req) => {
  const b = await body(req);
  const username = str(b.username, 50).toLowerCase(), password = typeof b.password === "string" ? b.password : "";
  const u = (await q("SELECT * FROM users WHERE lower(username)=$1", [username]))[0];
  if (u?.locked_until && new Date(u.locked_until) > new Date()) {
    await audit(username, "login_locked"); throw new HttpError(429, "로그인 시도가 너무 많습니다. 10분 후 다시 시도해 주세요");
  }
  const ok = verifyPassword(password, u?.password_hash ?? DUMMY) && !!u && u.active;
  if (!ok) {
    if (u) {
      const failed = u.failed + 1;
      await q("UPDATE users SET failed=$2, locked_until=$3 WHERE id=$1", [u.id, failed >= 5 ? 0 : failed, failed >= 5 ? new Date(Date.now() + 10 * 60000) : null]);
    }
    await audit(username, "login_fail");
    throw new HttpError(401, "아이디 또는 비밀번호가 올바르지 않습니다");
  }
  await q("UPDATE users SET failed=0, locked_until=NULL, last_login=now() WHERE id=$1", [u.id]);
  await createSession(u.id);
  await audit(u.username, "login");
  return { ok: true, mustChange: u.must_change };
}, { public: true });

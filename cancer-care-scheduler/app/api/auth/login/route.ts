import { audit, body, createSession, HttpError, route, verifyPassword } from "@/lib/server/auth";
import { q } from "@/lib/server/db";
import { str } from "@/lib/server/validate";

const DUMMY = "00000000000000000000000000000000:" + "0".repeat(128);
export const POST = route(async (req) => {
  const b = await body(req);
  const username = str(b.username, 50).normalize("NFC").toLowerCase(), password = typeof b.password === "string" ? b.password : "";
  const u = (await q("SELECT * FROM users WHERE lower(username)=$1", [username]))[0];
  const ok = verifyPassword(password, u?.password_hash ?? DUMMY) && !!u && u.active;
  if (!ok) {
    await audit(username, "login_fail");
    throw new HttpError(401, "아이디 또는 비밀번호가 올바르지 않습니다");
  }
  await q("UPDATE users SET failed=0, locked_until=NULL, last_login=now() WHERE id=$1", [u.id]); // 로그인 횟수 제한(잠금)은 사용하지 않음
  await createSession(u.id);
  await audit(u.username, "login");
  return { ok: true, mustChange: u.must_change };
}, { public: true });

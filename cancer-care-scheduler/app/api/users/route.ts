import { audit, body, checkPasswordPolicy, hashPassword, HttpError, route } from "@/lib/server/auth";
import { q } from "@/lib/server/db";
import { mUser } from "@/lib/server/map";
import { need, str } from "@/lib/server/validate";

export const dynamic = "force-dynamic";
export const GET = route(async () => ({ users: (await q("SELECT * FROM users ORDER BY id")).map(mUser) }), { roles: ["admin"] });
export const POST = route(async (req, _c, me) => {
  const b = await body(req);
  const username = str(b.username, 40).toLowerCase(), name = str(b.name, 50), role = str(b.role);
  need(/^[a-z0-9._-]{3,40}$/.test(username), "아이디는 영문 소문자/숫자/._- 3자 이상입니다");
  need(name, "이름을 입력해 주세요"); need(["admin", "manager", "therapist", "viewer"].includes(role), "권한이 올바르지 않습니다");
  const roomIds = role === "therapist" && Array.isArray(b.roomIds) ? b.roomIds.filter((x): x is string => typeof x === "string") : [];
  need(role !== "therapist" || roomIds.length, "치료실 담당자는 담당 치료실을 선택해야 합니다");
  const pw = checkPasswordPolicy(b.password);
  if ((await q("SELECT 1 FROM users WHERE username=$1", [username])).length) throw new HttpError(409, "이미 사용 중인 아이디입니다");
  await q("INSERT INTO users(username,name,role,room_ids,password_hash,must_change) VALUES($1,$2,$3,$4,$5,true)", [username, name, role, roomIds, hashPassword(pw)]);
  await audit(me.username, "user_create", `${username} ${role}`);
}, { roles: ["admin"] });

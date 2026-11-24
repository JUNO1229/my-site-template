import { audit, body, checkPasswordPolicy, hashPassword, HttpError, route } from "@/lib/server/auth";
import { q } from "@/lib/server/db";
import { need, str } from "@/lib/server/validate";

export const PUT = route(async (req, ctx, me) => {
  const id = Number((await ctx.params).id); const b = await body(req);
  const u = (await q("SELECT * FROM users WHERE id=$1", [id]))[0];
  if (!u) throw new HttpError(404, "계정을 찾을 수 없습니다");
  const role = b.role === undefined ? u.role : str(b.role);
  need(["admin", "manager", "therapist", "viewer"].includes(role), "권한이 올바르지 않습니다");
  const active = b.active === undefined ? u.active : b.active === true;
  if (id === me.id && (role !== "admin" || !active)) throw new HttpError(400, "본인 계정의 권한/사용 상태는 변경할 수 없습니다");
  const roomIds = role === "therapist" ? (Array.isArray(b.roomIds) ? b.roomIds.filter((x): x is string => typeof x === "string") : u.room_ids) : [];
  need(role !== "therapist" || roomIds.length, "치료실 담당자는 담당 치료실을 선택해야 합니다");
  await q("UPDATE users SET name=$2, role=$3, room_ids=$4, active=$5 WHERE id=$1", [id, str(b.name, 50) || u.name, role, roomIds, active]);
  let forceLogout = !active || role !== u.role;
  if (typeof b.resetPassword === "string" && b.resetPassword) {
    await q("UPDATE users SET password_hash=$2, must_change=true, failed=0, locked_until=NULL WHERE id=$1", [id, hashPassword(checkPasswordPolicy(b.resetPassword))]);
    forceLogout = true;
  }
  if (b.unlock === true) await q("UPDATE users SET failed=0, locked_until=NULL WHERE id=$1", [id]);
  if (forceLogout) await q("DELETE FROM sessions WHERE user_id=$1", [id]);
  await audit(me.username, "user_update", `${u.username} role=${role} active=${active}${b.resetPassword ? " pw_reset" : ""}`);
}, { roles: ["admin"] });

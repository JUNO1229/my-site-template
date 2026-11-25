import { cookies } from "next/headers";
import { audit, body, HttpError, route, VIEWAS } from "@/lib/server/auth";
import { q } from "@/lib/server/db";
import { str } from "@/lib/server/validate";

export const dynamic = "force-dynamic";
/** 사용자 화면 점검 시작/전환/종료 — 항상 실제 관리자 권한으로 처리(noViewAs) */
export const POST = route(async (req, _c, me) => {
  const b = await body(req); const jar = await cookies();
  const name = str(b.username, 60);
  if (!name) { jar.delete(VIEWAS); await audit(me.username, "viewas_end"); return { ok: true }; }
  const u = (await q("SELECT id,username,name,role FROM users WHERE username=$1 AND active", [name]))[0];
  if (!u) throw new HttpError(404, "사용 중인 계정을 찾을 수 없습니다");
  if (u.id === me.id) throw new HttpError(400, "본인 계정은 선택할 수 없습니다");
  const rw = b.rw === true;
  jar.set(VIEWAS, `${u.username}|${rw ? "rw" : "ro"}`, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 4 });
  await audit(me.username, "viewas_start", `${u.name}(${u.username}) ${rw ? "저장 허용" : "읽기 전용"}`);
  return { ok: true, name: u.name };
}, { roles: ["admin"], noViewAs: true });

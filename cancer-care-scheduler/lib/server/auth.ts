import crypto from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { q } from "./db";
import type { Me, Role } from "../perm";

export const COOKIE = "ccs_session";
const TTL_MS = 12 * 3600 * 1000;

export class HttpError extends Error { constructor(public status: number, msg: string, public code?: string) { super(msg); } }

export function hashPassword(pw: string) {
  const salt = crypto.randomBytes(16);
  return `${salt.toString("hex")}:${crypto.scryptSync(pw, salt, 64).toString("hex")}`;
}
export function verifyPassword(pw: string, stored: string) {
  const [s, h] = stored.split(":");
  if (!s || !h) return false;
  const a = crypto.scryptSync(pw, Buffer.from(s, "hex"), 64), b = Buffer.from(h, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
export function checkPasswordPolicy(pw: unknown): string {
  if (typeof pw !== "string" || pw.length < 8) throw new HttpError(400, "비밀번호는 8자 이상이어야 합니다");
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) throw new HttpError(400, "비밀번호는 영문과 숫자를 모두 포함해야 합니다");
  return pw;
}
const sha = (t: string) => crypto.createHash("sha256").update(t).digest("hex");

export async function createSession(userId: number) {
  const token = crypto.randomBytes(32).toString("base64url");
  await q("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,$3)", [sha(token), userId, new Date(Date.now() + TTL_MS)]);
  (await cookies()).set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: TTL_MS / 1000 });
}
export async function destroySession() {
  const jar = await cookies(); const t = jar.get(COOKIE)?.value;
  if (t) await q("DELETE FROM sessions WHERE token_hash=$1", [sha(t)]);
  jar.delete(COOKIE);
}
export async function currentUser(): Promise<Me | null> {
  const t = (await cookies()).get(COOKIE)?.value;
  if (!t) return null;
  const r = await q(
    `SELECT u.id,u.username,u.name,u.role,u.room_ids,u.must_change FROM sessions s JOIN users u ON u.id=s.user_id
     WHERE s.token_hash=$1 AND s.expires_at>now() AND u.active`, [sha(t)]);
  if (!r[0]) return null;
  const u = r[0];
  return { id: u.id, username: u.username, name: u.name, role: u.role as Role, roomIds: u.room_ids, mustChange: u.must_change };
}
export async function audit(username: string | null, action: string, detail = "") {
  try { await q("INSERT INTO audit_log(username,action,detail) VALUES($1,$2,$3)", [username, action, detail.slice(0, 500)]); } catch { /* ignore */ }
}

type Handler = (req: Request, ctx: { params: Promise<Record<string, string>> }, me: Me) => Promise<unknown>;
export function route(fn: Handler, opts: { public?: boolean; roles?: Role[]; allowMustChange?: boolean } = {}) {
  return async (req: Request, ctx: { params: Promise<Record<string, string>> }) => {
    try {
      if (req.method !== "GET") { // CSRF: 동일 출처 요청만 허용
        const origin = req.headers.get("origin"); const host = req.headers.get("host");
        if (!origin || !host || new URL(origin).host !== host) throw new HttpError(403, "허용되지 않은 요청입니다");
      }
      const me = await currentUser();
      if (!opts.public && !me) throw new HttpError(401, "로그인이 필요합니다");
      if (me && opts.roles && !opts.roles.includes(me.role)) throw new HttpError(403, "권한이 없습니다");
      if (me && me.mustChange && req.method !== "GET" && !opts.allowMustChange) throw new HttpError(403, "먼저 비밀번호를 변경해 주세요");
      return NextResponse.json((await fn(req, ctx, me as Me)) ?? { ok: true });
    } catch (e) {
      if (e instanceof HttpError) {
        const res = NextResponse.json({ error: e.message, ...(e.code ? { code: e.code } : {}) }, { status: e.status });
        // 로그인 정보가 유효하지 않으면 남은 쿠키를 지워 로그인 화면 ↔ 첫 화면 무한 반복을 막는다
        if (e.status === 401) res.cookies.set(COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
        return res;
      }
      if ((e as { code?: string })?.code === "23505") return NextResponse.json({ error: "같은 이름·병동의 환자가 이미 있습니다" }, { status: 409 });
      console.error(e);
      return NextResponse.json({ error: "서버 오류가 발생했습니다" }, { status: 500 });
    }
  };
}
export async function body<T = Record<string, unknown>>(req: Request): Promise<T> {
  try { return (await req.json()) as T; } catch { throw new HttpError(400, "잘못된 요청입니다"); }
}

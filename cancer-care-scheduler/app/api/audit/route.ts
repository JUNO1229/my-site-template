import { route } from "@/lib/server/auth";
import { q } from "@/lib/server/db";
export const dynamic = "force-dynamic";
export const GET = route(async () => ({ logs: await q("SELECT ts,username,action,detail FROM audit_log ORDER BY id DESC LIMIT 300") }), { roles: ["admin"] });

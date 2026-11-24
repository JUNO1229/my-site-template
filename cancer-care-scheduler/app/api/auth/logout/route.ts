import { audit, destroySession, route } from "@/lib/server/auth";
export const POST = route(async (_r, _c, me) => { await audit(me.username, "logout"); await destroySession(); }, { allowMustChange: true });

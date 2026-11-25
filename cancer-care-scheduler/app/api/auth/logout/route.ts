import { cookies } from "next/headers";
import { audit, destroySession, route, VIEWAS } from "@/lib/server/auth";
export const POST = route(async (_r, _c, me) => { await audit(me.username, "logout"); await destroySession(); (await cookies()).delete(VIEWAS); }, { allowMustChange: true, noViewAs: true });

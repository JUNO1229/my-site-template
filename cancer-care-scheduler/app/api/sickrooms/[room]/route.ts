import { audit, body, HttpError, route } from "@/lib/server/auth";
import { q } from "@/lib/server/db";
import { validSickroom } from "@/lib/server/sickroom";

export const PUT = route(async (req, ctx, me) => {
  const no = decodeURIComponent((await ctx.params).room); const v = validSickroom({ ...(await body(req)), roomNo: no });
  const r = await q("UPDATE sickrooms SET beds=$2,start_date=$3,end_date=$4,note=$5 WHERE room_no=$1 RETURNING 1", [no, v.beds, v.start, v.end, v.note]);
  if (!r.length) throw new HttpError(404, "병실을 찾을 수 없습니다");
  await audit(me.username, "sickroom_update", `${no} 병상${v.beds} ${v.start}~${v.end}`);
}, { roles: ["admin", "manager"] });
export const DELETE = route(async (_r, ctx, me) => {
  const no = decodeURIComponent((await ctx.params).room);
  await q("DELETE FROM sickrooms WHERE room_no=$1", [no]); await audit(me.username, "sickroom_delete", no);
}, { roles: ["admin", "manager"] });

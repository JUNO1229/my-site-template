import { audit, body, HttpError, route } from "@/lib/server/auth";
import { q } from "@/lib/server/db";
import { validSickroom } from "@/lib/server/sickroom";

export const POST = route(async (req, _c, me) => {
  const v = validSickroom(await body(req));
  if ((await q("SELECT 1 FROM sickrooms WHERE room_no=$1", [v.roomNo])).length) throw new HttpError(409, "이미 등록된 병실번호입니다");
  await q("INSERT INTO sickrooms(room_no,beds,start_date,end_date,note) VALUES($1,$2,$3,$4,$5)", [v.roomNo, v.beds, v.start, v.end, v.note]);
  await audit(me.username, "sickroom_create", `${v.roomNo} 병상${v.beds}`);
}, { roles: ["admin", "manager"] });

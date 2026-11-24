import { route } from "@/lib/server/auth";
import { q } from "@/lib/server/db";
import { mItem, mPatient, mRoom, mSickroom } from "@/lib/server/map";

export const dynamic = "force-dynamic";
export const GET = route(async (_r, _c, me) => {
  const [rooms, items, patients, sick] = await Promise.all([
    q("SELECT * FROM rooms ORDER BY sort"), q("SELECT * FROM items ORDER BY sort"),
    q("SELECT * FROM patients ORDER BY name"), q("SELECT * FROM sickrooms ORDER BY room_no"),
  ]);
  return { me, rooms: rooms.map(mRoom), items: items.map(mItem), sickrooms: me.role === "therapist" ? [] : sick.map(mSickroom), patients: patients.map((p) => mPatient(p, me.role === "admin" || me.role === "manager")) };
}, { allowMustChange: true });

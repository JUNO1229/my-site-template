import { audit, body, HttpError, route } from "@/lib/server/auth";
import { q } from "@/lib/server/db";
import { str } from "@/lib/server/validate";
import crypto from "node:crypto";

/** 상담실 입력 전에 치료실에서 먼저 이름만으로 임시 환자를 만든다. 나중에 환자명부에 등록되면 자동/수동으로 합쳐진다. */
export const POST = route(async (req, _c, me) => {
  const name = str((await body(req)).name, 30).normalize("NFC");
  if (name.length < 2) throw new HttpError(400, "환자 이름을 2자 이상 입력해 주세요");
  const same = await q("SELECT id,source FROM patients WHERE name=$1 ORDER BY (source='temp') DESC", [name]);
  const t = same.find((r) => r.source === "temp");
  if (t) return { id: t.id as string, reused: true };
  if (same.length) throw new HttpError(409, `'${name}' 환자가 이미 있습니다. 환자 목록에서 선택해 주세요 (동명이인이면 이름 뒤에 구분 문구를 붙여 입력)`);
  const id = crypto.randomUUID();
  await q("INSERT INTO patients(id,name,ward,notes,source) VALUES($1,$2,'','상담실 입력 대기(임시 등록)','temp')", [id, name]);
  await audit(me.username, "patient_temp_create", `${name} (${id})`);
  return { id };
}, { roles: ["admin", "manager", "therapist"] });

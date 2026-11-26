import { HttpError } from "./auth";
import { q } from "./db";
import { isDate, isTime, need, OPTS, STATUS, str } from "./validate";
import { canEditRoom, type Me } from "../perm";

export async function validAppt(b: Record<string, unknown>, me: Me) {
  need(isDate(b.date) && isTime(b.time), "날짜/시간이 올바르지 않습니다");
  need(typeof b.patientId === "string" && typeof b.itemId === "string", "환자와 치료를 선택해 주세요");
  const status = str(b.status) || "예약", opt = str(b.option) === "J" ? "" : str(b.option) === "무료" ? "기타" : str(b.option); // 옵션 없음 = J(기본)
  need(STATUS.includes(status) && OPTS.includes(opt), "상태/옵션이 올바르지 않습니다");
  const item = (await q("SELECT room_id FROM items WHERE id=$1", [b.itemId]))[0];
  need(item, "치료항목이 없습니다");
  need((await q("SELECT 1 FROM patients WHERE id=$1", [b.patientId])).length, "환자가 없습니다");
  if (!canEditRoom(me, item.room_id)) throw new HttpError(403, "이 치료실의 스케줄을 수정할 권한이 없습니다");
  return { date: b.date as string, time: b.time as string, patientId: b.patientId as string, itemId: b.itemId as string, status, opt, memo: str(b.memo, 300) };
}

const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const hm = (n: number) => `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;

/** 서버 쪽 중복·정원 검사 — 같은 환자 시간 겹침, 치료항목 동시 수용 인원 초과.
 *  막지는 않는다: 그 치료실을 수정할 수 있는 사람은 경고를 확인한 뒤 force=true 로 겹친 채 등록할 수 있고(바쁠 때 먼저 입력 → 나중에 정리),
 *  겹친 일정은 화면에 충돌(⚠)로 계속 표시된다. (취소 건은 검사에서 제외) */
export async function checkConflicts(v: { date: string; time: string; patientId: string; itemId: string; status: string }, selfId: string | undefined, me: Me, force: boolean) {
  if (v.status === "취소") return false;
  const item = (await q("SELECT name,duration,capacity FROM items WHERE id=$1", [v.itemId]))[0];
  if (!item) return false;
  const rows = await q(`SELECT a.patient_id,a.appt_time,a.item_id,i.duration,i.name AS item_name,p.name AS pname FROM appts a JOIN items i ON i.id=a.item_id JOIN patients p ON p.id=a.patient_id
    WHERE a.appt_date=$1 AND a.status<>'취소' AND a.id<>$2 AND (a.item_id=$3 OR a.patient_id=$4)`, [v.date, selfId ?? "", v.itemId, v.patientId]);
  const s = toMin(v.time), e = s + item.duration, msgs: string[] = [];
  for (const r of rows) {
    if (r.patient_id !== v.patientId) continue;
    const rs = toMin(r.appt_time), re = rs + r.duration;
    if (s < re && rs < e) msgs.push(`같은 환자의 ${hm(rs)}~${hm(re)} ${r.item_name} 일정과 시간이 겹칩니다`);
  }
  const others = rows.filter((r) => r.item_id === v.itemId).map((r) => ({ s: toMin(r.appt_time), e: toMin(r.appt_time) + r.duration, name: r.pname as string }));
  const pts = [s, ...others.map((o) => o.s).filter((t) => t > s && t < e)];
  for (const t of pts) {
    const n = others.filter((o) => o.s <= t && t < o.e).length + 1;
    if (n > item.capacity) { const who = [...new Set(others.filter((o) => o.s <= t && t < o.e).map((o) => o.name))].slice(0, 4).join(", ");
      msgs.push(item.capacity > 1 ? `${item.name}의 ${hm(t)} 시간대 동시 수용 인원(${item.capacity}명)을 초과합니다 (현재: ${who})` : `${item.name}의 ${hm(t)} 시간대에 이미 ${who} 님이 예약되어 있습니다`); break; }
  }
  if (!msgs.length) return false;
  void me; // 수정 권한은 호출 전(validAppt)에 이미 확인됨
  if (force) return true; // 겹친 채 등록 — 호출한 쪽에서 접속기록에 남긴다
  throw new HttpError(409, msgs.join(" / "), "conflict");
}

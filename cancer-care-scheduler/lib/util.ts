import type { Appt, Item, Patient } from "./types";

export const pad = (n: number) => String(n).padStart(2, "0");
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parse = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
export const addDays = (s: string, n: number) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };
const DOW = ["일", "월", "화", "수", "목", "금", "토"];
export const dow = (s: string) => DOW[parse(s).getDay()];
export const label = (s: string) => `${s}(${dow(s)})`;
export const mondayOf = (s: string) => { const d = parse(s); const k = (d.getDay() + 6) % 7; return addDays(s, -k); };
export const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
export const uid = () => Math.random().toString(36).slice(2, 10);
export const todayStr = () => ymd(new Date());

export const pname = (p?: Patient) => (p ? `${p.name}(${p.ward})` : "?");

/** 충돌 검사: 치료항목별 동시 수용 인원 초과, 같은 환자 시간 겹침 */
export function findConflicts(appts: Appt[], items: Item[], date?: string): Map<string, string> {
  const out = new Map<string, string>();
  const day = appts.filter((a) => (!date || a.date === date) && a.status !== "취소");
  const it = (a: Appt) => items.find((i) => i.id === a.itemId);
  const dur = (a: Appt) => it(a)?.duration ?? 50;
  const overlap = (a: Appt, b: Appt) => toMin(a.time) < toMin(b.time) + dur(b) && toMin(b.time) < toMin(a.time) + dur(a);
  for (const a of day) {
    const cap = it(a)?.capacity ?? 1;
    const sameAtStart = day.filter((b) => b.date === a.date && b.itemId === a.itemId && toMin(b.time) <= toMin(a.time) && toMin(a.time) < toMin(b.time) + dur(b));
    if (sameAtStart.length > cap) { out.set(a.id, cap > 1 ? `동시 수용 인원(${cap}명) 초과` : "같은 치료항목 시간 중복"); }
  }
  for (let i = 0; i < day.length; i++) for (let j = i + 1; j < day.length; j++) {
    const a = day[i], b = day[j];
    if (a.date === b.date && a.patientId === b.patientId && a.itemId !== b.itemId && overlap(a, b)) {
      out.set(a.id, "환자 다른 치료와 시간 겹침"); out.set(b.id, "환자 다른 치료와 시간 겹침");
    }
  }
  return out;
}
export function csvEscape(v: string) { return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; }

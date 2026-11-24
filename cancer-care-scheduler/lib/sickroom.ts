import type { Patient, Sickroom } from "./types";

export const roomOfBed = (bed: string) => bed.split("-")[0].trim();
/** 병실 정렬 키: [병실번호, 병상번호]. 숫자가 아니면(외래 등) 맨 아래 */
export function bedKey(label: string): [number, number] {
  const m = label.trim().match(/^(\d+)(?:-(\d+))?/);
  return m ? [parseInt(m[1], 10), m[2] ? parseInt(m[2], 10) : 0] : [Infinity, 0];
}
export const cmpBed = (a: string, b: string) => { const x = bedKey(a), y = bedKey(b); return x[0] - y[0] || x[1] - y[1] || 0; };

export type RoomState = "운영중" | "시작전" | "종료";
export function roomState(r: Sickroom, today: string): RoomState {
  if (r.startDate && today < r.startDate) return "시작전";
  if (r.endDate && today > r.endDate) return "종료";
  return "운영중";
}
/** 환자명부(자동생성 제외)에서 병실에 입원 중으로 보는 환자 */
export const inpatients = (patients: Patient[]) => patients.filter((p) => p.source !== "auto" && p.status !== "discharged" && p.bed.trim() && p.ward !== "외");

export interface RoomUsage { room: Sickroom; state: RoomState; used: number; vacant: number }
export function usage(rooms: Sickroom[], patients: Patient[], today: string): RoomUsage[] {
  const cnt = new Map<string, number>();
  for (const p of inpatients(patients)) cnt.set(roomOfBed(p.bed), (cnt.get(roomOfBed(p.bed)) ?? 0) + 1);
  return rooms.map((room) => { const used = cnt.get(room.roomNo) ?? 0; return { room, state: roomState(room, today), used, vacant: Math.max(0, room.beds - used) }; });
}
/** 빈 병상 목록(운영 중인 병실만). 병상 라벨은 입원 환자 표기 방식(128-3 / 503)에 맞춘다 */
export function vacantBeds(rooms: Sickroom[], patients: Patient[], today: string): { room: string; label: string }[] {
  const used = new Map<string, string[]>();
  for (const p of inpatients(patients)) used.set(roomOfBed(p.bed), [...(used.get(roomOfBed(p.bed)) ?? []), p.bed.trim()]);
  const out: { room: string; label: string }[] = [];
  for (const r of rooms) {
    if (roomState(r, today) !== "운영중") continue;
    const u = used.get(r.roomNo) ?? []; const free = Math.max(0, r.beds - u.length); if (!free) continue;
    const plain = u.length > 0 && u.every((l) => !l.includes("-"));
    const cand = r.beds > 1 && !plain ? Array.from({ length: r.beds }, (_, i) => `${r.roomNo}-${i + 1}`) : [r.roomNo];
    const labels = cand.filter((l) => !u.includes(l));
    while (labels.length < free) labels.push(r.roomNo);
    labels.slice(0, free).forEach((label) => out.push({ room: r.roomNo, label }));
  }
  return out;
}

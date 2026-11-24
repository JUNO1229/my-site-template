import type { DB, Appt, Item, Patient, Room, Ward } from "./types";
import { addDays, dow, mondayOf, todayStr, toMin, uid } from "./util";

const rooms: Room[] = [
  { id: "hf", name: "고주파치료실", therapist: "전영균", active: true, color: "#e11d48" },
  { id: "ds", name: "도수치료실", therapist: "김익현", active: true, color: "#2563eb" },
  { id: "pj", name: "페인잼머", therapist: "정은상", active: true, color: "#9333ea" },
  { id: "lp", name: "림프", therapist: "장진희 / 양지연", active: true, color: "#059669" },
  { id: "pd", name: "파동", therapist: "이은영", active: true, color: "#d97706" },
  { id: "rb", name: "역박동", therapist: "박광희", active: false, color: "#0891b2" },
];
const mk = (id: string, roomId: string, name: string, duration: number, slots: string): Item =>
  ({ id, roomId, name, duration, slots: slots.split(",") });
const items: Item[] = [
  mk("hf-bsd", "hf", "BSD", 60, "09:00,10:10,11:20,13:30,14:40,15:50"),
  mk("hf-e1", "hf", "EHY1", 60, "09:20,10:30,13:30,14:40,15:50"),
  mk("hf-e2", "hf", "EHY2", 60, "07:50,09:00,10:10,13:30,14:40"),
  mk("hf-out", "hf", "통원", 60, "09:30,10:40,13:40,14:50"),
  mk("ds", "ds", "도수", 50, "08:40,09:30,10:45,11:20,13:40,14:20,15:00,16:10"),
  mk("pj", "pj", "페인잼머", 30, "09:00,09:40,10:20,11:00,13:30,14:10,14:50,15:30"),
  mk("lp1", "lp", "림프1", 50, "08:40,09:30,10:20,11:10,13:30,14:20,15:10"),
  mk("lp2", "lp", "림프2", 50, "08:40,09:30,10:20,11:10,13:30,14:20,15:10"),
  mk("pd", "pd", "파동", 50, "08:30,09:20,10:10,11:00,13:30,14:20,15:10,16:00"),
  mk("rb", "rb", "역박동", 40, "09:00,10:00,11:00,14:00,15:00"),
];

// 데모용 가상 환자 (실제 환자정보 아님)
const NAMES = ["가온", "나래", "다솜", "라온", "마루", "바다", "사랑", "아름", "자람", "차분", "하늘", "고운",
  "누리", "도담", "미르", "새봄", "소담", "여울", "이든", "해솔", "별이", "보람", "다온", "예솔"];
const SURN = ["김", "이", "박", "최", "정", "강", "조", "윤", "장", "임"];
const WARDS: Ward[] = ["1", "1", "3", "3", "5", "외"];
const PLANS = [
  "고주파 주2 + 파동 주2 + 도수 주1", "림프 주3 + 페인잼머 주3", "도수 주2 + 림프 주2 + 파동 주1",
  "고주파 주2 + 림프 주2", "파동 주3 + 페인잼머 주2", "도수 주3 + 림프 주1",
];
const NOTES = ["항암 중", "수술 후 회복", "", "통증 관리", "림프부종 관리", ""];

function rng(seed: number) { let s = seed; return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296; }

export function makeSeed(): DB {
  const r = rng(20261124);
  const today = todayStr();
  const patients: Patient[] = NAMES.map((n, i) => ({
    id: `p${i + 1}`, chartNo: String(14000 + i * 7), name: SURN[i % SURN.length] + n,
    ward: WARDS[i % WARDS.length], bed: String(101 + i), admitDate: addDays(today, -30 - Math.floor(r() * 40)),
    dischargeDate: addDays(today, 20 + Math.floor(r() * 60)), plan: PLANS[i % PLANS.length], notes: NOTES[i % NOTES.length],
  }));
  const appts: Appt[] = [];
  const used = new Set<string>(); // date|itemId|time
  const busy = new Map<string, number[]>(); // date|patient -> [start...]
  const start = mondayOf(addDays(today, -14));
  const itemsOf = (p: Patient) => p.plan.includes("고주파") ? ["hf-bsd", "hf-e1", "hf-e2"] : [];
  patients.forEach((p, pi) => {
    const kinds: string[] = [];
    if (p.plan.includes("고주파")) kinds.push(["hf-bsd", "hf-e1", "hf-e2"][pi % 3]);
    if (p.plan.includes("도수")) kinds.push("ds");
    if (p.plan.includes("림프")) kinds.push(pi % 2 ? "lp1" : "lp2");
    if (p.plan.includes("페인잼머")) kinds.push("pj");
    if (p.plan.includes("파동")) kinds.push("pd");
    void itemsOf;
    kinds.forEach((k, ki) => {
      const it = items.find((x) => x.id === k)!;
      const days = [(pi + ki) % 5, (pi + ki + 2) % 5];
      for (let w = 0; w < 5; w++) for (const d of days) {
        const date = addDays(start, w * 7 + d);
        if (dow(date) === "토" || dow(date) === "일") continue;
        const shuffled = [...it.slots].sort(() => r() - 0.5);
        const time = shuffled.find((t) => {
          if (used.has(`${date}|${k}|${t}`)) return false;
          const b = busy.get(`${date}|${p.id}`) ?? [];
          return b.every((x) => Math.abs(x - toMin(t)) >= 70);
        });
        if (!time) continue;
        used.add(`${date}|${k}|${time}`);
        busy.set(`${date}|${p.id}`, [...(busy.get(`${date}|${p.id}`) ?? []), toMin(time)]);
        const now = new Date(); const nowMin = now.getHours() * 60 + now.getMinutes();
        const status = date < today ? (r() < 0.07 ? "취소" : "완료")
          : date === today ? (toMin(time) < nowMin ? "완료" : "예약") : "예약";
        appts.push({ id: uid(), patientId: p.id, date, time, itemId: k, option: r() < 0.1 ? "K" : "", status, memo: "" });
      }
    });
  });
  return { rooms, items, patients, appts, version: 1 };
}

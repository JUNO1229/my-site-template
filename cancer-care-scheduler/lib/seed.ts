import type { Appt, Item, Patient, Ward } from "./types";
import { addDays, dow, mondayOf, toMin, uid } from "./util";

import cfg from "./baseConfig.json";
const items = cfg.items as Item[];

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

export function makeSeed(today: string, nowMin: number): { patients: Patient[]; appts: Appt[] } {
  const r = rng(20261124);
  const patients: Patient[] = NAMES.map((n, i) => ({
    id: `p${i + 1}`, chartNo: String(14000 + i * 7), name: SURN[i % SURN.length] + n,
    ward: WARDS[i % WARDS.length], bed: String(101 + i), admitDate: addDays(today, -30 - Math.floor(r() * 40)),
    dischargeDate: addDays(today, 20 + Math.floor(r() * 60)), plan: PLANS[i % PLANS.length], notes: NOTES[i % NOTES.length],
  }));
  const appts: Appt[] = [];
  const used = new Set<string>(); // date|itemId|time
  const busy = new Map<string, number[]>(); // date|patient -> [start...]
  const start = mondayOf(addDays(today, -14));
  patients.forEach((p, pi) => {
    const kinds: string[] = [];
    if (p.plan.includes("고주파")) kinds.push(["hf-bsd", "hf-e1", "hf-e2"][pi % 3]);
    if (p.plan.includes("도수")) kinds.push("ds");
    if (p.plan.includes("림프")) kinds.push(pi % 2 ? "lp1" : "lp2");
    if (p.plan.includes("페인잼머")) kinds.push("pj");
    if (p.plan.includes("파동")) kinds.push("pd");
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
        const status = date < today ? (r() < 0.07 ? "취소" : "완료")
          : date === today ? (toMin(time) < nowMin ? "완료" : "예약") : "예약";
        appts.push({ id: uid(), patientId: p.id, date, time, itemId: k, option: r() < 0.1 ? "K" : "", status, memo: "" });
      }
    });
  });
  return { patients, appts };
}

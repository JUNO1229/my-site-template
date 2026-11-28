import { HttpError } from "./auth";
export const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
export function need(cond: unknown, msg: string): asserts cond { if (!cond) throw new HttpError(400, msg); }
export const isDate = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
export const isTime = (v: unknown) => typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
export const STATUS = ["예약", "완료", "연기", "취소"];
export const isOff = (s: string) => s === "취소" || s === "연기"; // 자리를 차지하지 않는 상태
export const OPTS = ["", "K", "C", "S", "J", "기타", "무료"]; // J → 없음, 무료 → 기타 로 저장 시 통일
export const WARDS = ["", "1", "2", "3", "4", "5", "외"];

import { HttpError } from "./auth";
export const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
export function need(cond: unknown, msg: string): asserts cond { if (!cond) throw new HttpError(400, msg); }
export const isDate = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
export const isTime = (v: unknown) => typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
export const STATUS = ["예약", "완료", "취소"];
export const OPTS = ["", "K", "C", "S", "J", "무료"];
export const WARDS = ["1", "3", "5", "외"];

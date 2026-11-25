export type Ward = "1" | "3" | "5" | "외";
export type Status = "예약" | "완료" | "취소";
export const STATUSES: Status[] = ["예약", "완료", "취소"];
/** 치료옵션 — 표시 없음(기본)은 J(젬마 연계)와 같다. K=미뤄뒀다 받는 치료, C=쿠폰, S=서비스 */
export const OPTIONS = ["", "K", "C", "S", "무료"] as const;
export const OPTION_LABEL: Record<string, string> = { "": "기본(J)", K: "K 연기 후 수령", C: "C 쿠폰", S: "S 서비스", 무료: "무료" };

export interface Item { id: string; roomId: string; name: string; duration: number; capacity: number; slots: string[] }
export interface Room { id: string; name: string; therapist: string; active: boolean; color: string }
export interface Patient {
  id: string; chartNo: string; name: string; ward: Ward; bed: string;
  admitDate: string; dischargeDate: string; plan: string; notes: string;
  status?: "active" | "discharged"; // active=재원/이용중, discharged=퇴원/종료
  source?: "registry" | "auto" | "temp"; // registry=환자명부 등록, auto=스케줄 기록에서 자동 생성, temp=치료실이 먼저 입력한 임시 환자(상담실 등록 대기)
  contractAmount?: number | null; // 치료계약금액(본인부담금) — 관리자/상담실장에게만 제공
}
export interface Appt {
  id: string; patientId: string; date: string; time: string; itemId: string;
  option: string; status: Status; memo: string;
}
export interface Sickroom { roomNo: string; beds: number; startDate: string; endDate: string; note: string }
export interface DB { rooms: Room[]; items: Item[]; patients: Patient[]; sickrooms: Sickroom[] }

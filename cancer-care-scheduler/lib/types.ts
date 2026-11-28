export type Ward = "1" | "3" | "5" | "외";
export type Status = "예약" | "완료" | "연기" | "취소";
export const STATUSES: Status[] = ["예약", "완료", "연기", "취소"];
/** 그 시간에 치료하지 않는 상태(연기·취소) — 자리·정원·충돌·진행률 계산에서 제외한다 */
export const isOff = (s: string) => s === "취소" || s === "연기";
/** 치료옵션 — 화면에는 이니셜만 표시한다(J·K·C·S·기타). 저장 시 옵션 없음 = J */
export const OPTIONS = ["", "K", "C", "S", "기타"] as const;
export const OPTION_LABEL: Record<string, string> = { "": "J", K: "K", C: "C", S: "S", 기타: "기타" };

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

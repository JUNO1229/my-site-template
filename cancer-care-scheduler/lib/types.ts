export type Ward = "1" | "3" | "5" | "외";
export type Status = "예약" | "완료" | "취소";
export const STATUSES: Status[] = ["예약", "완료", "취소"];
export const OPTIONS = ["", "K", "C", "S", "J", "무료"] as const;

export interface Item { id: string; roomId: string; name: string; duration: number; capacity: number; slots: string[] }
export interface Room { id: string; name: string; therapist: string; active: boolean; color: string }
export interface Patient {
  id: string; chartNo: string; name: string; ward: Ward; bed: string;
  admitDate: string; dischargeDate: string; plan: string; notes: string;
}
export interface Appt {
  id: string; patientId: string; date: string; time: string; itemId: string;
  option: string; status: Status; memo: string;
}
export interface DB { rooms: Room[]; items: Item[]; patients: Patient[] }

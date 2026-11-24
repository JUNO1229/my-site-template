export type Role = "admin" | "manager" | "therapist" | "viewer";
export const ROLE_LABEL: Record<Role, string> = {
  admin: "시스템관리자", manager: "스케줄관리자(상담실장)", therapist: "치료실 담당자", viewer: "조회전용",
};
export const ROLE_DESC: Record<Role, string> = {
  admin: "모든 기능 + 계정·치료실 설정·접속기록",
  manager: "전체 치료실 스케줄·환자명부 등록/수정",
  therapist: "배정된 치료실 스케줄만 등록/수정, 나머지는 조회",
  viewer: "모니터링·조회만 가능",
};
export interface Me { id: number; username: string; name: string; role: Role; roomIds: string[]; mustChange: boolean }
export const isAdmin = (m?: Me | null) => m?.role === "admin";
export const canEditPatients = (m?: Me | null) => m?.role === "admin" || m?.role === "manager";
export const canEditRoom = (m: Me | null | undefined, roomId?: string) =>
  !!m && (m.role === "admin" || m.role === "manager" || (m.role === "therapist" && !!roomId && m.roomIds.includes(roomId)));
export const canEditSickrooms = (m?: Me | null) => m?.role === "admin" || m?.role === "manager";

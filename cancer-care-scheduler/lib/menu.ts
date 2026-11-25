import type { Role } from "./perm";

export const MENU: { href: string; label: string; icon: string; roles?: Role[] }[] = [
  { href: "/patients", label: "환자명부", icon: "users" },
  { href: "/patient-history", label: "이전환자명부", icon: "history" },
  { href: "/", label: "치료실 통합모니터링", icon: "activity" },
  { href: "/rooms", label: "치료실별 스케줄", icon: "grid" },
  { href: "/monthly", label: "월간 치료현황", icon: "cal2" },
  { href: "/calendar", label: "환자별 치료캘린더", icon: "calendar" },
  { href: "/list", label: "기간별 리스트", icon: "list" },
  { href: "/plan-survey", label: "치료정보 구조 설문", icon: "list" },
  { href: "/treatment-settings", label: "치료항목 설정", icon: "sliders", roles: ["admin", "manager"] },
  { href: "/settings", label: "치료실 설정", icon: "sliders", roles: ["admin"] },
  { href: "/sickrooms", label: "병실관리", icon: "bed", roles: ["admin", "manager", "viewer"] },
  { href: "/admin", label: "계정·접속기록", icon: "shield", roles: ["admin"] },
  { href: "/devmon", label: "사용자 화면 점검", icon: "eye", roles: ["admin"] },
];
/** 권한별로 보이는 사이드바 메뉴 */
export const menuFor = (role?: Role) => MENU.filter((m) => !m.roles || (!!role && m.roles.includes(role)));

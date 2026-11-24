"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
const TABS = [
  ["/", "통합 모니터링"], ["/rooms", "치료실별 스케줄"], ["/patients", "환자명부"],
  ["/calendar", "캘린더"], ["/list", "기간별 리스트"], ["/settings", "설정"],
];
export default function Nav() {
  const p = usePathname();
  return (
    <header className="nav">
      <div className="brand">암센터 치료관리</div>
      <nav>{TABS.map(([h, t]) => (
        <Link key={h} href={h} className={(h === "/" ? p === "/" : p.startsWith(h)) ? "on" : ""}>{t}</Link>
      ))}</nav>
    </header>
  );
}

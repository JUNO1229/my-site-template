import Link from "next/link"
import { logout } from "@/app/actions"
import { aiName, providerStatus } from "@/lib/providers"

const NAV = [["/", "대시보드"], ["/leads", "영업대상 DB"], ["/projects", "프로젝트"], ["/materials", "영업자료"], ["/dispatches", "발송이력"]]
export const dynamic = "force-dynamic"
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const p = providerStatus()
  return (
    <div className="mx-auto max-w-6xl px-4 pb-16">
      <header className="flex flex-wrap items-center gap-4 py-4">
        <b className="text-indigo-700">모두패스 영업</b>
        <nav className="flex flex-wrap gap-3 text-sm">{NAV.map(([h, n]) => <Link key={h} href={h} className="text-slate-700 hover:text-indigo-700">{n}</Link>)}</nav>
        <div className="ml-auto flex items-center gap-2 text-xs text-slate-500">
          <span title="키 미설정 시 시뮬레이션">이메일 {p.email ? "실발송" : "시뮬"} · 문자 {p.sms ? "실발송" : "시뮬"} · AI {p.ocr ? aiName() : "없음(수동)"}</span>
          <form action={logout}><button className="btn-ghost">로그아웃</button></form>
        </div>
      </header>
      {children}
    </div>
  )
}

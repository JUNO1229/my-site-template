import Link from "next/link"
import { logout } from "./actions"

const NAV = [["/", "대시보드"], ["/leads", "리드"], ["/enrichment", "연락처 보강"], ["/dispatch", "발송·이력"], ["/analysis", "분석"]]
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <header className="border-b border-slate-200 bg-white">
        <nav className="mx-auto flex max-w-7xl items-center gap-5 px-4 py-3 text-sm">
          <b className="mr-2">영업처 관리</b>
          {NAV.map(([h, l]) => <Link key={h} href={h} className="text-slate-600 hover:text-slate-900">{l}</Link>)}
          <form action={logout} className="ml-auto"><button className="btn-ghost">로그아웃</button></form>
        </nav>
      </header>
      <main className="mx-auto max-w-7xl space-y-4 px-4 py-6">{children}</main>
    </div>
  )
}

'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { DeskCtx as Ctx, Row, D } from '@/lib/desk-ctx'
import { api } from '@/lib/client'
import { Logo } from '@/components/pn'


const NAV = [['/desk', '접수함', ['RECEIVED']], ['/desk/write', '기사 작성', ['DRAFTING', 'REVISION']], ['/desk/confirm', '컨펌 관리', ['CONFIRM_REQ', 'REVISION']], ['/desk/publish', '검수·게재', ['APPROVED', 'SCHEDULED']], ['/desk/board', '기사 현황'], ['/desk/customers', '고객 관리'], ['/desk/stats', '통계']] as const
export default function DeskLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname(); const router = useRouter(); const [me, setMe] = useState<D['me'] | null>(null); const [rows, setRows] = useState<Row[]>([])
  const login = path === '/desk/login'
  const reload = useCallback(async () => { try { setRows((await api<{ reports: Row[] }>('/desk/reports')).reports) } catch {} }, [])
  useEffect(() => { if (login) return; api('/desk/me').then(setMe).catch(() => router.replace('/desk/login')); reload(); const t = setInterval(reload, 15000); return () => clearInterval(t) }, [login, router, reload])
  if (login) return <>{children}</>
  if (!me) return <div className="grid min-h-dvh place-items-center text-muted">불러오는 중…</div>
  return (
    <Ctx.Provider value={{ me, rows, reload }}>
      <div className="flex min-h-dvh">
        <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col bg-primary p-4 text-onprimary md:flex">
          <div className="mb-6 flex items-center gap-2"><span className="logo" style={{ background: 'var(--on-primary)', color: 'var(--primary)' }}>P</span><b className="serif text-lg">프레스노트</b></div>
          <nav className="flex-1 space-y-1">{NAV.map(([h, l, st]) => { const n = st ? rows.filter((r) => (st as readonly string[]).includes(r.status)).length : 0; const on = h === '/desk' ? path === h : path.startsWith(h)
            return <Link key={h} href={h} className={`flex min-h-11 items-center justify-between rounded-lg px-3 text-sm ${on ? 'bg-white/15 font-bold' : 'opacity-85 hover:bg-white/10'}`}>{l}{n > 0 && <span className={`chip ${h === '/desk' ? 'chip-warn' : 'bg-white/20'}`}>{n}</span>}</Link> })}</nav>
          <div className="border-t border-white/20 pt-3 text-sm"><p className="font-bold">{me.name}</p><p className="text-xs opacity-75">기자 · 데스크 겸임</p>
            <button className="mt-2 text-xs underline" onClick={async () => { await api('/desk/logout', { json: {} }); router.replace('/desk/login') }}>로그아웃</button></div>
        </aside>
        <div className="min-w-0 flex-1">
          <nav className="flex gap-1 overflow-x-auto bg-primary p-2 text-onprimary md:hidden">{NAV.map(([h, l]) => <Link key={h} href={h} className={`shrink-0 rounded-lg px-3 py-2 text-sm ${path === h ? 'bg-white/20 font-bold' : ''}`}>{l}</Link>)}</nav>
          {children}
        </div>
      </div>
    </Ctx.Provider>
  )
}

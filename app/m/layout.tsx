'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { MeCtx as Ctx, Me } from '@/lib/me-ctx'
import { api } from '@/lib/client'
import { Logo } from '@/components/pn'


const TABS = [['/m', '홈'], ['/m/report', '제보하기'], ['/m/articles', '내 기사'], ['/m/me', '내 정보']] as const
export default function MLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname(); const router = useRouter(); const [me, setMe] = useState<Me | null>(null)
  const open = path === '/m/login'
  useEffect(() => { if (open) return; api<Me>('/me').then(setMe).catch(() => router.replace('/m/login')) }, [open, router])
  if (open) return <div className="mx-auto min-h-dvh max-w-[430px]">{children}</div>
  if (!me) return <div className="grid min-h-dvh place-items-center text-muted">불러오는 중…</div>
  const hideBar = path.startsWith('/m/confirm') || path === '/m/report'
  return (
    <Ctx.Provider value={me}>
      <div className="mx-auto min-h-dvh max-w-[430px] bg-bg pb-24">
        <header className="flex items-center gap-2 border-b border-line bg-surface px-4 py-3"><Logo /><b className="serif">프레스노트</b><span className="ml-auto text-xs text-muted">{me.customer.name}</span></header>
        {children}
        {!hideBar && (
          <nav className="fixed inset-x-0 bottom-0 z-10 mx-auto flex max-w-[430px] border-t border-line bg-surface">
            {TABS.map(([h, l]) => <Link key={h} href={h} className={`flex min-h-14 flex-1 items-center justify-center text-sm ${path === h ? 'font-bold text-primary' : 'text-muted'}`}>{l}</Link>)}
          </nav>
        )}
      </div>
    </Ctx.Provider>
  )
}

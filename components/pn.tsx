'use client'
import { ReactNode } from 'react'
import { CHIP, CUSTOMER_CHIP, mediaUrl } from '@/lib/client'

export const Chip = ({ status, customer }: { status: string; customer?: boolean }) => {
  const [t, c] = (customer ? CUSTOMER_CHIP : CHIP)[status] || [status, 'chip-gray']
  return <span className={`chip ${c}`}>{t}</span>
}
export const Thumb = ({ id, className = '' }: { id?: string | null; className?: string }) =>
  id ? <img src={mediaUrl(id)} alt="" className={`object-cover bg-line ${className}`} /> : <div className={`bg-line ${className}`} />
export const Err = ({ children }: { children?: ReactNode }) => (children ? <p role="alert" className="err mt-2">{children}</p> : null)
export const Logo = ({ size = 32 }: { size?: number }) => <span className="logo" style={{ width: size, height: size }}>P</span>
export const Need = ({ t }: { t: string }) => <>{t.split(/(\[확인 필요:[^\]]*\])/).map((s, i) => /^\[확인 필요/.test(s) ? <span key={i} className="need">{s}</span> : s)}</>

/** 실제 게재 화면과 같은 형태의 미리보기 (M05, A02, A04 공용) */
export function ArticlePreview(p: {
  category: string; title: string; subtitle?: string; byline: string; coverId?: string | null; caption?: string; paragraphs: string[]
  changed?: number[]; showChanged?: boolean; marks?: Record<number, boolean>; onPara?: (i: number) => void; extra?: (i: number) => ReactNode
}) {
  return (
    <div className="card p-5">
      <p className="text-xs font-bold text-primary">{p.category}</p>
      <h2 className="serif mt-2 text-2xl font-extrabold leading-snug">{p.title || '(제목 없음)'}</h2>
      {p.subtitle && <p className="serif mt-2 text-muted">{p.subtitle}</p>}
      <p className="mt-3 text-xs text-muted">{p.byline}</p>
      {p.coverId && <figure className="mt-4"><img src={mediaUrl(p.coverId)} alt="" className="w-full rounded-lg" />{p.caption && <figcaption className="mt-1 text-xs text-muted">{p.caption}</figcaption>}</figure>}
      <div className="article serif mt-5 text-[16px]">
        {p.paragraphs.map((t, i) => (
          <div key={i}>
            <p onClick={p.onPara ? () => p.onPara!(i) : undefined} className={`${p.showChanged && p.changed?.includes(i) ? 'chg rounded px-1' : ''} ${p.onPara ? 'cursor-pointer rounded hover:bg-infobg' : ''}`}>
              <Need t={t} />{p.marks?.[i] && <span className="chip chip-warn ml-2 align-middle">의견</span>}
            </p>
            {p.extra?.(i)}
          </div>
        ))}
      </div>
    </div>
  )
}

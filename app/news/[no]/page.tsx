import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'

export const dynamic = 'force-dynamic'
async function load(no: string) {
  const h = await headers(); const host = h.get('x-forwarded-host') || h.get('host')
  const res = await fetch(`${h.get('x-forwarded-proto') || 'http'}://${host}/api/news/${encodeURIComponent(no)}`, { cache: 'no-store' })
  if (!res.ok) return null
  const j = await res.json()
  return { r: { section: j.section, category: j.section, mediaIds: j.mediaIds as string[], publishedAt: j.publishedAt as string, subtitle: j.article.subtitle }, v: j.article as { title: string; subtitle?: string; caption?: string; paragraphs: string[] }, org: j.org as string, by: j.by as string | null }
}
export async function generateMetadata({ params }: { params: Promise<{ no: string }> }): Promise<Metadata> {
  const a = await load((await params).no); if (!a) return { title: '기사를 찾을 수 없습니다' }
  const img = a.r.mediaIds[0] ? `/api/media/${a.r.mediaIds[0]}` : undefined
  return { title: a.v.title, description: a.v.subtitle, openGraph: { title: a.v.title, description: a.v.subtitle, images: img ? [img] : [], type: 'article' } }
}
const Need = ({ t }: { t: string }) => <>{t.split(/(\[확인 필요:[^\]]*\])/).map((s, i) => /^\[확인 필요/.test(s) ? <span key={i} className="need">{s}</span> : s)}</>

export default async function News({ params }: { params: Promise<{ no: string }> }) {
  const a = await load((await params).no); if (!a) notFound()
  const { r, v } = a
  const when = new Date(r.publishedAt!).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
  return (
    <div className="min-h-dvh bg-surface">
      <header className="border-b border-line"><div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-3"><span className="logo">P</span><b className="serif">프레스노트</b></div></header>
      <main className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-sm font-bold text-primary">{r.section || r.category}</p>
        <h1 className="serif mt-2 text-3xl font-extrabold leading-snug">{v.title}</h1>
        {v.subtitle && <p className="serif mt-3 text-lg text-muted">{v.subtitle}</p>}
        <p className="mt-4 text-sm text-muted">{a.by ? `${a.by} 기자` : '편집국'} · {when}</p>
        {r.mediaIds[0] && <figure className="mt-6"><img src={`/api/media/${r.mediaIds[0]}`} alt={v.caption || v.title} className="w-full rounded-lg" />{v.caption && <figcaption className="mt-2 text-sm text-muted">{v.caption}</figcaption>}</figure>}
        <article className="article serif mt-8 text-[17px]">{v.paragraphs.map((p, i) => <p key={i}><Need t={p} /></p>)}</article>
        {r.mediaIds.slice(1).map((id) => <img key={id} src={`/api/media/${id}`} alt="" className="mt-4 w-full rounded-lg" />)}
        <footer className="mt-10 border-t border-line pt-4 text-xs text-muted">Copyright © 프레스노트. 무단 전재 및 재배포 금지. 이 기사는 {a.org}의 제보를 바탕으로 편집국이 작성·확인했습니다.</footer>
      </main>
    </div>
  )
}

import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: { default: '프레스노트', template: '%s | 프레스노트' },
  description: '현장에서 보낸 사진과 메모가 당일 기사로. 제보부터 게재까지 프레스노트.',
}
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#0F2A4A' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&family=Noto+Serif+KR:wght@600;800&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-dvh">{children}</body>
    </html>
  )
}

import "./globals.css"
export const metadata = { title: "모두패스 영업 발송 시스템", robots: { index: false, follow: false } }
export default function Root({ children }: { children: React.ReactNode }) {
  return <html lang="ko"><body>{children}</body></html>
}

import type { Metadata, Viewport } from "next";
import "./globals.css";
import { StoreProvider } from "@/lib/store";
import { ToastProvider } from "@/lib/toast";
import { UiProvider } from "@/lib/ui";
import Shell from "@/components/Shell";

export const metadata: Metadata = { title: "ResHub-C · 리즈허브-C", robots: { index: false, follow: false } };
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#6E4FA8" };
const THEME_JS = `try{var t=localStorage.getItem('ccs-theme');if(t)document.documentElement.dataset.theme=t}catch(e){}`;
// 글꼴(Pretendard)은 화면 표시를 막지 않도록 페이지가 모두 뜬 뒤에 불러온다. 외부 서버가 막혀 있어도 시스템 글꼴로 정상 동작한다.
const FONT_JS = `addEventListener('load',function(){try{var l=document.createElement('link');l.rel='stylesheet';l.href='https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css';document.head.appendChild(l)}catch(e){}})`;
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_JS }} />
        <script dangerouslySetInnerHTML={{ __html: FONT_JS }} />
      </head>
      <body>
        <a href="#main" className="skip">본문으로 건너뛰기</a>
        <StoreProvider><ToastProvider><UiProvider><Shell>{children}</Shell></UiProvider></ToastProvider></StoreProvider>
      </body>
    </html>
  );
}

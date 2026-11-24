import type { Metadata, Viewport } from "next";
import "./globals.css";
import { StoreProvider } from "@/lib/store";
import { ToastProvider } from "@/lib/toast";
import { UiProvider } from "@/lib/ui";
import Shell from "@/components/Shell";

export const metadata: Metadata = { title: "ResHub-C · 리즈허브-C", robots: { index: false, follow: false } };
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#6E4FA8" };
const THEME_JS = `try{var t=localStorage.getItem('ccs-theme');if(t)document.documentElement.dataset.theme=t}catch(e){}`;
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_JS }} />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css" />
      </head>
      <body>
        <a href="#main" className="skip">본문으로 건너뛰기</a>
        <StoreProvider><ToastProvider><UiProvider><Shell>{children}</Shell></UiProvider></ToastProvider></StoreProvider>
      </body>
    </html>
  );
}

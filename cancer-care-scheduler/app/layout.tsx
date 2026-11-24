import type { Metadata } from "next";
import "./globals.css";
import { StoreProvider } from "@/lib/store";
import Nav from "@/components/Nav";
export const metadata: Metadata = { title: "암센터 치료관리", robots: { index: false, follow: false } };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko"><body><StoreProvider><Nav /><main>{children}</main></StoreProvider></body></html>
  );
}

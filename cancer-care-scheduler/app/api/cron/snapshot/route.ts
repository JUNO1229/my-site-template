import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { audit } from "@/lib/server/auth";
import { kst, prevDate } from "@/lib/server/kst";
import { takeSnapshot } from "@/lib/server/snapshot";

export const dynamic = "force-dynamic";
const safeEq = (a: string, b: string) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && crypto.timingSafeEqual(x, y); };

/** 매일 24:00(한국시간)에 Vercel Cron이 호출 — 방금 끝난 날의 환자명부를 저장한다 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || !safeEq(auth, `Bearer ${secret}`)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const now = kst();
    // 자정 직후(예약 실행은 0시~1시 사이에 실행될 수 있음)에는 '어제'가 끝난 날. 그 외 시각에 호출되면 오늘 날짜로 저장.
    const date = now.hour < 6 ? prevDate(now.date) : now.date;
    const r = await takeSnapshot(date, "cron");
    await audit("system", "snapshot_cron", `${r.date} 총 ${r.total}명`);
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "snapshot failed" }, { status: 500 });
  }
}

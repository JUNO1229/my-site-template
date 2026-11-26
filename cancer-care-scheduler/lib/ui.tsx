"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import ApptModal, { type Draft } from "@/components/ApptModal";
import { useStore } from "./store";
import { useToast } from "./toast";
import type { Appt, Status } from "./types";

type Theme = "light" | "dark";
interface Ctx { openAppt: (d: Draft) => void; theme: Theme; toggleTheme: () => void }
const C = createContext<Ctx | null>(null);
export const useUi = () => { const c = useContext(C); if (!c) throw new Error("ui"); return c; };

export function UiProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [theme, setTheme] = useState<Theme>("light");
  useEffect(() => {
    const saved = document.documentElement.dataset.theme as Theme | undefined;
    setTheme(saved ?? (window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
  }, []);
  const toggleTheme = useCallback(() => setTheme((t) => {
    const n: Theme = t === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = n; try { localStorage.setItem("ccs-theme", n); } catch { /* ignore */ }
    return n;
  }), []);
  const v = useMemo<Ctx>(() => ({ openAppt: setDraft, theme, toggleTheme }), [theme, toggleTheme]);
  return <C.Provider value={v}>{children}{draft && <ApptModal draft={draft} onClose={() => setDraft(null)} />}</C.Provider>;
}

/** 현재 시각 (기본 1분 간격 갱신) */
export function useNow(ms = 60000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}

/** 일정 카드 ⋮ 메뉴의 빠른 상태 변경 (완료 처리 / 예약 취소 / 되돌리기) */
export function useStatusChange() {
  const { saveAppt } = useStore(); const { toast } = useToast();
  return useCallback(async (a: Appt, status: Status) => {
    try { await saveAppt({ ...a, status }); toast(status === "완료" ? "완료 처리했습니다" : status === "취소" ? "예약을 취소했습니다" : "예약으로 되돌렸습니다"); }
    catch (e) {
      // 되돌리려는 시간에 다른 일정이 있으면: 확인 후 겹친 채로 되돌릴 수 있다
      if ((e as Error & { code?: string }).code === "conflict" && confirm(`${(e as Error).message}\n\n겹쳐도 일단 되돌릴까요? (충돌로 표시됩니다)`)) {
        try { await saveAppt({ ...a, status, force: true } as unknown as Appt); toast("겹친 상태로 되돌렸습니다 — 나중에 정리해 주세요"); } catch (e2) { toast((e2 as Error).message, "err"); }
      } else toast((e as Error).message, "err");
    }
  }, [saveAppt, toast]);
}

/** 일정 영역을 화면 아래 끝까지 채운다: 영역 높이 = 창 높이 − 영역 시작 위치. 한 칸에 10타임이 꽉 차는 줄 높이(--rowh)도 함께 계산 (데스크톱만) */
export function useFitRows(deps: unknown[]) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const fit = () => {
      const el = ref.current; if (!el) return;
      if (window.innerWidth < 961) { el.style.height = ""; el.style.removeProperty("--rowh"); return; }
      const h = Math.max(360, window.innerHeight - el.getBoundingClientRect().top - window.scrollY - 14);
      el.style.height = `${h}px`;
      const list = el.querySelector<HTMLElement>(".list"); if (list) el.style.setProperty("--rowh", `${Math.max(24, (list.clientHeight - 12 - 9 * 4) / 10)}px`);
    };
    fit(); const t = setTimeout(fit, 300); window.addEventListener("resize", fit);
    return () => { clearTimeout(t); window.removeEventListener("resize", fit); };
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  return ref;
}

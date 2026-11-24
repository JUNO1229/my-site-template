"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
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
    catch (e) { toast((e as Error).message, "err"); }
  }, [saveAppt, toast]);
}

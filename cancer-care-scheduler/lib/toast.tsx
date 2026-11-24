"use client";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { Icon } from "@/components/Icons";

type Kind = "ok" | "err" | "info";
interface T { id: number; msg: string; kind: Kind }
const C = createContext<{ toast: (msg: string, kind?: Kind) => void }>({ toast: () => {} });
export const useToast = () => useContext(C);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<T[]>([]);
  const toast = useCallback((msg: string, kind: Kind = "ok") => {
    const id = Date.now() + Math.random();
    setList((l) => [...l.slice(-3), { id, msg, kind }]);
    setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), 3400);
  }, []);
  const v = useMemo(() => ({ toast }), [toast]);
  return (
    <C.Provider value={v}>{children}
      <div className="toasts" role="status" aria-live="polite">
        {list.map((t) => <div key={t.id} className={`toast ${t.kind}`}><Icon name={t.kind === "err" ? "alert" : "check"} size={18} />{t.msg}</div>)}
      </div>
    </C.Provider>
  );
}

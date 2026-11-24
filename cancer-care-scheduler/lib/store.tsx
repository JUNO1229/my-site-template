"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Appt, DB, Patient, Sickroom } from "./types";
import type { Me } from "./perm";
import { api } from "./api";

type PatientInput = Omit<Patient, "id"> & { id?: string };
type ApptInput = Omit<Appt, "id"> & { id?: string };
interface Ctx {
  db: DB; me: Me | null; ready: boolean; rev: number; refresh: () => Promise<void>;
  saveAppt: (a: ApptInput) => Promise<void>; deleteAppt: (id: string) => Promise<void>;
  savePatient: (p: PatientInput) => Promise<void>; deletePatient: (id: string) => Promise<void>;
  saveSickroom: (r: Sickroom, isNew: boolean) => Promise<void>; deleteSickroom: (roomNo: string) => Promise<void>;
}
const C = createContext<Ctx | null>(null);
export const useStore = () => { const c = useContext(C); if (!c) throw new Error("store"); return c; };

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<DB>({ rooms: [], items: [], patients: [], sickrooms: [] });
  const [me, setMe] = useState<Me | null>(null);
  const [ready, setReady] = useState(false);
  const [rev, setRev] = useState(0);
  const path = usePathname(); const router = useRouter();
  const isLogin = path.startsWith("/login");

  const refresh = useCallback(async () => {
    const r = await api<{ me: Me } & DB>("/api/bootstrap");
    setMe(r.me); setDb({ rooms: r.rooms, items: r.items, patients: r.patients, sickrooms: r.sickrooms ?? [] }); setRev((x) => x + 1);
  }, []);

  useEffect(() => {
    if (isLogin) return;
    refresh().then(() => setReady(true)).catch(() => {});
    const t = setInterval(() => refresh().catch(() => {}), 60000);
    return () => clearInterval(t);
  }, [isLogin, refresh]);
  useEffect(() => { if (me?.mustChange && path !== "/account") router.replace("/account"); }, [me, path, router]);

  const value = useMemo<Ctx>(() => ({
    db, me, ready, rev, refresh,
    saveAppt: async (a) => { await (a.id ? api(`/api/appts/${a.id}`, "PUT", a) : api("/api/appts", "POST", a)); await refresh(); },
    deleteAppt: async (id) => { await api(`/api/appts/${id}`, "DELETE"); await refresh(); },
    savePatient: async (p) => { await (p.id ? api(`/api/patients/${p.id}`, "PUT", p) : api("/api/patients", "POST", p)); await refresh(); },
    deletePatient: async (id) => { await api(`/api/patients/${id}`, "DELETE"); await refresh(); },
    saveSickroom: async (r, isNew) => { await (isNew ? api("/api/sickrooms", "POST", r) : api(`/api/sickrooms/${encodeURIComponent(r.roomNo)}`, "PUT", r)); await refresh(); },
    deleteSickroom: async (no) => { await api(`/api/sickrooms/${encodeURIComponent(no)}`, "DELETE"); await refresh(); },
  }), [db, me, ready, rev, refresh]);
  return <C.Provider value={value}>{children}</C.Provider>;
}

/** 기간 내 스케줄 조회 (15초마다 자동 갱신) */
export function useAppts(from: string, to: string, patientId?: string) {
  const { rev, ready } = useStore();
  const [appts, setAppts] = useState<Appt[]>([]);
  useEffect(() => {
    if (!ready) return;
    let alive = true;
    const load = () => api<{ appts: Appt[] }>(`/api/appts?from=${from}&to=${to}${patientId ? `&patientId=${patientId}` : ""}`)
      .then((r) => alive && setAppts(r.appts)).catch(() => {});
    load(); const t = setInterval(load, 15000);
    return () => { alive = false; clearInterval(t); };
  }, [from, to, patientId, rev, ready]);
  return appts;
}

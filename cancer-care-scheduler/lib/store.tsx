"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Appt, DB, Patient, Room, Item } from "./types";
import { makeSeed } from "./seed";
import { uid } from "./util";

const KEY = "cancer-care-scheduler.v1";
interface Ctx {
  db: DB; ready: boolean;
  saveAppt: (a: Omit<Appt, "id"> & { id?: string }) => void; deleteAppt: (id: string) => void;
  savePatient: (p: Omit<Patient, "id"> & { id?: string }) => void; deletePatient: (id: string) => void;
  saveRoom: (r: Room) => void; saveItem: (i: Item) => void; resetDemo: () => void; replaceAll: (d: DB) => void;
}
const C = createContext<Ctx | null>(null);
export const useStore = () => { const c = useContext(C); if (!c) throw new Error("store"); return c; };

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<DB>({ rooms: [], items: [], patients: [], appts: [], version: 1 });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try { const raw = localStorage.getItem(KEY); setDb(raw ? JSON.parse(raw) : makeSeed()); }
    catch { setDb(makeSeed()); }
    setReady(true);
    const onStorage = (e: StorageEvent) => { if (e.key === KEY && e.newValue) setDb(JSON.parse(e.newValue)); };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const commit = useCallback((fn: (d: DB) => DB) => {
    setDb((prev) => { const next = fn(prev); try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {} return next; });
  }, []);

  const value = useMemo<Ctx>(() => ({
    db, ready,
    saveAppt: (a) => commit((d) => ({ ...d, appts: a.id && d.appts.some((x) => x.id === a.id)
      ? d.appts.map((x) => (x.id === a.id ? { ...x, ...a } as Appt : x)) : [...d.appts, { ...a, id: uid() } as Appt] })),
    deleteAppt: (id) => commit((d) => ({ ...d, appts: d.appts.filter((x) => x.id !== id) })),
    savePatient: (p) => commit((d) => ({ ...d, patients: p.id && d.patients.some((x) => x.id === p.id)
      ? d.patients.map((x) => (x.id === p.id ? { ...x, ...p } as Patient : x)) : [...d.patients, { ...p, id: uid() } as Patient] })),
    deletePatient: (id) => commit((d) => ({ ...d, patients: d.patients.filter((x) => x.id !== id), appts: d.appts.filter((a) => a.patientId !== id) })),
    saveRoom: (r) => commit((d) => ({ ...d, rooms: d.rooms.map((x) => (x.id === r.id ? r : x)) })),
    saveItem: (i) => commit((d) => ({ ...d, items: d.items.map((x) => (x.id === i.id ? i : x)) })),
    resetDemo: () => commit(() => makeSeed()),
    replaceAll: (n) => commit(() => n),
  }), [db, ready, commit]);
  return <C.Provider value={value}>{children}</C.Provider>;
}

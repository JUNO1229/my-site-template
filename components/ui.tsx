import { CONF_KO, STAGE_KO, type Stage } from "@/lib/domain"
export function Flash({ err, ok }: { err?: string; ok?: string }) {
  if (err) return <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>
  if (ok) return <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{ok}</p>
  return null
}
const GC: Record<string, string> = { A: "bg-red-100 text-red-700", B: "bg-amber-100 text-amber-700", C: "bg-slate-100 text-slate-600" }
export const Grade = ({ g }: { g: string }) => <span className={`rounded px-1.5 py-0.5 text-xs font-bold ${GC[g] ?? ""}`}>{g}</span>
export const Stg = ({ s }: { s: string }) => <span className="text-xs">{STAGE_KO[s as Stage] ?? s}</span>
export const Conf = ({ c }: { c?: string | null }) => c ? <span className={`text-xs ${c === "verified_official" ? "text-green-700" : c === "third_party_recheck" ? "text-amber-700" : "text-slate-500"}`}>{CONF_KO[c] ?? c}</span> : null

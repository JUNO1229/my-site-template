// 구글 시트(CSV) → 환자/스케줄 변환. 외부 의존성 없음(브라우저·Node 공용).
export interface PatientRow { name: string; ward: string; chart_no: string; bed: string; admit_date: string; discharge_date: string; plan: string; notes: string; contract_amount: number | null }
export interface ApptRow { name: string; ward: string; appt_date: string; appt_time: string; item_id: string; opt: string; status: string; memo: string }
export interface ImportPlan {
  files: { name: string; kind: "환자명부" | "스케줄" | "알 수 없음"; rows: number }[];
  patients: PatientRow[]; stubs: PatientRow[]; appts: ApptRow[];
  skipped: Record<string, number>; unknownTreat: Record<string, number>; range: [string, string] | null;
}

export function parseCsv(text: string): string[][] {
  const out: string[][] = []; let row: string[] = [], cur = "", q = false;
  const s = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === '"') { if (s[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(cur); cur = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && s[i + 1] === "\n") i++; row.push(cur); out.push(row); row = []; cur = ""; }
    else cur += c;
  }
  if (cur !== "" || row.length) { row.push(cur); out.push(row); }
  return out;
}

const squash = (s: string) => (s ?? "").replace(/\s+/g, "");
const clean = (s: string) => (s ?? "").replace(/\s+/g, " ").trim();
export function normDate(s: string): string {
  const m = (s ?? "").match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
  return m ? `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}` : "";
}
export function normAmount(s: string): number | null {
  const t = (s ?? "").replace(/[,\s원]/g, ""); return /^\d+$/.test(t) ? Number(t) : null;
}
export function normTime(s: string): string {
  const m = (s ?? "").match(/(\d{1,2}):(\d{2})/);
  if (!m || +m[1] > 23 || +m[2] > 59) return "";
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}
export function splitPatient(s: string): { name: string; ward: string } {
  const t = clean(s); const m = t.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
  return m ? { name: m[1].trim(), ward: m[2].trim() } : { name: t, ward: "" };
}
export function mapTreatment(raw: string): string | null {
  const t = squash(raw).replace(/\(통원\)/, "(통원)").toUpperCase();
  if (/^(도수|통증\(도수\)|도수치료)$/.test(t)) return "ds";
  if (/^페인[잼젬]머$/.test(t)) return "pj";
  if (t === "파동") return "pd";
  if (t === "림프1") return "lp1";
  if (t === "림프2" ) return "lp2";
  if (t === "림프") return "lp1";
  if (/^(통증\()?역박동\)?$/.test(t)) return "rb";
  if (/^고주파\((BSD|ESD)\)$/.test(t)) return "hf-bsd";
  if (t === "고주파(EHY1)") return "hf-e1";
  if (t === "고주파(EHY2)") return "hf-e2";
  if (t === "고주파(통원)") return "hf-out";
  return null;
}
export function mapStatus(raw: string): string {
  const t = squash(raw);
  if (t.includes("취소")) return "취소";
  if (t.includes("연기")) return "연기";
  if (t.includes("완료")) return "완료";
  return "예약";
}
const OPTS = new Set(["K", "C", "S", "J", "무료"]);
const bump = (o: Record<string, number>, k: string) => { o[k] = (o[k] ?? 0) + 1; };

export function analyze(files: { name: string; text: string }[]): ImportPlan {
  const plan: ImportPlan = { files: [], patients: [], stubs: [], appts: [], skipped: {}, unknownTreat: {}, range: null };
  const reg = new Map<string, PatientRow>(); const stub = new Map<string, PatientRow>();
  const sched: { name: string; ward: string; d: string; t: string; item: string; opt: string; st: string; info: string; note: string }[] = [];

  for (const f of files) {
    const rows = parseCsv(f.text);
    const hdr = rows.slice(0, 20).findIndex((r) => r.some((c) => squash(c) === "환자이름+병동") || (r.some((c) => squash(c) === "치료일자") && r.some((c) => squash(c).startsWith("환자명"))));
    if (hdr < 0) { plan.files.push({ name: f.name, kind: "알 수 없음", rows: 0 }); continue; }
    const h = rows[hdr].map(squash);
    if (h.includes("환자이름+병동")) {
      const c = (n: string) => h.indexOf(n);
      const cName = c("환자이름+병동"), cChart = c("차트번호"), cPat = c("환자명"), cBed = c("입원병실/외래"), cWard = c("병동");
      const cAdm = c("입원일/치료시작일"), cDis = c("퇴원일/치료종료일");
      let n = 0;
      for (const r of rows.slice(hdr + 1)) {
        const sp = splitPatient(r[cName] ?? ""); const name = sp.name || clean(r[cPat] ?? ""); if (!name) continue;
        const ward = sp.ward || clean(r[cWard] ?? "");
        const p: PatientRow = { name, ward, chart_no: clean(r[cChart] ?? ""), bed: clean(r[cBed] ?? ""),
          admit_date: normDate(r[cAdm] ?? ""), discharge_date: normDate(r[cDis] ?? ""),
          plan: clean(r[cDis + 1] ?? ""), notes: clean(r[cDis + 3] ?? ""), contract_amount: normAmount(r[cDis + 2] ?? "") };
        const k = `${name}|${ward}`; const old = reg.get(k);
        reg.set(k, old ? Object.fromEntries(Object.entries(p).map(([a, b]) => [a, b === "" || b === null ? (old as never)[a] : b])) as unknown as PatientRow : p); n++;
      }
      plan.files.push({ name: f.name, kind: "환자명부", rows: n });
    } else {
      const cDate = h.indexOf("치료일자"), cTime = h.indexOf("치료시작시간"), cPat = h.findIndex((x) => x.startsWith("환자명"));
      const cT = Math.max(cDate, cTime, cPat) + 1; let n = 0;
      for (const r of rows.slice(hdr + 1)) {
        const patRaw = clean(r[cPat] ?? ""), dRaw = r[cDate] ?? "";
        if (!patRaw || !dRaw) continue; // 빈 양식 행
        const d = normDate(dRaw); if (!d) { bump(plan.skipped, "날짜 형식 오류"); continue; }
        const t = normTime(r[cTime] ?? ""); if (!t) { bump(plan.skipped, "시간 없음/형식 오류"); continue; }
        const item = mapTreatment(r[cT] ?? ""); if (!item) { bump(plan.unknownTreat, clean(r[cT] ?? "") || "(빈 값)"); continue; }
        const sp = splitPatient(patRaw); if (!sp.name) continue;
        const o = clean(r[cT + 1] ?? ""); n++;
        sched.push({ name: sp.name, ward: sp.ward, d, t, item, opt: OPTS.has(o) && o !== "J" ? (o === "무료" ? "기타" : o) : "", st: mapStatus(r[cT + 2] ?? ""), info: clean(r[cT + 3] ?? ""), note: clean(r[cT + 4] ?? "") });
      }
      plan.files.push({ name: f.name, kind: "스케줄", rows: n });
    }
  }

  // 병동 표기 없는 이름 → 명부에서 이름이 유일하면 그 환자로 연결
  const byName = new Map<string, PatientRow[]>();
  for (const p of reg.values()) byName.set(p.name, [...(byName.get(p.name) ?? []), p]);
  const seen = new Set<string>();
  for (const s of sched) {
    let ward = s.ward;
    if (!ward) { const c = byName.get(s.name); if (c?.length === 1) ward = c[0].ward; }
    const k = `${s.name}|${ward}`;
    if (!reg.has(k) && !stub.has(k)) stub.set(k, { name: s.name, ward, chart_no: "", bed: "", admit_date: "", discharge_date: "", plan: s.info, notes: s.note || "스케줄 기록에서 자동 생성(환자명부에 없음)", contract_amount: null });
    const key = `${k}|${s.d}|${s.t}|${s.item}`;
    if (seen.has(key)) { bump(plan.skipped, "중복 행(같은 환자·일시·치료)"); continue; }
    seen.add(key);
    plan.appts.push({ name: s.name, ward, appt_date: s.d, appt_time: s.t, item_id: s.item, opt: s.opt, status: s.st, memo: "" });
  }
  plan.patients = [...reg.values()]; plan.stubs = [...stub.values()];
  if (plan.appts.length) { const ds = plan.appts.map((a) => a.appt_date).sort(); plan.range = [ds[0], ds[ds.length - 1]]; }
  return plan;
}

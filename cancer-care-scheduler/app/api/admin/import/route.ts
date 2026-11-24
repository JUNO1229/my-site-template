import { audit, body, HttpError, route } from "@/lib/server/auth";
import { q } from "@/lib/server/db";
import { isDate, isTime, OPTS, STATUS, str } from "@/lib/server/validate";

const MAX = 3000;
const arr = (v: unknown) => { if (!Array.isArray(v) || v.length > MAX) throw new HttpError(400, `한 번에 ${MAX}건까지 처리할 수 있습니다`); return v as Record<string, unknown>[]; };
const optDate = (v: unknown) => { const s = str(v, 10); return isDate(s) ? s : ""; };

export const POST = route(async (req) => {
  const b = await body(req); const rows = arr(b.rows);
  if (b.kind === "patients" || b.kind === "stubs") {
    const data = rows.filter((r) => str(r.name, 50)).map((r) => ({
      name: str(r.name, 50), ward: str(r.ward, 5), chart_no: str(r.chart_no, 30), bed: str(r.bed, 20),
      admit_date: optDate(r.admit_date), discharge_date: optDate(r.discharge_date), plan: str(r.plan, 500), notes: str(r.notes, 500),
      contract_amount: Number.isInteger(r.contract_amount) && (r.contract_amount as number) >= 0 ? r.contract_amount : null }));
    const keep = (c: string) => `${c}=CASE WHEN EXCLUDED.${c}<>'' THEN EXCLUDED.${c} ELSE patients.${c} END`;
    const conflict = b.kind === "patients"
      ? `ON CONFLICT (name,ward) DO UPDATE SET ${["chart_no", "bed", "admit_date", "discharge_date", "plan", "notes"].map(keep).join(",")},contract_amount=COALESCE(EXCLUDED.contract_amount,patients.contract_amount),source='registry'`
      : "ON CONFLICT (name,ward) DO NOTHING";
    const r = await q(`WITH x AS (SELECT * FROM json_to_recordset($1::json) AS t(name text,ward text,chart_no text,bed text,admit_date text,discharge_date text,plan text,notes text,contract_amount int)),
      ins AS (INSERT INTO patients(id,chart_no,name,ward,bed,admit_date,discharge_date,plan,notes,contract_amount,source)
        SELECT gen_random_uuid()::text,chart_no,name,ward,bed,admit_date,discharge_date,plan,notes,contract_amount,'${b.kind === "stubs" ? "auto" : "registry"}' FROM x ${conflict} RETURNING (xmax=0) AS inserted)
      SELECT count(*) FILTER (WHERE inserted)::int AS inserted, count(*) FILTER (WHERE NOT inserted)::int AS updated FROM ins`, [JSON.stringify(data)]);
    return { inserted: r[0].inserted, updated: r[0].updated };
  }
  if (b.kind === "appts") {
    const items = new Set((await q("SELECT id FROM items")).map((i) => i.id as string));
    const data = rows.filter((r) => str(r.name, 50) && isDate(r.appt_date) && isTime(r.appt_time) && items.has(str(r.item_id)) && STATUS.includes(str(r.status)) && OPTS.includes(str(r.opt)))
      .map((r) => ({ name: str(r.name, 50), ward: str(r.ward, 5), appt_date: r.appt_date, appt_time: r.appt_time, item_id: str(r.item_id), opt: str(r.opt), status: str(r.status), memo: str(r.memo, 300) }));
    const r = await q(`WITH x AS (SELECT * FROM json_to_recordset($1::json) AS t(name text,ward text,appt_date text,appt_time text,item_id text,opt text,status text,memo text)),
      ins AS (INSERT INTO appts(id,patient_id,appt_date,appt_time,item_id,opt,status,memo,created_by)
        SELECT gen_random_uuid()::text,p.id,x.appt_date,x.appt_time,x.item_id,x.opt,x.status,x.memo,'import' FROM x JOIN patients p ON p.name=x.name AND p.ward=x.ward
        WHERE NOT EXISTS (SELECT 1 FROM appts a WHERE a.patient_id=p.id AND a.appt_date=x.appt_date AND a.appt_time=x.appt_time AND a.item_id=x.item_id) RETURNING 1)
      SELECT count(*)::int AS inserted FROM ins`, [JSON.stringify(data)]);
    return { inserted: r[0].inserted, skipped: rows.length - r[0].inserted };
  }
  throw new HttpError(400, "잘못된 요청입니다");
}, { roles: ["admin"] });

export const PUT = route(async (req, _c, me) => {
  const b = await body(req); await audit(me.username, "data_import", str(b.summary, 400));
}, { roles: ["admin"] });

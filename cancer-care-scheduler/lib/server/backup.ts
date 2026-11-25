import { q } from "./db";

const KEEP = 10;
/** 전체 삭제·교체·복원 직전에 환자·스케줄 전체를 DB에 백업한다 (최근 10개 보관). 비어 있으면 건너뛴다. */
export async function backupBefore(reason: string, user: string) {
  const r = await q(`WITH p AS (SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) AS d, count(*)::int AS n FROM patients x),
    a AS (SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) AS d, count(*)::int AS n FROM appts x)
    INSERT INTO data_backups(reason,created_by,n_patients,n_appts,patients,appts)
    SELECT $1,$2,p.n,a.n,p.d,a.d FROM p,a WHERE p.n+a.n>0 RETURNING id`, [reason, user]);
  await q("DELETE FROM data_backups WHERE id NOT IN (SELECT id FROM data_backups ORDER BY id DESC LIMIT $1)", [KEEP]);
  return r[0]?.id as number | undefined;
}
export async function restoreBackup(id: number) {
  const b = (await q("SELECT patients,appts FROM data_backups WHERE id=$1", [id]))[0];
  if (!b) return null;
  await q("DELETE FROM appts"); await q("DELETE FROM patients");
  await q("INSERT INTO patients SELECT * FROM jsonb_populate_recordset(null::patients,$1::jsonb)", [JSON.stringify(b.patients)]);
  await q("INSERT INTO appts SELECT * FROM jsonb_populate_recordset(null::appts,$1::jsonb)", [JSON.stringify(b.appts)]);
  return true;
}

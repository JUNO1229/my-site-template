import { PGlite } from "@electric-sql/pglite"
import { readFileSync } from "fs"
import { setClient } from "@/lib/db"

export async function freshDb() {
  const pg = new PGlite()
  await pg.exec(readFileSync("db/schema.sql", "utf8"))
  setClient({ query: (t, p) => pg.query(t, p as any[]) as any })
  const q = (t: string, p: unknown[] = []) => pg.query(t, p as any[]).then((r) => r.rows as any[])
  const lead = async (name: string, grade = "A", extra: Partial<{ kind: string; addr: string }> = {}) => {
    const r = await q(`INSERT INTO leads(lead_type,name,sido,address,facility_kind,grade,score) VALUES('private_facility',$1,'경기도',$2,$3,$4,10) RETURNING id`,
      [name, extra.addr ?? "", extra.kind ?? "물놀이", grade])
    await q(`INSERT INTO outreach(lead_id) VALUES($1)`, [r[0].id])
    return r[0].id as number
  }
  return { pg, q, lead }
}

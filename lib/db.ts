import { Pool } from 'pg'

type G = typeof globalThis & { __mem?: Map<string, unknown>; __pool?: Pool; __init?: Promise<unknown> }
const g = globalThis as G
const url = process.env.DATABASE_URL || process.env.POSTGRES_URL
export const usingPg = !!url
const mem = (g.__mem ??= new Map<string, unknown>())

function pool() {
  return (g.__pool ??= new Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 3 }))
}
async function ready() {
  if (!usingPg) return
  g.__init ??= pool().query('create table if not exists kv(key text primary key, val jsonb not null)')
  await g.__init
}

export async function get<T>(key: string): Promise<T | null> {
  if (!usingPg) return (mem.get(key) as T) ?? null
  await ready()
  const r = await pool().query('select val from kv where key=$1', [key])
  return r.rows[0]?.val ?? null
}
export async function set(key: string, val: unknown) {
  if (!usingPg) { mem.set(key, JSON.parse(JSON.stringify(val))); return }
  await ready()
  await pool().query('insert into kv(key,val) values($1,$2) on conflict(key) do update set val=excluded.val', [key, JSON.stringify(val)])
}
export async function del(key: string) {
  if (!usingPg) { mem.delete(key); return }
  await ready()
  await pool().query('delete from kv where key=$1', [key])
}
export async function list<T>(prefix: string): Promise<T[]> {
  if (!usingPg) return [...mem.entries()].filter(([k]) => k.startsWith(prefix)).sort(([a], [b]) => (a < b ? -1 : 1)).map(([, v]) => JSON.parse(JSON.stringify(v)) as T)
  await ready()
  const r = await pool().query('select val from kv where key like $1 order by key', [prefix.replace(/[%_\\]/g, '\\$&') + '%'])
  return r.rows.map((x) => x.val)
}
/** 원자적 증가(접수번호 순번). Postgres는 upsert 한 문장으로 동시 접수에도 겹치지 않는다. */
export async function incr(key: string): Promise<number> {
  if (!usingPg) { const n = ((mem.get(key) as number) ?? 0) + 1; mem.set(key, n); return n }
  await ready()
  const r = await pool().query(
    "insert into kv(key,val) values($1,'1'::jsonb) on conflict(key) do update set val=to_jsonb((kv.val#>>'{}')::int+1) returning val", [key])
  return Number(r.rows[0].val)
}

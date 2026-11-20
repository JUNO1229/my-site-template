import { Pool } from "pg"

export type Client = { query: (text: string, params?: unknown[]) => Promise<{ rows: any[] }> }
let client: Client | null = null

/** 테스트에서 PGlite 등을 주입한다. */
export function setClient(c: Client | null) { client = c }

function get(): Client {
  if (client) return client
  const url = process.env.DATABASE_URL
  if (!url) throw new Error("DATABASE_URL 이 설정되지 않았습니다")
  const g = globalThis as any
  g.__pool ??= new Pool({ connectionString: url, max: Number(process.env.PG_POOL_MAX ?? 3), ssl: url.includes("localhost") ? undefined : { rejectUnauthorized: false } })
  return g.__pool as Client
}

export async function query<T = any>(text: string, params: unknown[] = []): Promise<T[]> {
  return (await get().query(text, params)).rows as T[]
}
export async function one<T = any>(text: string, params: unknown[] = []): Promise<T | undefined> {
  return (await query<T>(text, params))[0]
}

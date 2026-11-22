import pg from "pg"
const g = globalThis as unknown as { _pool?: pg.Pool }
export function pool() {
  if (!g._pool) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error("DATABASE_URL이 설정되지 않았습니다")
    g._pool = new pg.Pool({ connectionString: url, max: 3, ssl: url.includes("localhost") ? undefined : { rejectUnauthorized: false } })
  }
  return g._pool
}
export async function q<T = any>(text: string, params: unknown[] = []): Promise<T[]> {
  return (await pool().query(text, params as any[])).rows as T[]
}

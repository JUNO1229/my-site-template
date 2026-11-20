// 마이그레이션/시드용 클라이언트. 기본은 pg(TCP). NEON_HTTP=1 이면 HTTPS 로 접속(5432 가 막힌 환경용, HTTPS_PROXY 지원).
import pg from "pg"
export async function connect() {
  const url = process.env.DATABASE_URL
  if (!url) { console.error("DATABASE_URL 필요"); process.exit(1) }
  if (process.env.NEON_HTTP === "1") {
    if (process.env.HTTPS_PROXY) {
      const { setGlobalDispatcher, ProxyAgent } = await import("undici")
      setGlobalDispatcher(new ProxyAgent(process.env.HTTPS_PROXY))
    }
    const { neon } = await import("@neondatabase/serverless")
    const sql = neon(url, { fullResults: true })
    return { http: true, query: (t, p) => sql.query(t, p ?? []), end: async () => {} }
  }
  const c = new pg.Client({ connectionString: url, ssl: url.includes("localhost") ? undefined : { rejectUnauthorized: false } })
  await c.connect()
  return c
}

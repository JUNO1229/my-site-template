// 스키마 적용 (멱등). 사용: DATABASE_URL=... npm run db:migrate
import pg from "pg"
import { readFileSync } from "fs"
const url = process.env.DATABASE_URL
if (!url) { console.error("DATABASE_URL 필요"); process.exit(1) }
const c = new pg.Client({ connectionString: url, ssl: url.includes("localhost") ? undefined : { rejectUnauthorized: false } })
await c.connect()
await c.query(readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8"))
console.log("migrated")
await c.end()

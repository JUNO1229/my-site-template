// 스키마 적용(멱등). 사용: DATABASE_URL=... npm run db:migrate
import { connect } from "./db-client.mjs"
import { readFileSync } from "fs"
const c = await connect()
const ddl = readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8")
if (c.http) for (const st of ddl.replace(/--.*$/gm, "").split(";").map((x) => x.trim()).filter(Boolean)) await c.query(st)
else await c.query(ddl)
console.log("migrated"); await c.end()

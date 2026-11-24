import { neon } from "@neondatabase/serverless";
type Q = (text: string, params?: unknown[]) => Promise<Record<string, any>[]>; // eslint-disable-line
let _q: Q | null = null;
export const q: Q = (text, params = []) => {
  if (!_q) {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL 미설정");
    const sql = neon(process.env.DATABASE_URL);
    _q = (t, p = []) => sql.query(t, p) as Promise<Record<string, any>[]>; // eslint-disable-line
  }
  return _q(text, params);
};

import { q } from "./db";
import seed from "../catalogSeed.json";

export const mItem = (r: any) => ({ code: r.code, name: r.name, short: r.short, aliases: r.aliases, category: r.category, kind: r.kind, unit: r.unit,
  defaultPerWeek: r.default_per_week, defaultPerMonth: r.default_per_month, variants: r.variants, maxStage: r.max_stage, followable: r.followable, followTargets: r.follow_targets,
  followOnly: r.follow_only, roomItemIds: r.room_item_ids, active: r.active, builtin: r.builtin, note: r.note, sort: r.sort });
export const mCycle = (r: any) => ({ id: r.id, label: r.label, perWeek: r.per_week, perMonth: r.per_month, everyOtherWeek: r.every_other_week, sort: r.sort });

/** 처음 열 때 현장 표기 기준의 기본 목록을 채운다 */
export async function ensureSeed() {
  await q(`CREATE TABLE IF NOT EXISTS treatment_catalog (code TEXT PRIMARY KEY, name TEXT NOT NULL, short TEXT NOT NULL DEFAULT '', aliases TEXT[] NOT NULL DEFAULT '{}', category TEXT NOT NULL DEFAULT '',
    kind TEXT NOT NULL DEFAULT 'session', unit TEXT NOT NULL DEFAULT '', default_per_week INT, default_per_month INT, variants TEXT[] NOT NULL DEFAULT '{}', max_stage INT NOT NULL DEFAULT 0,
    followable BOOLEAN NOT NULL DEFAULT false, follow_targets TEXT[] NOT NULL DEFAULT '{}', follow_only BOOLEAN NOT NULL DEFAULT false, room_item_ids TEXT[] NOT NULL DEFAULT '{}',
    active BOOLEAN NOT NULL DEFAULT true, builtin BOOLEAN NOT NULL DEFAULT false, note TEXT NOT NULL DEFAULT '', sort INT NOT NULL DEFAULT 0)`);
  await q("CREATE TABLE IF NOT EXISTS treatment_cycles (id SERIAL PRIMARY KEY, label TEXT NOT NULL, per_week INT, per_month INT, every_other_week INT, sort INT NOT NULL DEFAULT 0)");
  if (!(await q("SELECT 1 FROM treatment_catalog LIMIT 1")).length) {
    let i = 0;
    for (const t of seed.items) await q(`INSERT INTO treatment_catalog(code,name,short,aliases,category,kind,unit,variants,max_stage,followable,follow_targets,follow_only,room_item_ids,builtin,sort)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) ON CONFLICT DO NOTHING`,
      [t.code, t.name, t.short, t.aliases, t.category, t.kind, t.unit, t.variants, t.maxStage, t.followable, t.followTargets, t.followOnly, t.roomItemIds, t.builtin, i++]);
  }
  if (!(await q("SELECT 1 FROM treatment_cycles LIMIT 1")).length) {
    let i = 0; for (const c of seed.cycles) await q("INSERT INTO treatment_cycles(label,per_week,per_month,every_other_week,sort) VALUES($1,$2,$3,$4,$5)", [c.label, c.perWeek, c.perMonth, c.everyOtherWeek, i++]);
  }
}

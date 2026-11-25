import { audit, body, HttpError, route } from "@/lib/server/auth";
import { q } from "@/lib/server/db";
import { ensureSeed, mCycle, mItem } from "@/lib/server/catalog";
import { str } from "@/lib/server/validate";
import crypto from "node:crypto";

export const dynamic = "force-dynamic";
export const GET = route(async () => {
  await ensureSeed();
  const [items, cycles] = await Promise.all([q("SELECT * FROM treatment_catalog ORDER BY sort,code"), q("SELECT * FROM treatment_cycles ORDER BY sort,id")]);
  return { items: items.map(mItem), cycles: cycles.map(mCycle) };
});

const list = (v: unknown, max = 20, len = 30) => (Array.isArray(v) ? v : typeof v === "string" ? v.split(",") : []).map((x) => String(x).normalize("NFC").trim().slice(0, len)).filter(Boolean).filter((x, i, a) => a.indexOf(x) === i).slice(0, max);
const intOrNull = (v: unknown, max = 99) => { if (v === null || v === "" || v === undefined) return null; const n = Number(v); if (!Number.isInteger(n) || n < 0 || n > max) throw new HttpError(400, "숫자는 0 이상 정수로 입력해 주세요"); return n; };

/** 치료항목 추가·수정 (code 가 있으면 수정) */
export const POST = route(async (req, _c, me) => {
  const b = await body(req); await ensureSeed();
  const name = str(b.name, 40), short = str(b.short, 20) || name;
  if (!name) throw new HttpError(400, "치료 명칭을 입력해 주세요");
  const kind = b.kind === "qty" ? "qty" : "session", unit = kind === "qty" ? str(b.unit, 5) : str(b.unit, 5);
  const aliases = list(b.aliases), variants = list(b.variants, 10, 10).map((x) => x.toUpperCase());
  const followTargets = b.followable === true ? list(b.followTargets, 10, 10) : [];
  const f = [name, short, aliases, str(b.category, 20), kind, unit, intOrNull(b.defaultPerWeek, 14), intOrNull(b.defaultPerMonth, 60), variants, intOrNull(b.maxStage, 9) ?? 0,
    b.followable === true, followTargets, b.followOnly === true, list(b.roomItemIds, 10, 40), b.active !== false, str(b.note, 200)];
  const code = str(b.code, 40);
  if (code) {
    const r = await q(`UPDATE treatment_catalog SET name=$2,short=$3,aliases=$4,category=$5,kind=$6,unit=$7,default_per_week=$8,default_per_month=$9,variants=$10,max_stage=$11,followable=$12,follow_targets=$13,follow_only=$14,room_item_ids=$15,active=$16,note=$17 WHERE code=$1 RETURNING code`, [code, ...f]);
    if (!r.length) throw new HttpError(404, "치료항목을 찾을 수 없습니다");
    await audit(me.username, "treatment_update", `${name} (${code})`); return { code };
  }
  const nc = "c_" + crypto.randomBytes(4).toString("hex"); const sort = (await q("SELECT coalesce(max(sort),0)+1 AS n FROM treatment_catalog"))[0].n;
  await q(`INSERT INTO treatment_catalog(code,name,short,aliases,category,kind,unit,default_per_week,default_per_month,variants,max_stage,followable,follow_targets,follow_only,room_item_ids,active,note,sort)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`, [nc, ...f, sort]);
  await audit(me.username, "treatment_create", `${name} (${nc})`); return { code: nc };
}, { roles: ["admin", "manager"] });

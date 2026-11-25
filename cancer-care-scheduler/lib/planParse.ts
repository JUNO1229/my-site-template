/** 치료정보 자유 텍스트 → 구조 해석(제안용). 100% 자동 해석을 목표로 하지 않고, 확인이 필요한 부분을 질문으로 돌려준다. */
export type Opt = "S" | "K" | "C" | "";
export interface Follow { item: string; n: number | null; basis?: "week" | "month"; opt?: Opt }
export interface PlanItem {
  code: string; name: string; raw: string; variant?: string; stage?: number;
  perWeek?: number; perMonth?: number; everyOtherWeek?: number; total?: number; qty?: number; unit?: string; option?: Opt;
  follow?: Follow[]; followBasis?: "week" | "month" | "unknown"; q: string[];
}
export interface PlanResult { items: PlanItem[]; notes: string[]; questions: string[]; status: "ok" | "check" | "fail" }

interface Cat { code: string; name: string; short: string; kind: "s" | "q"; rx: string }
export const CATALOG: Cat[] = [
  { code: "hbo", name: "고압산소", short: "고압산소", kind: "s", rx: "고압산소" },
  { code: "hf_bsd", name: "고주파BSD", short: "고BSD", kind: "s", rx: "고(?:주파)?\\(?BSD\\)?" },
  { code: "hf_onco", name: "고주파(온코)", short: "고(온)", kind: "s", rx: "고(?:주파)?(?:\\(?(?:온코|온|25)\\)?)?(?=[\\d(주월\\s+*]|$)" },
  { code: "psy", name: "싸이케어 주사", short: "싸이", kind: "s", rx: "싸이(?:케어)?" },
  { code: "imu", name: "이뮤알파 주사", short: "이뮤", kind: "s", rx: "이뮤(?:알파)?" },
  { code: "abn", name: "압노바", short: "압", kind: "s", rx: "압(?:노바)?(?:[AMFQ])?" },
  { code: "isk", name: "이스카도", short: "이스카", kind: "s", rx: "이스(?:카(?:도)?)?(?:Q)?" },
  { code: "mer", name: "메리트씨 주사", short: "메리트씨", kind: "s", rx: "메리트(?:씨)?" },
  { code: "mes", name: "메시마", short: "메시마", kind: "q", rx: "메(?:시마)?(?:F)?(?=[\\d(F포\\s+*]|$)" },
  { code: "gun", name: "건칠단", short: "건칠단", kind: "q", rx: "건칠단?" },
  { code: "pj", name: "페인잼머", short: "PJ", kind: "s", rx: "(?:pj|PJ|페인잼머)" },
  { code: "gct", name: "지씨타치온", short: "지씨타", kind: "s", rx: "(?:지씨타(?:치온)?|구치온)" },
  { code: "nut", name: "영양제(라보솔·콤비)", short: "영양제", kind: "s", rx: "(?:영양제|라보솔|콤비(?:플렉스)?)" },
  { code: "nad", name: "나드정", short: "나드정", kind: "q", rx: "나드정" },
  { code: "pdq", name: "피도큐산", short: "피도큐산", kind: "q", rx: "피도큐산" },
  { code: "glu", name: "글루치온", short: "글루치온", kind: "q", rx: "글루치온정?" },
  { code: "vc", name: "비타민C(VC)", short: "VC", kind: "s", rx: "(?:VC\\d*V?|비타민C)" },
  { code: "wav", name: "파동", short: "파동", kind: "s", rx: "파동" },
  { code: "rev", name: "역박동", short: "역박동", kind: "s", rx: "역박동" },
];
const FOLLOW_NAME: Record<string, string> = { 도: "도수", 도수: "도수", 림: "림프", 림프: "림프", 파: "파동", 파동: "파동", 역: "역박동", 역박동: "역박동" };
const FOLLOW_RX = /(도수|도|림프|림|파동|파|역박동|역)\s*\)?\s*(?:\(\s*월\s*(\d+)\s*\)|월\s*(\d+)|(\d+)\s*회?|\(\s*주\s*(\d+)\s*\))?\s*(?:\(?\s*(월\s*\d+\s*회?)?\s*([SsKk])\s*\)?)?/g;

const norm = (t: string) => t.replace(/\(얼(\d+)\)/g, "(월$1)").replace(/[＋]/g, "+").replace(/\s+/g, " ").trim();
const catOf = (code: string) => CATALOG.find((c) => c.code === code)!;

/** 한 텍스트에서 항목 시작 위치를 찾는다 (가장 긴 약어 우선) */
function starts(seg: string, inPj: boolean): { i: number; len: number; code: string }[] {
  const out: { i: number; len: number; code: string }[] = [];
  let pos = 0;
  while (pos < seg.length) {
    let best: { i: number; len: number; code: string } | null = null;
    for (const c of CATALOG) {
      const m = new RegExp(c.rx, "y"); m.lastIndex = pos;
      const r = m.exec(seg);
      if (r && (!best || r[0].length > best.len)) best = { i: pos, len: r[0].length, code: c.code };
    }
    if (best && best.len > 0) {
      const code = best.code, after = seg.slice(best.i + best.len);
      // 페인잼머 뒤에 바로 붙은 파동/역박동은 후속치료, 공백 뒤 + 횟수 표기가 있으면 별도 항목
      const asFollow = inPj && (code === "wav" || code === "rev") && !(pos > 0 && seg[pos - 1] === " " && /^\s*(?:주\s*\d|\(?월\s*\d|\d+\s*회|S|\(S\))/.test(after));
      if (!asFollow) { out.push(best); pos = best.i + best.len; if (code === "pj") inPj = true; else if (!(code === "wav" || code === "rev")) inPj = false; continue; }
    }
    pos++;
  }
  return out;
}

function parseOne(code: string, text: string): PlanItem {
  const cat = catOf(code); const it: PlanItem = { code, name: cat.name, raw: text.trim(), q: [] };
  const rx = new RegExp("^" + cat.rx); const m = rx.exec(text); const rest = text.slice(m ? m[0].length : 0);
  if (code === "abn") {
    const v = /^압(?:노바)?([AMFQ])?/.exec(text); if (v?.[1]) it.variant = v[1];
    const st = /(\d)\s*단계/.exec(text); if (st) it.stage = Number(st[1]);
    const vv = /\(\s*([AMFQ])\s*\d\s*단계\s*\)/.exec(text); if (vv && !it.variant) it.variant = vv[1];
    if (!it.variant) it.q.push(`압노바 종류(A·M·F·Q)가 표기되지 않았습니다 ('${it.raw}')`);
  }
  if (code === "hf_onco") {
    const b = /^고(?:주파)?\(?(온코|온|25)?\)?/.exec(text)?.[1];
    if (b === "25") it.q.push("'고(25)'의 25는 무슨 뜻인가요?");
    else if (!b) it.q.push("고주파 종류(BSD/온코) 표기가 없어 온코로 가정했습니다. 맞나요?");
  }
  if (code === "mes") { if (/^메시마?F|^메F/.test(text)) it.variant = "F"; }
  const wk = /격주\s*(\d+)|주\s*(\d+)|\(\s*주\s*(\d+)\s*\)/.exec(rest);
  if (wk) { if (wk[1]) it.everyOtherWeek = Number(wk[1]); else it.perWeek = Number(wk[2] ?? wk[3]); }
  const mo = /월\s*(\d+)\s*(?:회|포|정)?/.exec(rest);
  if (mo && cat.kind === "s") it.perMonth = Number(mo[1]);
  const tot = /총\s*(\d+)\s*회/.exec(rest); if (tot) it.total = Number(tot[1]);
  const q = /(\d+)\s*(포|정|V)/.exec(text);
  if (q && (cat.kind === "q" || code === "vc" || code === "gct")) { it.qty = Number(q[1]); it.unit = q[2]; }
  else if (cat.kind === "q") { const q2 = /^\s*(\d+)/.exec(rest); if (q2) { it.qty = Number(q2[1]); it.unit = "포"; it.q.push(`${cat.name} 수량 '${q2[1]}'의 단위를 '포'로 가정했습니다. 맞나요?`); } }
  // 옵션 (S 서비스 / K 연기) — 페인잼머는 후속치료 앞부분만 본다(후속치료의 옵션은 각각 따로 기록)
  const optText = code === "pj" ? rest.split(/(?:도수|림프|파동|역박동|도|림|파|역)/)[0] : rest;
  if (/서비스|\(S\)|[)\d회\s,]S\b|[)\d회]s\b|S$/.test(optText)) it.option = "S";
  if (/\d+K\b|\bk\b|\dk$/.test(optText) || /월\d+K/.test(optText)) it.option = "K";
  // 페인잼머 후속치료
  if (code === "pj") {
    let f = rest.replace(/\(?\s*주\s*\d+\s*\)?(?:\s*회)?/, " ").replace(/월\s*\d+\s*회?(?![^(]*\))/, " ").replace(/\(\s*월\s*\d+\s*(?:회)?\s*\)/, " ").replace(/후속/g, " ");
    f = f.replace(/^\s*(\d+)\s*(?=월)/, "");
    const follow: Follow[] = []; let mm: RegExpExecArray | null; FOLLOW_RX.lastIndex = 0;
    while ((mm = FOLLOW_RX.exec(f))) {
      const month = mm[2] ?? mm[3]; const wkly = mm[5]; const n = month ? Number(month) : wkly ? Number(wkly) : mm[4] ? Number(mm[4]) : null;
      follow.push({ item: FOLLOW_NAME[mm[1]], n, basis: month ? "month" : wkly ? "week" : undefined, opt: (mm[7] ? (mm[7].toUpperCase() as Opt) : "") });
      if (mm[0].length === 0) FOLLOW_RX.lastIndex++;
    }
    if (follow.length) {
      it.follow = follow; const sum = follow.reduce((s, x) => s + (x.n ?? 0), 0);
      if (follow.some((x) => x.basis === "month")) it.followBasis = "month";
      else if (it.perWeek && sum === it.perWeek) it.followBasis = "week";
      else if (it.perMonth && sum === it.perMonth) it.followBasis = "month";
      else if (sum && (it.perWeek || it.perMonth)) { it.followBasis = "unknown"; it.q.push(`후속치료 합계(${sum})가 페인잼머 주${it.perWeek ?? "?"}회·월${it.perMonth ?? "?"}회와 맞지 않습니다. 어떻게 보면 되나요? ('${it.raw}')`); }
      if (follow.some((x) => x.n == null) && follow.length > 1) it.q.push("후속치료별 횟수가 적혀 있지 않은 항목이 있습니다.");
    }
  }
  if (it.perWeek && !it.perMonth && cat.kind === "s") it.perMonth = it.perWeek * 4;
  if (cat.kind === "s" && it.perWeek == null && it.perMonth == null && it.everyOtherWeek == null && it.total == null && code !== "pj") {
    const bare = /^\s*\(?(\d+)\)?/.exec(rest);
    if (bare && !/^\s*\(?\d+\)?\s*(단계|V|포|정|만)/.test(rest)) { it.perWeek = Number(bare[1]); it.perMonth = it.perWeek * 4; it.q.push(`'${it.raw}'의 숫자 ${bare[1]}을(를) 주 ${bare[1]}회로 해석했습니다. 맞나요?`); }
    else if (code !== "wav" && code !== "rev") it.q.push(`${cat.name}의 횟수 표기가 없습니다 ('${it.raw}').`);
  }
  if (code === "mer" && /\d+\s*만/.test(text)) it.q.push(`'${it.raw}'의 '만'은 무슨 뜻인가요(예: 만원)?`);
  return it;
}

export function parsePlan(input: string): PlanResult {
  const text = norm(input); const items: PlanItem[] = []; const notes: string[] = []; const questions: string[] = [];
  if (!text) return { items, notes, questions, status: "ok" };
  // '+'·'*' 기준 1차 분할 (괄호 안은 제외)
  const parts: string[] = []; let d = 0, cur = "";
  for (const ch of text) { if (ch === "(") d++; if (ch === ")") d = Math.max(0, d - 1); if ((ch === "+" || ch === "*") && d === 0) { parts.push(cur); cur = ""; } else cur += ch; }
  parts.push(cur);
  for (const part of parts.map((p) => p.trim()).filter(Boolean)) {
    const st = starts(part, false);
    if (!st.length) { notes.push(part); continue; }
    if (st[0].i > 0) notes.push(part.slice(0, st[0].i).trim());
    // 쉼표로 나열된 단독 항목들이 마지막 표기를 공유 (예: 파동,역박동 (월2회씩S))
    const shared = st.length > 1 && st.every((s) => ["wav", "rev"].includes(s.code)) && /,\s*$/.test(part.slice(st[0].i + st[0].len, st[1].i).trim() + ",") && !/\d/.test(part.slice(st[0].i + st[0].len, st[1].i));
    st.forEach((s, k) => {
      const end = k + 1 < st.length ? st[k + 1].i : part.length;
      let seg = part.slice(s.i, end).replace(/[,\s]+$/, "");
      if (shared && k < st.length - 1) seg += " " + part.slice(st[st.length - 1].i + st[st.length - 1].len);
      items.push(parseOne(s.code, seg));
    });
    const tail = part.slice(st[st.length - 1].i);
    if (shared) questions.push(`'${tail}': 파동·역박동 각각 월 2회 서비스로 보면 되나요?`);
  }
  for (const it of items) questions.push(...it.q);
  // 메모성 텍스트
  const memo = notes.filter((n) => n && !/^[,.\s]+$/.test(n));
  if (memo.length) questions.push(`다음 문구는 치료 항목으로 해석하지 못했습니다. 메모로 분리할까요? → ${memo.map((n) => `'${n}'`).join(", ")}`);
  const status: PlanResult["status"] = !items.length ? "fail" : questions.length ? "check" : "ok";
  return { items, notes: memo, questions: [...new Set(questions)], status };
}

const freq = (it: PlanItem) => it.everyOtherWeek ? `격주${it.everyOtherWeek}` : [it.perWeek ? `주${it.perWeek}` : "", it.perMonth && !it.perWeek ? `월${it.perMonth}` : ""].join("") || (it.total ? `총${it.total}회` : "");
/** 변경하려는 요약 표기 */
export function compact(items: PlanItem[]): string {
  return items.map((it) => {
    const c = catOf(it.code); let s = c.short;
    if (it.code === "abn") s += (it.variant ?? "") + (it.stage ?? "");
    if (it.code === "mes" && it.variant) s = "메시마F";
    s += it.qty ? `${it.qty}${it.unit ?? ""}` : freq(it);
    if (it.follow?.length) s += `(${it.follow.map((f) => f.item.slice(0, 1) + (f.n ?? "") + (f.opt ?? "")).join("·")})`;
    if (it.option) s += it.option;
    return s;
  }).join(" · ");
}
/** 해석문(한국어 문장) */
export function describe(it: PlanItem): string {
  const parts: string[] = [];
  const nm = it.name + (it.variant && it.code === "abn" ? ` ${it.variant}` : "") + (it.stage ? ` ${it.stage}단계` : "");
  if (it.qty) parts.push(`총 ${it.qty}${it.unit ?? ""}`);
  if (it.everyOtherWeek) parts.push(`격주 ${it.everyOtherWeek}회`);
  if (it.perWeek) parts.push(`주 ${it.perWeek}회`);
  if (it.perMonth && (it.perWeek ? it.perMonth !== it.perWeek * 4 : true)) parts.push(`월 ${it.perMonth}회`);
  else if (it.perMonth && it.perWeek) parts.push(`월 ${it.perMonth}회`);
  if (it.total) parts.push(`총 ${it.total}회`);
  let s = `${nm}${parts.length ? " " + parts.join(", ") : ""}`;
  if (it.option === "S") s += " (서비스)"; if (it.option === "K") s += " (연기 수령)";
  if (it.follow?.length) {
    const b = it.followBasis === "month" ? "월" : it.followBasis === "week" ? "주" : "기간 불명";
    s += ` — 매 회 후속치료: ${it.follow.map((f) => `${f.item}${f.n != null ? ` ${f.n}회` : ""}${f.opt === "S" ? "(서비스)" : f.opt === "K" ? "(연기)" : ""}`).join(", ")} [${b} 기준]`;
  }
  return s;
}

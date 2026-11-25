"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { api } from "@/lib/api";
import { useToast } from "@/lib/toast";
import Link from "next/link";
import { applyCatalog, compact, describe, parsePlan, shortOf, type CatEntry, type PlanItem } from "@/lib/planParse";
import { RULE_CASES, hash } from "@/lib/planSurvey";
import { csvEscape } from "@/lib/util";
import { Icon } from "@/components/Icons";

interface Ans { key: string; user: string; name: string; verdict: string; answer: string; at: string }
interface TItem { code: string; name: string; short: string; aliases: string[]; category: string; kind: "session" | "qty"; unit: string; defaultPerWeek: number | null; defaultPerMonth: number | null; variants: string[]; maxStage: number; followable: boolean; followTargets: string[]; followOnly: boolean; roomItemIds: string[]; active: boolean; note: string }
interface Row { key: string; sec: "A" | "B" | "C"; shortLabel?: string; group: string; raw: string; items: PlanItem[][]; to: string[]; meaning: string[]; questions: string[]; count?: number }

const chipText = (it: PlanItem) => {
  const f = [it.qty ? `${it.qty}${it.unit ?? ""}` : "", it.everyOtherWeek ? `격주${it.everyOtherWeek}` : "", it.perWeek ? `주${it.perWeek}` : "", it.perMonth ? `월${it.perMonth}` : "", it.total ? `총${it.total}회` : ""].filter(Boolean).join("·");
  return `${shortOf(it.code)}${it.variant && it.code === "abn" ? " " + it.variant : ""}${it.stage ? ` ${it.stage}단계` : ""}${f ? " · " + f : ""}${it.option ? ` · ${it.option === "S" ? "서비스" : "연기(K)"}` : ""}`;
};

function SaveCell({ row, mine, others, canAnswer, onSave }: { row: Row; mine?: Ans; others: Ans[]; canAnswer: boolean; onSave: (key: string, verdict: string, answer: string) => Promise<void> }) {
  const [verdict, setVerdict] = useState(mine?.verdict ?? ""); const [text, setText] = useState(mine?.answer ?? "");
  const [st, setSt] = useState<"" | "saving" | "saved" | "err">(""); const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  const first = useRef(true);
  useEffect(() => { if (first.current) { first.current = false; return; } if (t.current) clearTimeout(t.current); setSt("saving");
    t.current = setTimeout(() => onSave(row.key, verdict, text).then(() => setSt("saved")).catch(() => setSt("err")), 700); return () => { if (t.current) clearTimeout(t.current); }; }, [verdict, text]); // eslint-disable-line
  return (
    <div className="svans">
      <div className="svradio" role="radiogroup" aria-label="해석 확인">
        <label className={verdict === "ok" ? "on ok" : ""}><input type="radio" name={`v-${row.key}`} checked={verdict === "ok"} disabled={!canAnswer} onChange={() => setVerdict("ok")} />해석이 맞습니다</label>
        <label className={verdict === "fix" ? "on fix" : ""}><input type="radio" name={`v-${row.key}`} checked={verdict === "fix"} disabled={!canAnswer} onChange={() => setVerdict("fix")} />다르거나 수정 필요</label>
      </div>
      <textarea value={text} disabled={!canAnswer} placeholder={row.questions.length ? "질문에 대한 답변, 또는 올바른 해석을 적어 주세요" : "수정할 내용이 있으면 적어 주세요"} onChange={(e) => setText(e.target.value)} rows={3} />
      <div className="svstat">{st === "saving" ? "저장 중…" : st === "saved" ? "✓ 저장됨" : st === "err" ? "저장 실패 — 다시 시도해 주세요" : mine ? `마지막 저장 ${new Date(mine.at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "short", timeStyle: "short" })}` : ""}</div>
      {others.length > 0 && <div className="svothers"><b>다른 응답자</b>{others.map((o) => <p key={o.user}><span className={`tag v-${o.verdict}`}>{o.verdict === "ok" ? "맞음" : o.verdict === "fix" ? "다름" : "의견"}</span> <i>{o.name || o.user}</i> {o.answer}</p>)}</div>}
    </div>
  );
}

export default function PlanSurvey() {
  const { me, db, ready } = useStore(); const { toast } = useToast();
  const [catItems, setCatItems] = useState<TItem[]>([]);
  const [answers, setAnswers] = useState<Ans[]>([]); const [loaded, setLoaded] = useState(false); const [catVer, setCatVer] = useState(0);
  const [filter, setFilter] = useState<"all" | "todo" | "q">("all"); const [sec, setSec] = useState<"A" | "B" | "C">("A"); const [kw, setKw] = useState("");
  const canAnswer = !!me && me.role !== "viewer"; const canAll = me?.role === "admin" || me?.role === "manager";
  const load = useCallback(() => api<{ answers: Ans[] }>("/api/plan-survey").then((r) => { setAnswers(r.answers); setLoaded(true); }).catch((e) => toast(e.message, "err")), [toast]);
  useEffect(() => { load(); }, [load]);
  // 치료항목 설정(명칭·약식·약어)을 해석에 반영
  useEffect(() => { api<{ items: TItem[] }>("/api/treatments").then((r) => { applyCatalog(r.items as unknown as CatEntry[]); setCatItems(r.items); setCatVer((v) => v + 1); }).catch(() => setCatVer((v) => v + 1)); }, []);

  const rowsA = useMemo<Row[]>(() => RULE_CASES.map((c) => {
    const lines = c.raw.split("\n"); const res = lines.map((l) => parsePlan(l));
    return { key: c.key, sec: "A" as const, group: c.group, raw: c.raw, items: res.map((r) => r.items), to: res.map((r, i) => (r.items.length ? compact(r.items) : lines[i].startsWith("(") ? "" : "(해석 불가)")), meaning: [c.meaning], questions: [c.question] };
  }), [catVer]);
  // 치료항목 설정의 약식 표기를 기준으로 항목별 확인 행을 만든다 (설정을 바꾸면 이 표도 바뀐다)
  const roomLabel = useCallback((id: string) => { const it = db.items.find((x) => x.id === id); return it ? `${db.rooms.find((r) => r.id === it.roomId)?.name ?? ""}·${it.name}` : id; }, [db.items, db.rooms]);
  const rowsC = useMemo<Row[]>(() => catItems.filter((t) => t.active).map((t) => {
    const ex: string[] = [];
    if (t.kind === "qty") ex.push(`${t.short}90${t.unit || "포"}`);
    else { ex.push(`${t.short}${t.defaultPerWeek ? `주${t.defaultPerWeek}` : "주2"}`); if (t.variants.length) ex.push(`${t.short}${t.variants[0]}${t.maxStage || ""}주2`); if (t.followable) ex.push(`${t.short}주3(${t.followTargets.slice(0, 2).map((f) => f.slice(0, 1) + "1").join("·") || "도1"})`); }
    ex.push(`옵션 S: ${t.short}${t.kind === "qty" ? "30" + (t.unit || "포") : "주1"}S`);
    const link = t.roomItemIds.map(roomLabel).join(", ");
    const meaning = [`'${t.name}'은(는) 환자명부 치료정보 요약에 '${t.short}'(으)로 표시하고, 현장 표기 ${t.aliases.map((a) => `'${a}'`).join(", ") || "(없음)"}은(는) 같은 치료로 읽습니다.`,
      `${t.kind === "qty" ? `수량형 — 총 수량을 ${t.unit || "단위"}로 입력합니다.` : "횟수형 — 주·월 횟수를 입력합니다."}${t.defaultPerWeek ? ` 기본 주기는 주 ${t.defaultPerWeek}회입니다.` : ""}${t.variants.length ? ` 세부 종류: ${t.variants.join("/")}${t.maxStage ? `, 1~${t.maxStage}단계` : ""}.` : ""}${t.followable ? ` 후속치료(${t.followTargets.join("·") || "선택"})를 붙일 수 있습니다.` : ""}${t.followOnly ? " 다른 치료의 후속치료로만 사용합니다." : ""}`,
      link ? `치료실 스케줄 연결: ${link}` : "치료실 스케줄과는 연결되어 있지 않습니다."];
    const q: string[] = [`약식 표기 '${t.short}'가 환자명부에서 알아보기 편한가요? 바꾸고 싶은 표기가 있으면 적어 주세요.`];
    if (t.aliases.length) q.push(`현장에서 쓰는 표기(${t.aliases.join(", ")}) 중 빠졌거나 틀린 것이 있나요?`);
    if (t.aliases.includes("고")) q.push("'고'만 적은 표기는 온코로 보면 되나요?");
    if (t.kind === "qty") q.push(`수량 단위 '${t.unit || "(미정)"}'가 맞나요?`);
    if (t.variants.length) q.push(`세부 종류(${t.variants.join("/")})${t.maxStage ? `와 단계(1~${t.maxStage})` : ""}가 맞나요?`);
    if (t.followable) q.push(`후속치료 대상(${t.followTargets.join("·") || "미지정"})이 맞나요?`);
    if (t.category === "치료실 시술" && !t.roomItemIds.length && !t.followOnly) q.push("연결할 치료실 스케줄 항목이 있나요?");
    if (t.kind === "session" && !t.followOnly && !t.defaultPerWeek && !t.defaultPerMonth) q.push("자주 쓰는 기본 주기가 있으면 알려주세요 (예: 주 2회).");
    return { key: "C:" + t.code, sec: "C" as const, shortLabel: t.short, group: `${t.category} · ${t.name}`, raw: t.aliases.join("\n") || "(약어 없음)", items: [], to: ex, meaning, questions: q };
  }), [catItems, roomLabel]);
  const rowsB = useMemo<Row[]>(() => {
    const seen = new Map<string, number>();
    for (const p of db.patients) if (p.source === "registry" && p.status !== "discharged" && p.plan.trim()) { const k = p.plan.trim(); seen.set(k, (seen.get(k) ?? 0) + 1); }
    const rows: Row[] = [...seen.entries()].map(([plan, n]) => { const r = parsePlan(plan);
      return { key: "P:" + hash(plan), sec: "B" as const, group: r.status === "ok" ? "자동 해석" : "확인 필요", raw: plan, items: [r.items], to: [r.items.length ? compact(r.items) : "(해석 불가)"], meaning: r.items.map(describe), questions: r.questions, count: n }; });
    return rows.sort((a, b) => Number(!!b.questions.length) - Number(!!a.questions.length));
  }, [db.patients, catVer]);

  const mineMap = useMemo(() => new Map(answers.filter((a) => a.user === me?.username).map((a) => [a.key, a])), [answers, me]);
  const othersOf = (key: string) => (canAll ? answers.filter((a) => a.key === key && a.user !== me?.username) : []);
  const save = useCallback(async (key: string, verdict: string, answer: string) => {
    await api("/api/plan-survey", "PUT", { key, verdict, answer });
    setAnswers((a) => { const rest = a.filter((x) => !(x.key === key && x.user === me?.username)); return verdict || answer ? [{ key, user: me!.username, name: me!.name, verdict, answer, at: new Date().toISOString() }, ...rest] : rest; });
  }, [me]);

  const rows = sec === "A" ? rowsA : sec === "B" ? rowsB : rowsC;
  const answered = (r: Row) => { const a = mineMap.get(r.key); return !!a && (!!a.verdict || !!a.answer); };
  const shown = rows.filter((r) => (filter === "todo" ? !answered(r) : filter === "q" ? r.questions.length > 0 : true) && (!kw || r.raw.includes(kw)));
  const doneA = rowsA.filter(answered).length, doneB = rowsB.filter(answered).length, doneC = rowsC.filter(answered).length;
  const exportCsv = () => {
    const all = [...rowsA, ...rowsB, ...rowsC]; const head = ["구분", "행", "현재 기재", "변경 방식", "질문", "응답자", "판정", "답변", "시각"];
    const lines = [head.join(",")]; for (const r of all) { for (const a of answers.filter((x) => x.key === r.key)) lines.push([r.sec === "A" ? "표기규칙" : r.sec === "C" ? "약식표기" : "환자 치료정보", r.key, r.raw.replace(/\n/g, " / "), r.to.join(" / "), r.questions.join(" / "), a.name || a.user, a.verdict === "ok" ? "맞음" : a.verdict === "fix" ? "다름" : "", a.answer, a.at].map((v) => csvEscape(String(v))).join(",")); }
    const url = URL.createObjectURL(new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" })); const a = document.createElement("a"); a.href = url; a.download = "치료정보_설문_응답.csv"; a.click(); URL.revokeObjectURL(url);
  };
  if (!ready || !loaded || !catVer) return <div className="card"><p>불러오는 중…</p></div>;
  return (
    <div className="survey">
      <div className="toolbar"><h2>치료정보 구조 설문</h2><span className="hint">환자 치료정보를 항목·횟수가 구분되는 구조로 바꾸기 위해, 현재 기재 방식을 어떻게 해석했는지 확인받는 페이지입니다.</span></div>
      <div className="card svintro">
        <b>확인 방법</b>
        <ol><li><b>①</b> 지금 적는 방식 → <b>②</b> 새 방식으로 바꾼 모습 → <b>③</b> 저희가 읽은 뜻을 차례로 보세요.</li>
          <li><b>④</b>에 질문이 있으면 답해 주시고, 질문이 없으면 해석이 맞는지만 <b>⑤</b>에서 골라 주세요. (다르면 올바른 뜻을 적어 주세요)</li>
          <li>입력하면 자동 저장되고, 언제든 다시 열어 고칠 수 있습니다. 환자 이름은 표시하지 않습니다.</li></ol>
        <small className="hint" style={{ display: "block", marginBottom: 6 }}>약식 표기·인식 약어는 <b>치료항목 설정</b>에서 정한 값을 기준으로 표시됩니다.{(me?.role === "admin" || me?.role === "manager") && <> <Link href="/treatment-settings" className="linkbtn" style={{ display: "inline" }}>치료항목 설정 열기 →</Link></>}</small>
        <small className="hint">용어: 주N = 주 N회, 월N = 월 N회, 격주N = 2주에 N회 · 옵션 S = 서비스, K = 미뤄뒀다 받는 치료, C = 쿠폰, 옵션 없음 = J(젬마 연계, 기본) · 포·정 = 총 수량 · 페인잼머(PJ) 뒤의 도수·림프·파동·역박동 = 후속치료</small>
      </div>
      <div className="toolbar svbar">
        <div className="seg"><button className={sec === "A" ? "on" : ""} onClick={() => setSec("A")}>표기 규칙 확인 {doneA}/{rowsA.length}</button><button className={sec === "B" ? "on" : ""} onClick={() => setSec("B")}>현재 환자 치료정보 {doneB}/{rowsB.length}</button><button className={sec === "C" ? "on" : ""} onClick={() => setSec("C")}>치료항목 약식 표기 {doneC}/{rowsC.length}</button></div>
        <div className="seg">{([["all", "전체"], ["todo", "미응답"], ["q", "질문 있는 것"]] as const).map(([k, t]) => <button key={k} className={filter === k ? "on" : ""} onClick={() => setFilter(k)}>{t}</button>)}</div>
        <span className="qwrap"><Icon name="search" size={16} /><input className="qinput" placeholder="기재 내용 검색" value={kw} onChange={(e) => setKw(e.target.value)} /></span>
        {canAll && <button className="btn-soft" onClick={exportCsv}><Icon name="download" size={16} />응답 CSV</button>}
        {!canAnswer && <span className="hint">조회전용 계정은 답변할 수 없습니다.</span>}
      </div>
      <div className="tblwrap svwrap">
        <table className="survtbl">
          <thead><tr><th>① 현재 기재 방식</th><th>② 변경하려는 방식 (비교)</th><th>③ 해석문</th><th>④ 해석이 어려운 부분 · 질문</th><th>⑤ 사용자 답변</th></tr></thead>
          <tbody>{shown.length === 0 && <tr><td colSpan={5} className="empty">해당하는 항목이 없습니다.</td></tr>}
            {shown.map((r, n) => (
              <tr key={r.key} className={r.questions.length ? "hasq" : ""}>
                <td data-label="① 현재 기재 방식"><div className="svtag">{r.sec === "A" ? `${r.key} · ${r.group}` : r.group}{r.count && r.count > 1 ? ` · ${r.count}명 동일` : ""}</div><pre className="svraw">{r.raw}</pre></td>
                <td data-label="② 변경하려는 방식 (비교)">
                  {r.shortLabel && <div className="svnew"><div className="svsum big">{r.shortLabel}</div><div className="svchips">{r.to.map((x, j) => <span key={j} className="svchip">{x}</span>)}</div></div>}
                  {r.items.map((its, i) => (its.length ? <div key={i} className="svnew"><div className="svsum">{r.to[i]}</div><div className="svchips">{its.map((it, j) => <span key={j} title={it.name} className={`svchip ${it.q.length ? "q" : ""}`}>{chipText(it)}{it.follow?.length ? ` ⮕ ${it.follow.map((f) => f.item + (f.n ?? "")).join("·")}` : ""}</span>)}</div></div> : r.to[i] ? <div key={i} className="svnew"><div className="svsum off">{r.to[i]}</div></div> : null))}
                </td>
                <td data-label="③ 해석문">{r.meaning.map((m, i) => <p key={i} className="svmean">{m}</p>)}{!r.meaning.length && <p className="svmean off">해석하지 못했습니다.</p>}</td>
                <td data-label="④ 질문">{r.questions.length ? <ol className="svq">{r.questions.map((q, i) => <li key={i}>{q}</li>)}</ol> : <span className="svok">특별히 어려운 부분은 없습니다. 해석이 맞는지만 확인해 주세요.</span>}</td>
                <td data-label="⑤ 사용자 답변"><SaveCell row={r} mine={mineMap.get(r.key)} others={othersOf(r.key)} canAnswer={canAnswer} onSave={save} /></td>
              </tr>))}</tbody>
        </table>
      </div>
    </div>
  );
}

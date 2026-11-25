"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { api } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { compact, describe, parsePlan, type PlanItem } from "@/lib/planParse";
import { RULE_CASES, hash } from "@/lib/planSurvey";
import { csvEscape } from "@/lib/util";
import { Icon } from "@/components/Icons";

interface Ans { key: string; user: string; name: string; verdict: string; answer: string; at: string }
interface Row { key: string; sec: "A" | "B"; group: string; raw: string; items: PlanItem[][]; to: string[]; meaning: string[]; questions: string[]; count?: number }

const chipText = (it: PlanItem) => {
  const f = [it.qty ? `${it.qty}${it.unit ?? ""}` : "", it.everyOtherWeek ? `격주${it.everyOtherWeek}` : "", it.perWeek ? `주${it.perWeek}` : "", it.perMonth ? `월${it.perMonth}` : "", it.total ? `총${it.total}회` : ""].filter(Boolean).join("·");
  return `${it.name}${it.variant && it.code === "abn" ? " " + it.variant : ""}${it.stage ? ` ${it.stage}단계` : ""}${f ? " · " + f : ""}${it.option ? ` · ${it.option === "S" ? "서비스" : "연기(K)"}` : ""}`;
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
  const [answers, setAnswers] = useState<Ans[]>([]); const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState<"all" | "todo" | "q">("all"); const [sec, setSec] = useState<"A" | "B">("A"); const [kw, setKw] = useState("");
  const canAnswer = !!me && me.role !== "viewer"; const canAll = me?.role === "admin" || me?.role === "manager";
  const load = useCallback(() => api<{ answers: Ans[] }>("/api/plan-survey").then((r) => { setAnswers(r.answers); setLoaded(true); }).catch((e) => toast(e.message, "err")), [toast]);
  useEffect(() => { load(); }, [load]);

  const rowsA = useMemo<Row[]>(() => RULE_CASES.map((c) => {
    const lines = c.raw.split("\n"); const res = lines.map((l) => parsePlan(l));
    return { key: c.key, sec: "A" as const, group: c.group, raw: c.raw, items: res.map((r) => r.items), to: res.map((r, i) => (r.items.length ? compact(r.items) : lines[i].startsWith("(") ? "" : "(해석 불가)")), meaning: [c.meaning], questions: [c.question] };
  }), []);
  const rowsB = useMemo<Row[]>(() => {
    const seen = new Map<string, number>();
    for (const p of db.patients) if (p.source === "registry" && p.status !== "discharged" && p.plan.trim()) { const k = p.plan.trim(); seen.set(k, (seen.get(k) ?? 0) + 1); }
    const rows: Row[] = [...seen.entries()].map(([plan, n]) => { const r = parsePlan(plan);
      return { key: "P:" + hash(plan), sec: "B" as const, group: r.status === "ok" ? "자동 해석" : "확인 필요", raw: plan, items: [r.items], to: [r.items.length ? compact(r.items) : "(해석 불가)"], meaning: r.items.map(describe), questions: r.questions, count: n }; });
    return rows.sort((a, b) => Number(!!b.questions.length) - Number(!!a.questions.length));
  }, [db.patients]);

  const mineMap = useMemo(() => new Map(answers.filter((a) => a.user === me?.username).map((a) => [a.key, a])), [answers, me]);
  const othersOf = (key: string) => (canAll ? answers.filter((a) => a.key === key && a.user !== me?.username) : []);
  const save = useCallback(async (key: string, verdict: string, answer: string) => {
    await api("/api/plan-survey", "PUT", { key, verdict, answer });
    setAnswers((a) => { const rest = a.filter((x) => !(x.key === key && x.user === me?.username)); return verdict || answer ? [{ key, user: me!.username, name: me!.name, verdict, answer, at: new Date().toISOString() }, ...rest] : rest; });
  }, [me]);

  const rows = sec === "A" ? rowsA : rowsB;
  const answered = (r: Row) => { const a = mineMap.get(r.key); return !!a && (!!a.verdict || !!a.answer); };
  const shown = rows.filter((r) => (filter === "todo" ? !answered(r) : filter === "q" ? r.questions.length > 0 : true) && (!kw || r.raw.includes(kw)));
  const doneA = rowsA.filter(answered).length, doneB = rowsB.filter(answered).length;
  const exportCsv = () => {
    const all = [...rowsA, ...rowsB]; const head = ["구분", "행", "현재 기재", "변경 방식", "질문", "응답자", "판정", "답변", "시각"];
    const lines = [head.join(",")]; for (const r of all) { for (const a of answers.filter((x) => x.key === r.key)) lines.push([r.sec === "A" ? "표기규칙" : "환자 치료정보", r.key, r.raw.replace(/\n/g, " / "), r.to.join(" / "), r.questions.join(" / "), a.name || a.user, a.verdict === "ok" ? "맞음" : a.verdict === "fix" ? "다름" : "", a.answer, a.at].map((v) => csvEscape(String(v))).join(",")); }
    const url = URL.createObjectURL(new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" })); const a = document.createElement("a"); a.href = url; a.download = "치료정보_설문_응답.csv"; a.click(); URL.revokeObjectURL(url);
  };
  if (!ready || !loaded) return <div className="card"><p>불러오는 중…</p></div>;
  return (
    <div className="survey">
      <div className="toolbar"><h2>치료정보 구조 설문</h2><span className="hint">환자 치료정보를 항목·횟수가 구분되는 구조로 바꾸기 위해, 현재 기재 방식을 어떻게 해석했는지 확인받는 페이지입니다.</span></div>
      <div className="card svintro">
        <b>확인 방법</b>
        <ol><li><b>①</b> 지금 적는 방식 → <b>②</b> 새 방식으로 바꾼 모습 → <b>③</b> 저희가 읽은 뜻을 차례로 보세요.</li>
          <li><b>④</b>에 질문이 있으면 답해 주시고, 질문이 없으면 해석이 맞는지만 <b>⑤</b>에서 골라 주세요. (다르면 올바른 뜻을 적어 주세요)</li>
          <li>입력하면 자동 저장되고, 언제든 다시 열어 고칠 수 있습니다. 환자 이름은 표시하지 않습니다.</li></ol>
        <small className="hint">용어: 주N = 주 N회, 월N = 월 N회, 격주N = 2주에 N회 · 옵션 S = 서비스, K = 미뤄뒀다 받는 치료, C = 쿠폰, 옵션 없음 = J(젬마 연계, 기본) · 포·정 = 총 수량 · 페인잼머(PJ) 뒤의 도수·림프·파동·역박동 = 후속치료</small>
      </div>
      <div className="toolbar svbar">
        <div className="seg"><button className={sec === "A" ? "on" : ""} onClick={() => setSec("A")}>표기 규칙 확인 {doneA}/{rowsA.length}</button><button className={sec === "B" ? "on" : ""} onClick={() => setSec("B")}>현재 환자 치료정보 {doneB}/{rowsB.length}</button></div>
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
                  {r.items.map((its, i) => (its.length ? <div key={i} className="svnew"><div className="svsum">{r.to[i]}</div><div className="svchips">{its.map((it, j) => <span key={j} className={`svchip ${it.q.length ? "q" : ""}`}>{chipText(it)}{it.follow?.length ? ` ⮕ ${it.follow.map((f) => f.item + (f.n ?? "")).join("·")}` : ""}</span>)}</div></div> : r.to[i] ? <div key={i} className="svnew"><div className="svsum off">{r.to[i]}</div></div> : null))}
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

"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { api } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { canEditPatients } from "@/lib/perm";
import { Icon } from "@/components/Icons";

interface TItem { code: string; name: string; short: string; aliases: string[]; category: string; kind: "session" | "qty"; unit: string; defaultPerWeek: number | null; defaultPerMonth: number | null;
  variants: string[]; maxStage: number; followable: boolean; followTargets: string[]; followOnly: boolean; roomItemIds: string[]; active: boolean; builtin: boolean; note: string }
interface Cycle { id: number; label: string; perWeek: number | null; perMonth: number | null; everyOtherWeek: number | null }
const CATS = ["치료실 시술", "주사", "약·보조제", "기타"];
const FOLLOW = ["도수", "림프", "파동", "역박동"];
const blank = (): Partial<TItem> => ({ name: "", short: "", aliases: [], category: "주사", kind: "session", unit: "", variants: [], maxStage: 0, followable: false, followTargets: [], followOnly: false, roomItemIds: [], active: true, note: "" });
const cycleText = (c: { perWeek: number | null; perMonth: number | null; everyOtherWeek: number | null }) => c.everyOtherWeek ? `격주 ${c.everyOtherWeek}회${c.perMonth ? ` (월 ${c.perMonth}회)` : ""}` : c.perWeek ? `주 ${c.perWeek}회${c.perMonth ? ` (월 ${c.perMonth}회)` : ""}` : c.perMonth ? `월 ${c.perMonth}회` : "-";

export default function TreatmentSettings() {
  const { me, db } = useStore(); const { toast } = useToast();
  const [items, setItems] = useState<TItem[]>([]); const [cycles, setCycles] = useState<Cycle[]>([]); const [tab, setTab] = useState<"items" | "cycles">("items");
  const [edit, setEdit] = useState<Partial<TItem> & { aliasText?: string; variantText?: string; wk?: string; mo?: string } | null>(null);
  const [cedit, setCedit] = useState<Partial<Cycle> & { pw?: string; pm?: string; eo?: string } | null>(null);
  const [err, setErr] = useState(""); const [cat, setCat] = useState(""); const [kw, setKw] = useState("");
  const can = canEditPatients(me);
  const load = useCallback(() => api<{ items: TItem[]; cycles: Cycle[] }>("/api/treatments").then((r) => { setItems(r.items); setCycles(r.cycles); }).catch((e) => toast(e.message, "err")), [toast]);
  useEffect(() => { load(); }, [load]);
  const shown = useMemo(() => items.filter((t) => (!cat || t.category === cat) && (!kw || [t.name, t.short, ...t.aliases].some((x) => x.includes(kw)))), [items, cat, kw]);

  const open = (t?: TItem) => { setErr(""); setEdit(t ? { ...t, aliasText: t.aliases.join(", "), variantText: t.variants.join(", "), wk: t.defaultPerWeek?.toString() ?? "", mo: t.defaultPerMonth?.toString() ?? "" } : { ...blank(), aliasText: "", variantText: "", wk: "", mo: "" }); };
  const save = async () => {
    if (!edit) return; setErr("");
    try {
      await api("/api/treatments", "POST", { ...edit, aliases: edit.aliasText, variants: edit.variantText, defaultPerWeek: edit.wk, defaultPerMonth: edit.mo });
      toast(edit.code ? "치료항목을 저장했습니다" : "치료항목을 추가했습니다"); setEdit(null); load();
    } catch (e) { setErr((e as Error).message); }
  };
  const toggle = async (t: TItem) => { try { await api("/api/treatments", "POST", { ...t, defaultPerWeek: t.defaultPerWeek, defaultPerMonth: t.defaultPerMonth, active: !t.active }); load(); } catch (e) { toast((e as Error).message, "err"); } };
  const del = async (t: TItem) => { if (!confirm(`'${t.name}' 항목을 삭제할까요?`)) return; try { await api(`/api/treatments/${t.code}`, "DELETE"); toast("삭제했습니다"); load(); } catch (e) { toast((e as Error).message, "err"); } };
  const move = async (t: TItem, d: -1 | 1) => {
    const all = items.map((x) => x.code); const i = all.indexOf(t.code), j = i + d; if (j < 0 || j >= all.length) return;
    [all[i], all[j]] = [all[j], all[i]]; setItems(all.map((c) => items.find((x) => x.code === c)!));
    try { await api("/api/treatments/order", "POST", { codes: all }); } catch (e) { toast((e as Error).message, "err"); load(); }
  };
  const saveCycle = async () => {
    if (!cedit) return; setErr("");
    try { await api("/api/treatments/cycles", "POST", { id: cedit.id, label: cedit.label, perWeek: cedit.pw, perMonth: cedit.pm, everyOtherWeek: cedit.eo }); toast("저장했습니다"); setCedit(null); load(); }
    catch (e) { setErr((e as Error).message); }
  };
  const delCycle = async (c: Cycle) => { if (!confirm(`'${c.label}' 주기를 삭제할까요?`)) return; try { await api(`/api/treatments/cycles?id=${c.id}`, "DELETE"); load(); } catch (e) { toast((e as Error).message, "err"); } };
  const roomItems = db.items.map((i) => ({ id: i.id, label: `${db.rooms.find((r) => r.id === i.roomId)?.name ?? ""} · ${i.name}` }));
  const preview = edit ? (() => { const wk = Number(edit.wk) || 0; return `${edit.short || edit.name || "항목"}${edit.variantText?.trim() ? edit.variantText.split(",")[0].trim().toUpperCase() + (edit.maxStage || "") : ""}${edit.kind === "qty" ? `90${edit.unit ?? ""}` : wk ? `주${wk}` : "주2"}`; })() : "";

  return (
    <div className="tsettings fillpage">
      <div className="toolbar"><h2>치료항목 설정</h2>
        <span className="hint">치료 명칭·약식 표기·치료주기를 관리합니다. 여기서 정한 약식 표기는 환자명부 치료정보 요약에, 인식 약어는 기존 표기 해석에 사용됩니다.</span></div>
      <div className="toolbar tsbar">
        <div className="seg"><button className={tab === "items" ? "on" : ""} onClick={() => setTab("items")}>치료항목 {items.length}</button><button className={tab === "cycles" ? "on" : ""} onClick={() => setTab("cycles")}>치료주기 {cycles.length}</button></div>
        {tab === "items" && <><div className="seg">{["", ...CATS].map((c) => <button key={c} className={cat === c ? "on" : ""} onClick={() => setCat(c)}>{c || "전체"}</button>)}</div>
          <span className="qwrap"><Icon name="search" size={16} /><input className="qinput" placeholder="명칭·약어 검색" value={kw} onChange={(e) => setKw(e.target.value)} /></span></>}
        <span style={{ flex: 1 }} />
        {can && (tab === "items" ? <button className="primary" onClick={() => open()}>+ 치료항목 추가</button> : <button className="primary" onClick={() => { setErr(""); setCedit({ label: "", pw: "", pm: "", eo: "" }); }}>+ 치료주기 추가</button>)}
      </div>

      {tab === "items" && (
        <div className="tblwrap fixhead"><table className="tbl compact tstbl">
          <thead><tr><th style={{ width: 70 }}>순서</th><th>치료 명칭</th><th>약식 표기</th><th>인식 약어 (현장 표기)</th><th>구분·단위</th><th>세부 (종류·단계·후속)</th><th>치료실 연결</th><th>사용</th>{can && <th style={{ width: 120 }} />}</tr></thead>
          <tbody>{shown.map((t) => (
            <tr key={t.code} className={t.active ? "" : "off"}>
              <td className="tsmove">{can && !cat && !kw && <><button aria-label="위로" onClick={() => move(t, -1)}>▲</button><button aria-label="아래로" onClick={() => move(t, 1)}>▼</button></>}</td>
              <td><b>{t.name}</b>{t.followOnly && <em className="tmpbadge">후속 전용</em>}{!t.builtin && <em className="tmpbadge" style={{ background: "#dbeafe", color: "#1e40af" }}>추가</em>}</td>
              <td><span className="tsshort">{t.short}</span></td>
              <td className="tsal">{t.aliases.join(" · ") || "-"}</td>
              <td>{t.kind === "qty" ? `수량형(${t.unit || "-"})` : `횟수형${t.unit ? `(${t.unit})` : ""}`}{(t.defaultPerWeek || t.defaultPerMonth) ? <small className="tssub">기본 {t.defaultPerWeek ? `주${t.defaultPerWeek}` : ""}{t.defaultPerMonth ? ` 월${t.defaultPerMonth}` : ""}</small> : null}</td>
              <td>{[t.variants.length ? `종류 ${t.variants.join("/")}` : "", t.maxStage ? `${t.maxStage}단계` : "", t.followable ? `후속 ${t.followTargets.join("·") || "가능"}` : ""].filter(Boolean).join(" · ") || "-"}</td>
              <td className="tsal">{t.roomItemIds.map((id) => roomItems.find((r) => r.id === id)?.label ?? id).join(", ") || "-"}</td>
              <td><label className="switch"><input type="checkbox" checked={t.active} disabled={!can} onChange={() => toggle(t)} /><span>{t.active ? "사용" : "중지"}</span></label></td>
              {can && <td className="rowact"><button className="btn-soft" onClick={() => open(t)}><Icon name="edit" size={15} />수정</button>{!t.builtin && <button className="btn-end" onClick={() => del(t)}>삭제</button>}</td>}
            </tr>))}
            {!shown.length && <tr><td colSpan={9} className="empty">해당하는 항목이 없습니다.</td></tr>}</tbody></table></div>)}

      {tab === "cycles" && (
        <div className="card"><p className="hint" style={{ marginTop: 0 }}>치료 계획 입력 시 한 번에 고를 수 있는 주기 목록입니다. 월 횟수는 주 횟수 × 4가 기본이고, 다른 값도 지정할 수 있습니다.</p>
          <table className="tbl compact" style={{ maxWidth: 720 }}><thead><tr><th>주기 이름</th><th>표시</th><th>주당</th><th>격주</th><th>월 합계</th>{can && <th />}</tr></thead>
            <tbody>{cycles.map((c) => (<tr key={c.id}><td><b>{c.label}</b></td><td>{cycleText(c)}</td><td>{c.perWeek ?? "-"}</td><td>{c.everyOtherWeek ?? "-"}</td><td>{c.perMonth ?? "-"}</td>
              {can && <td className="rowact"><button className="btn-soft" onClick={() => { setErr(""); setCedit({ ...c, pw: c.perWeek?.toString() ?? "", pm: c.perMonth?.toString() ?? "", eo: c.everyOtherWeek?.toString() ?? "" }); }}><Icon name="edit" size={15} />수정</button><button className="btn-end" onClick={() => delCycle(c)}>삭제</button></td>}</tr>))}</tbody></table></div>)}

      {edit && (
        <div className="overlay" onClick={() => setEdit(null)}><div className="modal tsmodal" onClick={(e) => e.stopPropagation()}>
          <h3>{edit.code ? "치료항목 수정" : "치료항목 추가"}</h3>
          <div className="row"><label>치료 명칭<input value={edit.name ?? ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="예: 싸이케어 주사" autoFocus /></label>
            <label>약식 표기 <small className="hint">요약에 쓰는 짧은 이름</small><input value={edit.short ?? ""} onChange={(e) => setEdit({ ...edit, short: e.target.value })} placeholder="예: 싸이" /></label></div>
          <label>인식 약어 <small className="hint">현장에서 적는 표기를 쉼표(,)로 구분 — 기존 치료정보를 읽을 때 사용</small><input value={edit.aliasText ?? ""} onChange={(e) => setEdit({ ...edit, aliasText: e.target.value })} placeholder="예: 싸이, 싸이케어" /></label>
          <div className="row"><label>분류<select value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })}>{CATS.map((c) => <option key={c}>{c}</option>)}</select></label>
            <label>구분<select value={edit.kind} onChange={(e) => setEdit({ ...edit, kind: e.target.value as "session" | "qty" })}><option value="session">횟수형 (주·월 횟수)</option><option value="qty">수량형 (포·정 총량)</option></select></label>
            <label>단위<input value={edit.unit ?? ""} onChange={(e) => setEdit({ ...edit, unit: e.target.value })} placeholder="포 · 정 · V" /></label></div>
          <div className="row"><label>기본 주 횟수<input inputMode="numeric" value={edit.wk ?? ""} onChange={(e) => setEdit({ ...edit, wk: e.target.value.replace(/\D/g, ""), mo: e.target.value ? String(Number(e.target.value.replace(/\D/g, "")) * 4) : "" })} placeholder="비워도 됩니다" /></label>
            <label>기본 월 횟수<input inputMode="numeric" value={edit.mo ?? ""} onChange={(e) => setEdit({ ...edit, mo: e.target.value.replace(/\D/g, "") })} /></label></div>
          <div className="row"><label>세부 종류 <small className="hint">쉼표 구분 (예: A, M, F, Q)</small><input value={edit.variantText ?? ""} onChange={(e) => setEdit({ ...edit, variantText: e.target.value })} /></label>
            <label>최대 단계 <small className="hint">없으면 0</small><input inputMode="numeric" value={edit.maxStage ?? 0} onChange={(e) => setEdit({ ...edit, maxStage: Number(e.target.value.replace(/\D/g, "")) || 0 })} /></label></div>
          <label className="chk"><input type="checkbox" checked={!!edit.followable} onChange={(e) => setEdit({ ...edit, followable: e.target.checked })} />후속치료를 붙일 수 있는 항목 (예: 페인잼머 → 도수·림프…)</label>
          {edit.followable && <div className="chips">{FOLLOW.map((f) => <label key={f} className="chk"><input type="checkbox" checked={edit.followTargets?.includes(f) ?? false} onChange={() => setEdit({ ...edit, followTargets: edit.followTargets?.includes(f) ? edit.followTargets.filter((x) => x !== f) : [...(edit.followTargets ?? []), f] })} />{f}</label>)}</div>}
          <label className="chk"><input type="checkbox" checked={!!edit.followOnly} onChange={(e) => setEdit({ ...edit, followOnly: e.target.checked })} />다른 치료의 후속치료로만 쓰는 항목 (도수·림프 등)</label>
          <div className="fieldlabel">치료실 스케줄 연결 <small className="hint">연결하면 계획 대비 진행 횟수를 스케줄과 비교할 수 있습니다</small></div>
          <div className="chips tsrooms">{roomItems.map((r) => <label key={r.id} className="chk"><input type="checkbox" checked={edit.roomItemIds?.includes(r.id) ?? false} onChange={() => setEdit({ ...edit, roomItemIds: edit.roomItemIds?.includes(r.id) ? edit.roomItemIds.filter((x) => x !== r.id) : [...(edit.roomItemIds ?? []), r.id] })} />{r.label}</label>)}</div>
          <label>메모<input value={edit.note ?? ""} onChange={(e) => setEdit({ ...edit, note: e.target.value })} /></label>
          <div className="tspreview">요약 표기 미리보기 <b>{preview}</b></div>
          {err && <p className="err">{err}</p>}
          <div className="actions"><span style={{ flex: 1 }} /><button onClick={() => setEdit(null)}>취소</button><button className="primary" onClick={save}>저장</button></div>
        </div></div>)}

      {cedit && (
        <div className="overlay" onClick={() => setCedit(null)}><div className="modal" onClick={(e) => e.stopPropagation()}>
          <h3>{cedit.id ? "치료주기 수정" : "치료주기 추가"}</h3>
          <label>주기 이름<input value={cedit.label ?? ""} onChange={(e) => setCedit({ ...cedit, label: e.target.value })} placeholder="예: 주 2회" autoFocus /></label>
          <div className="row"><label>주당 횟수<input inputMode="numeric" value={cedit.pw ?? ""} onChange={(e) => { const v = e.target.value.replace(/\D/g, ""); setCedit({ ...cedit, pw: v, pm: v ? String(Number(v) * 4) : cedit.pm }); }} /></label>
            <label>격주 횟수<input inputMode="numeric" value={cedit.eo ?? ""} onChange={(e) => setCedit({ ...cedit, eo: e.target.value.replace(/\D/g, "") })} /></label>
            <label>월 합계<input inputMode="numeric" value={cedit.pm ?? ""} onChange={(e) => setCedit({ ...cedit, pm: e.target.value.replace(/\D/g, "") })} /></label></div>
          {err && <p className="err">{err}</p>}
          <div className="actions"><span style={{ flex: 1 }} /><button onClick={() => setCedit(null)}>취소</button><button className="primary" onClick={saveCycle}>저장</button></div>
        </div></div>)}
    </div>
  );
}

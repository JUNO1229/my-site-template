"use client"
import { useState } from "react"
import Papa from "papaparse"
import readXlsx from "read-excel-file"
import { importLeads, type LeadInput } from "@/app/actions"

const FIELDS: [keyof LeadInput, string, RegExp][] = [
  ["org_name", "기관명", /기관|업체|상호|회사|시설|org|name|company/i], ["org_type", "업종", /업종|유형|분류|type/i],
  ["sido", "시도", /시도|지역|sido|region/i], ["address", "주소", /주소|addr/i],
  ["contact_name", "담당자", /담당|성명|이름|contact/i], ["title", "직책", /직책|직위|title/i], ["dept", "부서", /부서|dept/i],
  ["email", "이메일", /메일|mail/i], ["phone", "전화", /^전화|tel|phone|유선/i], ["mobile", "휴대폰", /휴대|핸드폰|mobile|cell/i],
  ["fax", "팩스", /팩스|fax/i], ["homepage", "홈페이지", /홈페이지|url|site|web/i], ["grade", "등급", /등급|grade/i], ["memo", "메모", /메모|비고|memo/i]]

export default function Import() {
  const [file, setFile] = useState<string>("")
  const [head, setHead] = useState<string[]>([])
  const [data, setData] = useState<string[][]>([])
  const [map, setMap] = useState<Record<string, number>>({})
  const [tags, setTags] = useState("")
  const [ce, setCe] = useState(false); const [cs, setCs] = useState(false)
  const [log, setLog] = useState(""); const [busy, setBusy] = useState(false)

  async function onFile(f?: File) {
    if (!f) return
    setLog(""); setFile(f.name)
    let rows: string[][]
    if (/\.xlsx$/i.test(f.name)) rows = (await readXlsx(f)).map((r) => r.map((c) => (c == null ? "" : String(c))))
    else rows = await new Promise((res) => Papa.parse<string[]>(f, { skipEmptyLines: true, complete: (r) => res(r.data) }))
    const [h, ...body] = rows
    setHead(h.map((x) => String(x).trim())); setData(body)
    const m: Record<string, number> = {}
    for (const [key, , re] of FIELDS) { const i = h.findIndex((x) => re.test(String(x))); if (i >= 0) m[key] = i }
    setMap(m)
  }
  const build = (): LeadInput[] => data.map((r) => {
    const o: any = {}; for (const [k] of FIELDS) if (map[k] != null && map[k] >= 0) o[k] = (r[map[k]] ?? "").trim() || null
    return o
  }).filter((o) => o.org_name)

  async function run() {
    setBusy(true); const rows = build(); let ins = 0, mer = 0, fail = 0; const errs: string[] = []
    for (let i = 0; i < rows.length; i += 100) {
      const r = await importLeads(rows.slice(i, i + 100), tags.split(/[,，]/).map((x) => x.trim()).filter(Boolean), ce, cs, file)
      ins += r.inserted; mer += r.merged; fail += r.failed; errs.push(...r.errors)
      setLog(`진행 ${Math.min(i + 100, rows.length)}/${rows.length}`)
    }
    setLog(`완료: 신규 ${ins} · 병합(중복) ${mer} · 실패 ${fail}${errs.length ? "\n" + errs.join("\n") : ""}`); setBusy(false)
  }
  return (
    <div className="space-y-3">
      <h1 className="text-lg font-bold">엑셀/CSV 업로드</h1>
      <div className="card space-y-3">
        <input type="file" accept=".xlsx,.csv" onChange={(e) => onFile(e.target.files?.[0])} className="text-sm" />
        <p className="text-xs text-slate-500">첫 행은 헤더여야 합니다. .xlsx / .csv(UTF-8) 지원. 컬럼은 자동 매핑되며 아래에서 바꿀 수 있습니다.</p>
        {head.length > 0 && <>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">{FIELDS.map(([k, label]) => (
            <div key={k}><label className="label">{label}{k === "org_name" && " *"}</label>
              <select className="input" value={map[k] ?? -1} onChange={(e) => setMap({ ...map, [k]: Number(e.target.value) })}>
                <option value={-1}>(사용 안 함)</option>{head.map((h, i) => <option key={i} value={i}>{h || `열 ${i + 1}`}</option>)}</select></div>))}</div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <input className="input !w-56" placeholder="일괄 태그(쉼표)" value={tags} onChange={(e) => setTags(e.target.value)} />
            <label><input type="checkbox" checked={ce} onChange={(e) => setCe(e.target.checked)} /> 이메일 수신동의 확인된 목록</label>
            <label><input type="checkbox" checked={cs} onChange={(e) => setCs(e.target.checked)} /> 문자 수신동의 확인된 목록</label>
          </div>
          <div className="overflow-x-auto rounded border text-xs"><table className="w-full"><thead><tr>{head.map((h, i) => <th key={i} className="th">{h}</th>)}</tr></thead>
            <tbody>{data.slice(0, 5).map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="px-3 py-1">{c}</td>)}</tr>)}</tbody></table></div>
          <button className="btn" disabled={busy || map.org_name == null || map.org_name < 0} onClick={run}>{build().length}건 가져오기</button>
        </>}
        {log && <pre className="whitespace-pre-wrap text-sm">{log}</pre>}
      </div>
    </div>
  )
}

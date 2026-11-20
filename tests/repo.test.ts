import { beforeEach, describe, expect, it } from "vitest"
import * as R from "@/lib/repo"
import { collectFromSite } from "@/lib/collect"
import { freshDb } from "./helpers"

let h: Awaited<ReturnType<typeof freshDb>>
beforeEach(async () => { h = await freshDb() })

describe("dispatch compliance", () => {
  it("blocks email without consent; allows with; logs stage + followup", async () => {
    const id = await h.lead("A시설")
    await expect(R.logDispatch(id, { channel: "email", sent_by: "juno" })).rejects.toThrow(/동의/)
    await R.updateOutreach(id, { stage: "new", consent_for_email: true })
    await R.logDispatch(id, { channel: "email", sent_by: "juno", sent_on: "2026-11-20" })
    const o = await R.getOutreach(id)
    expect(o.stage).toBe("doc_sent"); expect(o.next_action_on).toBe("2026-11-27")
  })
  it("opt-out blocks everything and clears consent/followup", async () => {
    const id = await h.lead("B시설")
    await R.updateOutreach(id, { stage: "called", consent_for_email: true, next_action_on: "2026-12-01" })
    await R.recordOptOut(id)
    const o = await R.getOutreach(id)
    expect(o).toMatchObject({ stage: "do_not_contact", consent_for_email: false, next_action_on: null })
    await expect(R.logDispatch(id, { channel: "call", sent_by: "x" })).rejects.toThrow(/연락 금지/)
    expect((await R.exportRows({ grades: ["A"] })).length).toBe(0)
  })
  it("do_not_contact via stage update forces consent off", async () => {
    const id = await h.lead("C시설")
    await R.updateOutreach(id, { stage: "do_not_contact", consent_for_email: true })
    expect((await R.getOutreach(id)).consent_for_email).toBe(false)
  })
  it("sender is required; followups exclude closed stages", async () => {
    const id = await h.lead("D시설")
    await expect(R.logDispatch(id, { channel: "call", sent_by: " " })).rejects.toThrow(/발송자/)
    await R.updateOutreach(id, { stage: "called", next_action_on: "2026-11-01" })
    expect((await R.followups("2026-11-20")).map((f) => f.label)).toEqual(["기한 경과"])
    await R.updateOutreach(id, { stage: "lost", next_action_on: "2026-11-01" })
    expect(await R.followups("2026-11-20")).toHaveLength(0)
  })
})

describe("contacts & enrichment", () => {
  it("provenance and mobile rules", async () => {
    const id = await h.lead("E시설")
    await expect(R.addContact(id, { channel: "phone", value: "02-000-0000", confidence: "verified_official" })).rejects.toThrow(/출처/)
    await expect(R.addContact(id, { channel: "phone", value: "010-1234-5678", confidence: "public_data" })).rejects.toThrow(/휴대폰/)
    await expect(R.addCandidate(id, "phone", "010-1234-5678")).rejects.toThrow(/휴대폰/)
  })
  it("collect → pending (no auto apply) → approve needs reviewer → contact; best contact by confidence", async () => {
    const id = await h.lead("F시설")
    const fetcher = async (u: string) => { if (u.endsWith("robots.txt")) throw new Error("404"); return "<footer>대표 1588-1234</footer>" }
    expect((await collectFromSite(id, "https://x.example/", fetcher)).phones).toEqual(["1588-1234"])
    expect(await R.getContacts(id)).toHaveLength(0)
    const cand = (await R.pendingCandidates()).find((c) => c.channel === "phone")!
    await expect(R.approveCandidate(cand.id, " ", true)).rejects.toThrow(/검수자/)
    await R.approveCandidate(cand.id, "juno", true)
    await R.addContact(id, { channel: "phone", value: "031-111-2222", confidence: "public_data" })
    const l = await R.listLeads({ grades: ["A"] })
    expect(l.rows[0]).toMatchObject({ phone: "1588-1234", phone_confidence: "verified_official" })
    expect((await R.queue()).total).toBe(0)
  })
  it("robots disallow / fetch failure → blocked, never applied", async () => {
    const id = await h.lead("G시설")
    const r = await collectFromSite(id, "https://x.example/", async (u) => u.endsWith("robots.txt") ? "User-agent: *\nDisallow: /" : "<p>02-123-4567</p>")
    expect(r.status).toBe("blocked")
    const r2 = await collectFromSite(id, "https://y.example/", async (u) => { throw new Error("timeout") })
    expect(r2.status).toBe("blocked")
    expect((await R.pendingCandidates()).every((c) => c.status === "blocked" || c.channel === "homepage")).toBe(true)
    expect(await R.getContacts(id)).toHaveLength(0)
  })
})

describe("listing & analysis", () => {
  it("filters, hides mobile, paginates", async () => {
    await h.lead("물놀이1", "A"); await h.lead("공원2", "B", { kind: "공원 관리기관" })
    const m = await h.lead("이동랜드", "C"); await h.q(`UPDATE leads SET is_mobile_or_event=true WHERE id=$1`, [m])
    expect((await R.listLeads({ grades: ["A", "B", "C"] })).total).toBe(2)
    expect((await R.listLeads({ grades: ["A", "B", "C"], mobile: true })).total).toBe(3)
    expect((await R.listLeads({ kind: "공원 관리기관" })).rows[0].name).toBe("공원2")
    expect((await R.listLeads({ q: "물놀이" })).total).toBe(1)
    expect((await R.listLeads({ pageSize: 1 })).rows).toHaveLength(1)
  })
  it("sales points, funnel, coverage", async () => {
    const id = await h.lead("H시설")
    await R.addSalesPoint(id, "포인트", "safety"); await R.addSalesPoint(id, "포인트", "safety")
    expect(await R.getSalesPoints(id)).toHaveLength(1)
    expect((await R.pointsSummary())[0]).toMatchObject({ category: "safety", n: 1 })
    expect((await R.funnel())[0]).toMatchObject({ grade: "A", stage: "new", n: 1 })
    expect((await R.kindCoverage())[0].total).toBe(1)
  })
})

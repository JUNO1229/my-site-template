"use server"
import { run, str } from "@/lib/actions-util"
import * as R from "@/lib/repo"
import { collectFromSite } from "@/lib/collect"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { COOKIE } from "@/lib/auth"
import type { Channel, Stage } from "@/lib/domain"

const lead = (f: FormData) => Number(f.get("lead_id"))
const back = (f: FormData) => str(f, "back") || "/"

export async function logout() { (await cookies()).delete(COOKIE); redirect("/login") }

export async function saveOutreach(f: FormData) {
  await run(back(f), () => R.updateOutreach(lead(f), {
    stage: str(f, "stage") as Stage, next_action: str(f, "next_action"), next_action_on: str(f, "next_action_on"),
    owner: str(f, "owner"), memo: str(f, "memo"), consent_for_email: f.get("consent") === "on" }), "저장했습니다")
}
export async function optOut(f: FormData) { await run(back(f), () => R.recordOptOut(lead(f)), "연락 금지로 전환했습니다") }
export async function addPoint(f: FormData) { await run(back(f), () => R.addSalesPoint(lead(f), str(f, "point"), str(f, "category") || "other"), "영업 포인트를 추가했습니다") }
export async function addContact(f: FormData) {
  await run(back(f), () => R.addContact(lead(f), { channel: "phone", value: str(f, "value"), confidence: str(f, "confidence"),
    dept: str(f, "dept"), source_url: str(f, "source_url"), verified_on: str(f, "verified_on") }), "연락처를 추가했습니다")
}
export async function addCandidate(f: FormData) {
  await run(back(f), () => R.addCandidate(lead(f), "phone", str(f, "value"), { source_url: str(f, "source_url"), dept: str(f, "dept") }), "후보를 등록했습니다")
}
export async function collect(f: FormData) {
  await run(back(f), async () => {
    const r = await collectFromSite(lead(f), str(f, "url"))
    if (r.status === "blocked") throw new Error("수집이 차단/실패되어 수동 확인 목록에 기록했습니다")
  }, "후보를 수집했습니다 — 후보 검수에서 승인하세요")
}
export async function approve(f: FormData) { await run(back(f), () => R.approveCandidate(Number(f.get("id")), str(f, "reviewer"), f.get("official") === "1"), "승인했습니다") }
export async function reject(f: FormData) { await run(back(f), () => R.rejectCandidate(Number(f.get("id")), str(f, "reviewer")), "반려했습니다") }
export async function registerDoc(f: FormData) { await run(back(f), () => R.registerDocument(str(f, "name"), str(f, "kind"), str(f, "url"), str(f, "version")), "자료를 저장했습니다") }
export async function dispatch(f: FormData) {
  await run(back(f), () => R.logDispatch(lead(f), { channel: str(f, "channel") as Channel, sent_by: str(f, "sent_by"),
    document_id: f.get("document_id") ? Number(f.get("document_id")) : null, to_value: str(f, "to_value"), note: str(f, "note") }), "기록했습니다 · 후속 조치일 +7일")
}

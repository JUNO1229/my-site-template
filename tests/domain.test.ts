import { describe, expect, it } from "vitest"
import { DispatchBlocked, addDays, checkDispatchAllowed, extractPhones, followupAlert, robotsAllows, stageAfterDispatch, suggestPoints } from "@/lib/domain"
import { assertPublicUrl } from "@/lib/collect"

describe("compliance", () => {
  it("email needs consent, post does not, do_not_contact blocks all", () => {
    expect(() => checkDispatchAllowed({ stage: "new", consent_for_email: false }, "email")).toThrow(DispatchBlocked)
    expect(() => checkDispatchAllowed({ stage: "new", consent_for_email: true }, "email")).not.toThrow()
    expect(() => checkDispatchAllowed({ stage: "new", consent_for_email: false }, "post")).not.toThrow()
    for (const c of ["call", "post", "email"] as const)
      expect(() => checkDispatchAllowed({ stage: "do_not_contact", consent_for_email: true }, c)).toThrow(DispatchBlocked)
  })
  it("stage never goes backwards", () => {
    expect(stageAfterDispatch("new", "call")).toBe("called")
    expect(stageAfterDispatch("called", "post")).toBe("doc_sent")
    expect(stageAfterDispatch("meeting", "post")).toBe("meeting")
  })
})
describe("dates & alerts", () => {
  it("addDays", () => expect(addDays("2026-11-20", 7)).toBe("2026-11-27"))
  it("labels", () => {
    expect(followupAlert("2026-11-01", "2026-11-20").label).toBe("기한 경과")
    expect(followupAlert("2026-11-20", "2026-11-20").label).toBe("오늘")
    expect(followupAlert("2026-11-22", "2026-11-20").label).toBe("임박")
  })
})
describe("enrichment helpers", () => {
  it("extractPhones skips mobile and dedupes", () =>
    expect(extractPhones("<b>1588-7789</b> 033-335-5757 담당 010-1234-5678 1588-7789")).toEqual(["1588-7789", "033-335-5757"]))
  it("robots", () => {
    expect(robotsAllows("User-agent: *\nDisallow: /", "/a")).toBe(false)
    expect(robotsAllows("User-agent: *\nDisallow: /admin\nAllow: /admin/pub", "/admin/pub/x")).toBe(true)
    expect(robotsAllows("User-agent: bot\nDisallow: /", "/a")).toBe(true)
    expect(robotsAllows("", "/a")).toBe(true)
  })
  it("blocks internal URLs", () => {
    for (const u of ["http://localhost/", "http://127.0.0.1/", "http://169.254.169.254/", "http://10.0.0.1/", "http://intranet/", "ftp://a.com/", "http://[::1]/"])
      expect(() => assertPublicUrl(u)).toThrow()
    expect(() => assertPublicUrl("https://www.everland.com/")).not.toThrow()
  })
  it("suggests points once", () => {
    const s = suggestPoints("물놀이", "테스트 워터파크", [])
    expect(s.map((x) => x.category)).toContain("safety")
    expect(suggestPoints("물놀이", "테스트 워터파크", [s[0].point]).length).toBe(s.length - 1)
  })
})

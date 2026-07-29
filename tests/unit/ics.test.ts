import { describe, it, expect } from "vitest"
import { buildIcs, toIcsStamp, icsDataUrl, googleCalendarUrl } from "@/lib/ics"

const base = {
  title: "Appointment — Sunrise Clinic",
  startUtc: "2026-07-28T04:30:00.000Z", // 10:00 IST
  endUtc: "2026-07-28T04:45:00.000Z",
  uid: "appt-1@clinicflow",
  stampUtc: "2026-07-27T12:00:00.000Z",
}

describe("toIcsStamp", () => {
  it("renders a UTC basic-format timestamp", () => {
    expect(toIcsStamp("2026-07-28T04:30:00.000Z")).toBe("20260728T043000Z")
  })

  it("accepts a Date as well as an ISO string", () => {
    expect(toIcsStamp(new Date("2026-01-01T00:00:00Z"))).toBe("20260101T000000Z")
  })
})

describe("buildIcs", () => {
  const ics = buildIcs(base)

  it("uses CRLF line endings, as RFC 5545 requires", () => {
    // A bare-LF calendar file is the classic reason Outlook rejects an import
    // that every other client accepts.
    expect(ics).toContain("\r\n")
    expect(ics.split("\r\n").join("")).not.toContain("\n")
  })

  it("carries the event's instants, not a local time", () => {
    expect(ics).toContain("DTSTART:20260728T043000Z")
    expect(ics).toContain("DTEND:20260728T044500Z")
    expect(ics).toContain("DTSTAMP:20260727T120000Z")
  })

  it("is a well-formed single-event calendar", () => {
    expect(ics.startsWith("BEGIN:VCALENDAR")).toBe(true)
    expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true)
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1)
    expect(ics).toContain("UID:appt-1@clinicflow")
  })

  it("carries one hour-ahead alarm", () => {
    expect(ics).toContain("BEGIN:VALARM")
    expect(ics).toContain("TRIGGER:-PT60M")
  })

  it("escapes commas and semicolons in free text", () => {
    const out = buildIcs({
      ...base,
      location: "12, MG Road; Andheri",
    })
    expect(out).toContain("LOCATION:12\\, MG Road\\; Andheri")
  })

  it("escapes newlines rather than emitting them raw", () => {
    // A raw newline inside DESCRIPTION terminates the property and the rest of
    // the text becomes an unknown line — silently dropped by most clients.
    const out = buildIcs({ ...base, description: "Line one\nLine two" })
    expect(out).toContain("DESCRIPTION:Line one\\nLine two")
  })

  it("folds lines past the 75-octet limit", () => {
    const out = buildIcs({ ...base, location: "x".repeat(200) })
    for (const line of out.split("\r\n")) {
      expect(line.length).toBeLessThanOrEqual(75)
    }
    // Folded continuations must begin with a single space.
    expect(out).toMatch(/\r\n x/)
  })

  it("omits optional properties instead of emitting empty ones", () => {
    const out = buildIcs(base)
    expect(out).not.toContain("LOCATION:")
    // The alarm always carries a DESCRIPTION; the event itself should not get
    // one when the caller supplied no text.
    expect(out.match(/^DESCRIPTION:/gm)).toHaveLength(1)
  })
})

describe("icsDataUrl", () => {
  it("produces a decodable text/calendar data URL", () => {
    const url = icsDataUrl(base)
    expect(url.startsWith("data:text/calendar;charset=utf-8,")).toBe(true)
    const body = decodeURIComponent(url.slice("data:text/calendar;charset=utf-8,".length))
    expect(body).toBe(buildIcs(base))
  })
})

describe("googleCalendarUrl", () => {
  it("builds a template URL with a start/end range", () => {
    const url = new URL(googleCalendarUrl(base))
    expect(url.origin + url.pathname).toBe("https://calendar.google.com/calendar/render")
    expect(url.searchParams.get("action")).toBe("TEMPLATE")
    expect(url.searchParams.get("dates")).toBe("20260728T043000Z/20260728T044500Z")
    expect(url.searchParams.get("text")).toBe(base.title)
  })

  it("leaves out details and location when there are none", () => {
    const url = new URL(googleCalendarUrl(base))
    expect(url.searchParams.has("details")).toBe(false)
    expect(url.searchParams.has("location")).toBe(false)
  })
})

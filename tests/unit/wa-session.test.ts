import { describe, expect, it } from "vitest"

import {
  SESSION_TTL_MS,
  parseClinicCode,
  sessionFromRow,
  sessionToRow,
  type SessionRow,
} from "@/lib/whatsapp/bot/codec"
import type { Session } from "@/lib/whatsapp/bot/types"

const NOW = new Date("2026-08-15T10:00:00.000Z")
const future = (ms: number) => new Date(NOW.getTime() + ms).toISOString()

describe("session codec", () => {
  it("round-trips a draft booking through a row", () => {
    const session: Session = {
      state: "awaiting_confirm",
      clinicId: "c1",
      dateKey: "2026-08-16",
      startUtc: "2026-08-16T05:30:00.000Z",
      name: "Ramesh Kumar",
      slotPage: 2,
    }
    const row = sessionToRow("+919876543210", session, NOW)
    expect(row.phone).toBe("+919876543210")
    expect(row.clinic_id).toBe("c1")

    const back = sessionFromRow({ ...row, expires_at: row.expires_at } as SessionRow, NOW)
    expect(back).toEqual(session)
  })

  it("gives a fresh session when there is no row", () => {
    expect(sessionFromRow(null, NOW)).toEqual({ state: "idle", clinicId: null })
  })

  it("extends expiry by the TTL on every save, so an active patient never lapses", () => {
    const row = sessionToRow("+91", { state: "awaiting_day", clinicId: "c1" }, NOW)
    expect(new Date(row.expires_at).getTime() - NOW.getTime()).toBe(SESSION_TTL_MS)
  })

  it("drops a lapsed draft but keeps the clinic", () => {
    const row: SessionRow = {
      clinic_id: "c1",
      state: "awaiting_confirm",
      context: { name: "Ramesh", startUtc: "2026-08-16T05:30:00.000Z" },
      expires_at: future(-1000),
    }
    // The half-finished booking is gone — a slot chosen an hour ago is not a
    // live intent — but they are still talking to the same practice.
    expect(sessionFromRow(row, NOW)).toEqual({ state: "idle", clinicId: "c1" })
  })

  it("treats a state this build does not know as idle rather than wedging", () => {
    const row: SessionRow = {
      clinic_id: "c1",
      state: "awaiting_something_removed_in_a_later_deploy",
      context: {},
      expires_at: future(60_000),
    }
    expect(sessionFromRow(row, NOW).state).toBe("idle")
  })

  it("ignores junk in the context rather than trusting it", () => {
    const row: SessionRow = {
      clinic_id: "c1",
      state: "awaiting_slot",
      context: { dateKey: 42, name: "", slotPage: -3, startUtc: null },
      expires_at: future(60_000),
    }
    const s = sessionFromRow(row, NOW)
    expect(s).toEqual({ state: "awaiting_slot", clinicId: "c1" })
  })

  it("survives a null context", () => {
    const row: SessionRow = { clinic_id: null, state: "idle", context: null, expires_at: future(60_000) }
    expect(sessionFromRow(row, NOW)).toEqual({ state: "idle", clinicId: null })
  })
})

describe("clinic deep-link codes", () => {
  it("reads the slug out of what the deep link prefills", () => {
    expect(parseClinicCode("BOOK sunrise-clinic")).toBe("sunrise-clinic")
    expect(parseClinicCode("  book   Sunrise-Clinic  ")).toBe("sunrise-clinic")
  })

  it("refuses a bare word, because patients say ordinary things", () => {
    // A bare slug would eventually collide with "hello" or "doctor", and
    // routing someone into a stranger's practice is far worse than asking.
    for (const t of ["hello", "doctor", "sunrise-clinic", "book", "booking", "i want to book"]) {
      expect(parseClinicCode(t)).toBeNull()
    }
  })

  it("refuses codes that could not be a slug", () => {
    expect(parseClinicCode("book ../../etc/passwd")).toBeNull()
    expect(parseClinicCode("book a")).toBeNull()
    expect(parseClinicCode("book -leading-dash")).toBeNull()
    expect(parseClinicCode(`book ${"x".repeat(80)}`)).toBeNull()
  })
})

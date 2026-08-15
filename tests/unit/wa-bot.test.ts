import { describe, expect, it } from "vitest"

import { reduce } from "@/lib/whatsapp/bot/machine"
import { INITIAL_SESSION, WA_LIMITS, type BotContext, type Outbound, type Session } from "@/lib/whatsapp/bot/types"
import type { BookableSlot, BookingDay } from "@/lib/booking-days"

/**
 * The bot's conversation, exercised without Meta, Supabase or a network. That
 * is the whole reason the reducer is pure: the interesting branches here are
 * races and dead ends, and none of them are reachable by hand-testing a live
 * WhatsApp number.
 */

const NOW = new Date("2026-08-15T04:00:00Z") // 09:30 IST, Saturday

/** Slots on `dateKey` at the given IST hours. */
function slotsAt(dateKey: string, hours: number[]): BookableSlot[] {
  return hours.map((h) => {
    const utcHour = h - 5.5
    const start = new Date(`${dateKey}T00:00:00Z`)
    start.setUTCMinutes(start.getUTCMinutes() + utcHour * 60)
    const end = new Date(start.getTime() + 15 * 60_000)
    const label = `${((h % 12) || 12)}:00 ${h < 12 ? "AM" : "PM"}`
    return { startUtc: start.toISOString(), endUtc: end.toISOString(), label }
  })
}

function day(dateKey: string, hours: number[], closed = false): BookingDay {
  return {
    dateKey,
    weekdayLabel: "Mon",
    dateLabel: "16 Aug",
    closed,
    slots: closed ? [] : slotsAt(dateKey, hours),
  }
}

function ctxOf(over: Partial<BotContext> = {}): BotContext {
  return {
    clinic: {
      id: "c1",
      slug: "sunrise-clinic",
      name: "Sunrise Clinic",
      doctorName: "Dr. Anita Sharma",
      bookingEnabled: true,
      bookingMode: "instant",
    },
    days: [day("2026-08-15", [10, 11, 17]), day("2026-08-16", [10, 11])],
    patient: null,
    upcoming: null,
    now: NOW,
    ...over,
  }
}

const msg = (body: string) => ({ kind: "message", message: { type: "text", body } }) as const
const tap = (id: string) => ({ kind: "message", message: { type: "reply", id } }) as const

const only = (r: { replies: Outbound[] }) => r.replies[0]
const rowIds = (o: Outbound) =>
  o.type === "list" ? o.sections.flatMap((s) => s.rows.map((r) => r.id)) : []
const bodyOf = (o: Outbound) => ("body" in o ? o.body : "")

/** Every id the bot offered, so a test can answer with one it actually sent. */
const firstSlotId = (o: Outbound) => rowIds(o).find((i) => i.startsWith("slot:"))!

describe("booking bot — the happy path", () => {
  it("walks a new patient from hello to a confirmed booking", () => {
    const ctx = ctxOf()

    // 1. Greeting → day picker
    const a = reduce(INITIAL_SESSION, msg("hi"), ctx)
    expect(a.session.state).toBe("awaiting_day")
    expect(only(a).type).toBe("list")
    expect(bodyOf(only(a))).toContain("Sunrise Clinic")
    expect(rowIds(only(a))).toEqual(["day:2026-08-15", "day:2026-08-16"])

    // 2. Pick a day → time picker
    const b = reduce(a.session, tap("day:2026-08-15"), ctx)
    expect(b.session.state).toBe("awaiting_slot")
    expect(b.session.dateKey).toBe("2026-08-15")

    // 3. Pick a time → asked for a name, because this phone is not a patient yet
    const slot = firstSlotId(only(b))
    const c = reduce(b.session, tap(slot), ctx)
    expect(c.session.state).toBe("awaiting_name")
    expect(bodyOf(only(c))).toMatch(/name/i)

    // 4. Give a name → confirmation with the real details on it
    const d = reduce(c.session, msg("Ramesh Kumar"), ctx)
    expect(d.session.state).toBe("awaiting_confirm")
    expect(only(d).type).toBe("buttons")
    expect(bodyOf(only(d))).toContain("Ramesh Kumar")
    expect(bodyOf(only(d))).toContain("Dr. Anita Sharma")

    // 5. Confirm → the reducer asks the CALLER to book; it books nothing itself
    const e = reduce(d.session, tap("confirm"), ctx)
    expect(e.action).toEqual({ type: "book", startUtc: slot.slice(5), name: "Ramesh Kumar" })
    expect(e.replies).toHaveLength(0)

    // 6. Caller reports success → the patient is told, session resets
    const f = reduce(e.session, { kind: "booked", tokenNumber: 7, startUtc: slot.slice(5), pending: false }, ctx)
    expect(bodyOf(only(f))).toContain("token number is 7")
    expect(f.session.state).toBe("idle")
  })

  it("never asks a returning patient for a name it already has", () => {
    const ctx = ctxOf({ patient: { id: "p1", fullName: "Sunita Rao" } })
    const a = reduce(INITIAL_SESSION, msg("book"), ctx)
    const b = reduce(a.session, tap("day:2026-08-15"), ctx)
    const c = reduce(b.session, tap(firstSlotId(only(b))), ctx)

    expect(c.session.state).toBe("awaiting_confirm")
    expect(bodyOf(only(c))).toContain("Sunita Rao")
  })

  it("says 'requested' rather than 'booked' for an approve-mode clinic", () => {
    const ctx = ctxOf({ clinic: { ...ctxOf().clinic, bookingMode: "approve" } })
    const r = reduce(
      { state: "awaiting_confirm", clinicId: "c1" },
      { kind: "booked", tokenNumber: null, startUtc: "2026-08-15T05:30:00.000Z", pending: true },
      ctx,
    )
    expect(bodyOf(only(r))).toMatch(/will confirm/i)
    expect(bodyOf(only(r))).not.toMatch(/token/i)
  })
})

describe("booking bot — races against the live grid", () => {
  it("re-offers the day when the chosen slot vanished before confirming", () => {
    const ctx = ctxOf()
    const a = reduce(INITIAL_SESSION, msg("book"), ctx)
    const b = reduce(a.session, tap("day:2026-08-15"), ctx)
    const taken = firstSlotId(only(b))

    // Someone else takes it while the patient is deciding.
    const after = ctxOf({
      days: [
        { ...ctx.days[0], slots: ctx.days[0].slots.filter((s) => `slot:${s.startUtc}` !== taken) },
        ctx.days[1],
      ],
    })

    const c = reduce(b.session, tap(taken), after)
    expect(c.session.state).toBe("awaiting_slot")
    expect(bodyOf(only(c))).toMatch(/just taken/i)
    expect(rowIds(only(c))).not.toContain(taken)
  })

  it("recovers from the booking losing the race at the last instant", () => {
    const ctx = ctxOf()
    const session: Session = { state: "awaiting_confirm", clinicId: "c1", dateKey: "2026-08-15" }
    const r = reduce(session, { kind: "book_failed", reason: "slot_taken" }, ctx)

    expect(r.session.state).toBe("awaiting_slot")
    expect(bodyOf(only(r))).toMatch(/just taken/i)
  })

  it("sends the patient back to the day list when their day emptied entirely", () => {
    const ctx = ctxOf({ days: [day("2026-08-15", [], true), day("2026-08-16", [10, 11])] })
    const r = reduce({ state: "awaiting_day", clinicId: "c1" }, tap("day:2026-08-15"), ctx)

    expect(bodyOf(only(r))).toMatch(/just filled up/i)
    expect(rowIds(only(r))).toEqual(["day:2026-08-16"])
  })

  it("does not book on a stale confirm whose slot is gone", () => {
    // The id is real but the grid no longer has it; the reducer must not
    // emit a book action for a slot it cannot see.
    const ctx = ctxOf()
    const stale: Session = {
      state: "awaiting_slot",
      clinicId: "c1",
      dateKey: "2026-08-15",
    }
    const r = reduce(stale, tap("slot:2026-01-01T00:00:00.000Z"), ctx)
    expect(r.action).toBeUndefined()
    expect(r.session.state).toBe("awaiting_slot")
  })
})

describe("booking bot — commandOf only matches a bare command word", () => {
  // `commandOf` is anchored `^...$` on purpose — a prefix match would misread
  // "booking issue" or "cancel my subscription" as commands. That strictness
  // is exactly what makes the deep-link's raw text ("BOOK sunrise-clinic")
  // unrecognisable to the reducer on its own; `handler.ts` is responsible for
  // rewriting it to a bare "book" once `resolveClinic` has consumed the code.
  // This just pins the reducer's half of that contract so it cannot silently
  // regress back to matching prefixes (which would reopen the door to
  // "booking a flight" being read as a command) or stop matching "book" at all.
  it("does not treat a deep-link code as the book command by itself", () => {
    const r = reduce(INITIAL_SESSION, msg("BOOK sunrise-clinic"), ctxOf())
    expect(r.session.state).toBe("idle")
    expect(bodyOf(only(r))).toMatch(/did not follow/i)
  })

  it("does treat a bare 'book' as the command, case-insensitively", () => {
    const r = reduce(INITIAL_SESSION, msg("Book"), ctxOf())
    expect(r.session.state).toBe("awaiting_day")
  })
})

describe("booking bot — commands outrank the current screen", () => {
  it("honours STOP mid-flow and asks the caller to opt the patient out", () => {
    const ctx = ctxOf()
    const mid: Session = { state: "awaiting_name", clinicId: "c1", startUtc: "x" }
    const r = reduce(mid, msg("STOP"), ctx)

    expect(r.action).toEqual({ type: "opt_out" })
    expect(r.session.state).toBe("idle")
  })

  it("treats START as opting back in", () => {
    const r = reduce(INITIAL_SESSION, msg("start"), ctxOf())
    expect(r.action).toEqual({ type: "opt_in" })
    expect(r.session.state).toBe("awaiting_day")
  })

  it("CANCEL asks before cancelling, and only cancels on the second tap", () => {
    const ctx = ctxOf({
      upcoming: { id: "a1", startsAt: "2026-08-16T05:30:00.000Z", tokenNumber: 3 },
    })
    const ask = reduce(INITIAL_SESSION, msg("cancel"), ctx)
    expect(ask.action).toBeUndefined()
    expect(ask.session.state).toBe("awaiting_cancel_confirm")

    const yes = reduce(ask.session, tap("cancel_yes"), ctx)
    expect(yes.action).toEqual({ type: "cancel", appointmentId: "a1" })

    const no = reduce(ask.session, tap("cancel_no"), ctx)
    expect(no.action).toBeUndefined()
    expect(bodyOf(only(no))).toMatch(/stands/i)
  })

  it("says there is nothing to cancel when there is nothing to cancel", () => {
    const r = reduce(INITIAL_SESSION, msg("cancel"), ctxOf())
    expect(r.action).toBeUndefined()
    expect(bodyOf(only(r))).toMatch(/no upcoming/i)
  })

  it("reports the next appointment on STATUS", () => {
    const ctx = ctxOf({
      upcoming: { id: "a1", startsAt: "2026-08-16T05:30:00.000Z", tokenNumber: 3 },
    })
    const r = reduce(INITIAL_SESSION, msg("status"), ctx)
    expect(bodyOf(only(r))).toContain("11:00 AM")
    expect(bodyOf(only(r))).toContain("3")
  })
})

describe("booking bot — dead ends are explained, not silent", () => {
  it("refuses politely when the clinic has online booking switched off", () => {
    const ctx = ctxOf({ clinic: { ...ctxOf().clinic, bookingEnabled: false } })
    const r = reduce(INITIAL_SESSION, msg("book"), ctx)
    expect(bodyOf(only(r))).toMatch(/not taking online bookings/i)
    expect(r.session.state).toBe("idle")
  })

  it("says so when the whole week is full", () => {
    const ctx = ctxOf({ days: [day("2026-08-15", [], true), day("2026-08-16", [], true)] })
    const r = reduce(INITIAL_SESSION, msg("book"), ctx)
    expect(bodyOf(only(r))).toMatch(/no free slots/i)
  })

  it("explains itself rather than ignoring an unreadable message", () => {
    const r = reduce(INITIAL_SESSION, { kind: "message", message: { type: "unsupported" } }, ctxOf())
    expect(bodyOf(only(r))).toMatch(/only read text/i)
  })

  it("rejects a one-character name", () => {
    const s: Session = { state: "awaiting_name", clinicId: "c1", startUtc: "x" }
    const r = reduce(s, msg("R"), ctxOf())
    expect(r.session.state).toBe("awaiting_name")
    expect(bodyOf(only(r))).toMatch(/full name/i)
  })
})

describe("booking bot — Meta's interactive limits", () => {
  /** Every limit that makes Meta reject a message outright. */
  function assertSendable(o: Outbound) {
    expect(bodyOf(o).length).toBeLessThanOrEqual(WA_LIMITS.body)
    if (o.type === "buttons") {
      expect(o.buttons.length).toBeLessThanOrEqual(WA_LIMITS.buttons)
      for (const b of o.buttons) expect(b.title.length).toBeLessThanOrEqual(WA_LIMITS.buttonTitle)
    }
    if (o.type === "list") {
      expect(o.button.length).toBeLessThanOrEqual(WA_LIMITS.listButton)
      expect(o.sections.length).toBeLessThanOrEqual(WA_LIMITS.listSections)
      const rows = o.sections.flatMap((s) => s.rows)
      expect(rows.length).toBeLessThanOrEqual(WA_LIMITS.listRows)
      for (const s of o.sections) expect(s.title.length).toBeLessThanOrEqual(WA_LIMITS.sectionTitle)
      for (const r of rows) {
        expect(r.title.length).toBeLessThanOrEqual(WA_LIMITS.rowTitle)
        if (r.description) expect(r.description.length).toBeLessThanOrEqual(WA_LIMITS.rowDescription)
      }
    }
  }

  it("paginates a clinic with far more slots than a list can hold", () => {
    // 9am–8pm on the hour: 12 slots, comfortably over the 10-row cap.
    const many = day("2026-08-15", [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20])
    const ctx = ctxOf({ days: [many] })

    const a = reduce(INITIAL_SESSION, msg("book"), ctx)
    const b = reduce(a.session, tap("day:2026-08-15"), ctx)
    assertSendable(only(b))
    expect(rowIds(only(b))).toContain("more")

    const c = reduce(b.session, tap("more"), ctx)
    assertSendable(only(c))
    expect(c.session.slotPage).toBe(1)

    // Page two holds the rest and stops offering "more".
    const page1 = rowIds(only(c)).filter((i) => i.startsWith("slot:"))
    const page0 = rowIds(only(b)).filter((i) => i.startsWith("slot:"))
    expect(page0.length + page1.length).toBe(12)
    expect(new Set([...page0, ...page1]).size).toBe(12)
    expect(rowIds(only(c))).not.toContain("more")
  })

  it("keeps every screen inside the limits even with overlong clinic and patient names", () => {
    const ctx = ctxOf({
      clinic: {
        ...ctxOf().clinic,
        name: "A Very Long Clinic Name Indeed Memorial Hospital And Polyclinic",
        doctorName: "Dr. Somebody With A Rather Long Name Indeed",
      },
      patient: { id: "p1", fullName: "Another Extremely Long Patient Name Here" },
      upcoming: { id: "a1", startsAt: "2026-08-16T05:30:00.000Z", tokenNumber: 3 },
    })
    const a = reduce(INITIAL_SESSION, msg("book"), ctx)
    const b = reduce(a.session, tap("day:2026-08-15"), ctx)
    const c = reduce(b.session, tap(firstSlotId(only(b))), ctx)
    const d = reduce(INITIAL_SESSION, msg("cancel"), ctx)
    for (const r of [a, b, c, d]) r.replies.forEach(assertSendable)
  })
})

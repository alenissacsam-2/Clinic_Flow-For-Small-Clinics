import { describe, it, expect } from "vitest"
import { generateDaySlots, nextDateKeys, type SlotSession } from "@/lib/slots"

// A Thursday in IST. 2026-07-23 is a Thursday (weekday 4).
const THU = "2026-07-23"
// Far-past "now" so lead-time never trims our fixture slots.
const PAST_NOW = new Date("2020-01-01T00:00:00Z")

const sessions: SlotSession[] = [
  { weekday: 4, start_time: "10:00:00", end_time: "11:00:00" }, // Thu morning
  { weekday: 4, start_time: "17:00:00", end_time: "17:30:00" }, // Thu evening
  { weekday: 0, start_time: "10:00:00", end_time: "12:00:00" }, // Sunday
]

describe("generateDaySlots", () => {
  it("tiles sessions for the correct weekday at the slot length", () => {
    const slots = generateDaySlots({
      dateKey: THU,
      sessions,
      slotMinutes: 15,
      leadMinutes: 30,
      now: PAST_NOW,
    })
    // 10:00-11:00 => 4 slots, 17:00-17:30 => 2 slots
    expect(slots).toHaveLength(6)
    expect(slots[0].label).toBe("10:00 AM")
    expect(slots[3].label).toBe("10:45 AM")
    expect(slots[4].label).toBe("05:00 PM")
  })

  it("maps IST slot start to the correct UTC instant (IST = UTC+5:30)", () => {
    const [first] = generateDaySlots({
      dateKey: THU,
      sessions,
      slotMinutes: 30,
      leadMinutes: 0,
      now: PAST_NOW,
    })
    // 10:00 IST on 23 Jul == 04:30 UTC on 23 Jul
    expect(first.startUtc).toBe("2026-07-23T04:30:00.000Z")
  })

  it("returns nothing on a weekday with no sessions", () => {
    const slots = generateDaySlots({
      dateKey: "2026-07-24", // Friday, weekday 5 — no sessions
      sessions,
      slotMinutes: 15,
      leadMinutes: 30,
      now: PAST_NOW,
    })
    expect(slots).toHaveLength(0)
  })

  it("excludes booked slot starts", () => {
    const booked = new Set(["2026-07-23T04:30:00.000Z"]) // 10:00 IST taken
    const slots = generateDaySlots({
      dateKey: THU,
      sessions,
      slotMinutes: 15,
      leadMinutes: 30,
      now: PAST_NOW,
      bookedStartsUtc: booked,
    })
    expect(slots.find((s) => s.label === "10:00 AM")).toBeUndefined()
    expect(slots).toHaveLength(5)
  })

  it("respects the lead time, trimming slots too close to now", () => {
    // now = 10:20 IST => 04:50 UTC; lead 30m => cutoff 05:20 UTC.
    const now = new Date("2026-07-23T04:50:00Z")
    const slots = generateDaySlots({
      dateKey: THU,
      sessions,
      slotMinutes: 15,
      leadMinutes: 30,
      now,
    })
    // Morning slots before 10:45 IST (05:15 UTC start) are trimmed; 10:45 stays? 10:45 IST = 05:15 UTC < 05:20 cutoff => trimmed.
    // First surviving morning slot would need start >= 05:20 UTC; none in 10:00-11:00 window after that except none (11:00 is end).
    expect(slots.every((s) => new Date(s.startUtc).getTime() >= now.getTime() + 30 * 60000)).toBe(true)
    // Evening slots (17:00, 17:15 IST) survive.
    expect(slots.some((s) => s.label === "05:00 PM")).toBe(true)
  })

  it("returns [] when the day is overridden closed (holiday)", () => {
    const slots = generateDaySlots({
      dateKey: THU,
      sessions,
      override: { date: THU, closed: true, start_time: null, end_time: null },
      slotMinutes: 15,
      leadMinutes: 30,
      now: PAST_NOW,
    })
    expect(slots).toHaveLength(0)
  })

  it("uses custom override hours when open with custom times", () => {
    const slots = generateDaySlots({
      dateKey: THU,
      sessions,
      override: { date: THU, closed: false, start_time: "14:00:00", end_time: "14:30:00" },
      slotMinutes: 15,
      leadMinutes: 30,
      now: PAST_NOW,
    })
    expect(slots.map((s) => s.label)).toEqual(["02:00 PM", "02:15 PM"])
  })

  it("adapts to a different slot length", () => {
    const slots = generateDaySlots({
      dateKey: THU,
      sessions,
      slotMinutes: 20,
      leadMinutes: 0,
      now: PAST_NOW,
    })
    // 10:00-11:00 at 20m => 3 slots; 17:00-17:30 at 20m => 1 slot (17:00-17:20)
    expect(slots).toHaveLength(4)
  })

  it("removes slots overlapping a block (booking view)", () => {
    const slots = generateDaySlots({
      dateKey: THU,
      sessions,
      slotMinutes: 15,
      leadMinutes: 30,
      now: PAST_NOW,
      blocks: [{ start_time: "10:15", end_time: "10:45" }], // blocks 10:15 and 10:30 slots
    })
    const labels = slots.map((s) => s.label)
    expect(labels).toContain("10:00 AM")
    expect(labels).not.toContain("10:15 AM")
    expect(labels).not.toContain("10:30 AM")
    expect(labels).toContain("10:45 AM") // touches block end, no overlap
    expect(labels).toContain("05:00 PM")
    expect(slots).toHaveLength(4)
  })

  it("flags but keeps blocked slots when includeBlocked is true (calendar view)", () => {
    const slots = generateDaySlots({
      dateKey: THU,
      sessions,
      slotMinutes: 15,
      leadMinutes: 0,
      now: PAST_NOW,
      blocks: [{ start_time: "10:15", end_time: "10:45" }],
      includeBlocked: true,
    })
    // Nothing removed — 6 slots as usual.
    expect(slots).toHaveLength(6)
    expect(slots.find((s) => s.label === "10:00 AM")?.blocked).toBe(false)
    expect(slots.find((s) => s.label === "10:15 AM")?.blocked).toBe(true)
    expect(slots.find((s) => s.label === "10:30 AM")?.blocked).toBe(true)
    expect(slots.find((s) => s.label === "10:45 AM")?.blocked).toBe(false)
  })

  it("treats a block touching a slot boundary as no overlap", () => {
    // Block exactly 10:00-10:15 removes only the 10:00 slot, not 10:15.
    const slots = generateDaySlots({
      dateKey: THU,
      sessions,
      slotMinutes: 15,
      leadMinutes: 30,
      now: PAST_NOW,
      blocks: [{ start_time: "10:00", end_time: "10:15" }],
    })
    const labels = slots.map((s) => s.label)
    expect(labels).not.toContain("10:00 AM")
    expect(labels).toContain("10:15 AM")
  })
})

describe("nextDateKeys", () => {
  it("returns consecutive IST day keys", () => {
    expect(nextDateKeys(THU, 3)).toEqual(["2026-07-23", "2026-07-24", "2026-07-25"])
  })
  it("rolls over month boundaries", () => {
    expect(nextDateKeys("2026-07-31", 2)).toEqual(["2026-07-31", "2026-08-01"])
  })
})

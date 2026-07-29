import { describe, it, expect } from "vitest"
import {
  buildBookingDays,
  groupSlots,
  partOfDay,
  relativeDay,
  BOOKING_HORIZON_DAYS,
  type BookableSlot,
} from "@/lib/booking-days"
import type { SlotSession } from "@/lib/slots"

// 2026-07-23 is a Thursday (IST weekday 4). "Now" is 09:00 IST that morning.
const NOW = new Date("2026-07-23T03:30:00.000Z")

// Thursday only: the clinic is shut every other day of the week, which is what
// makes the closed-vs-full distinction testable.
const thursdayOnly: SlotSession[] = [
  { weekday: 4, start_time: "10:00:00", end_time: "11:00:00" },
  { weekday: 4, start_time: "17:00:00", end_time: "18:00:00" },
]

const slot = (startUtc: string): BookableSlot => ({
  startUtc,
  endUtc: startUtc,
  label: "x",
})

describe("buildBookingDays", () => {
  it("returns exactly the bookable horizon, starting today", () => {
    const days = buildBookingDays({ availability: thursdayOnly, now: NOW })
    expect(days).toHaveLength(BOOKING_HORIZON_DAYS)
    expect(days[0].dateKey).toBe("2026-07-23")
    expect(days[6].dateKey).toBe("2026-07-29")
  })

  it("marks days the clinic does not work as closed", () => {
    const days = buildBookingDays({ availability: thursdayOnly, now: NOW })
    expect(days[0].closed).toBe(false) // Thursday
    expect(days[1].closed).toBe(true) // Friday — no session row
    expect(days[1].slots).toHaveLength(0)
  })

  it("distinguishes a fully-booked open day from a closed one", () => {
    // Book out every Thursday slot; the day must stay `closed: false` so the
    // UI can say "Full" rather than "Closed" — different instructions to the
    // patient, and identical slot counts.
    const booked = [
      "2026-07-23T04:30:00.000Z",
      "2026-07-23T04:45:00.000Z",
      "2026-07-23T05:00:00.000Z",
      "2026-07-23T05:15:00.000Z",
      "2026-07-23T11:30:00.000Z",
      "2026-07-23T11:45:00.000Z",
      "2026-07-23T12:00:00.000Z",
      "2026-07-23T12:15:00.000Z",
    ]
    const days = buildBookingDays({ availability: thursdayOnly, booked, now: NOW })
    expect(days[0].closed).toBe(false)
    expect(days[0].slots).toHaveLength(0)
  })

  it("treats an override that closes a working day as closed", () => {
    const days = buildBookingDays({
      availability: thursdayOnly,
      overrides: [{ date: "2026-07-23", closed: true, start_time: null, end_time: null }],
      now: NOW,
    })
    expect(days[0].closed).toBe(true)
    expect(days[0].slots).toHaveLength(0)
  })

  it("treats an override that opens a normally-shut day as open", () => {
    // Friday has no session row, but the doctor opened it for one afternoon.
    const days = buildBookingDays({
      availability: thursdayOnly,
      overrides: [
        { date: "2026-07-24", closed: false, start_time: "14:00:00", end_time: "15:00:00" },
      ],
      now: NOW,
    })
    expect(days[1].closed).toBe(false)
    expect(days[1].slots.length).toBeGreaterThan(0)
  })

  it("carries an end instant on every slot, for the calendar export", () => {
    const days = buildBookingDays({ availability: thursdayOnly, now: NOW })
    const first = days[0].slots[0]
    expect(new Date(first.endUtc).getTime() - new Date(first.startUtc).getTime()).toBe(15 * 60_000)
  })
})

describe("partOfDay", () => {
  it("splits on lunch and the end of the working day, in IST", () => {
    expect(partOfDay("2026-07-23T04:30:00Z")).toBe("morning") // 10:00 IST
    expect(partOfDay("2026-07-23T06:29:00Z")).toBe("morning") // 11:59 IST
    expect(partOfDay("2026-07-23T06:30:00Z")).toBe("afternoon") // 12:00 IST
    expect(partOfDay("2026-07-23T10:29:00Z")).toBe("afternoon") // 15:59 IST
    expect(partOfDay("2026-07-23T10:30:00Z")).toBe("evening") // 16:00 IST
  })
})

describe("groupSlots", () => {
  it("keeps morning → afternoon → evening order and drops empty parts", () => {
    const groups = groupSlots([
      slot("2026-07-23T13:30:00Z"), // 19:00 IST — evening
      slot("2026-07-23T04:30:00Z"), // 10:00 IST — morning
    ])
    expect(groups.map((g) => g.part)).toEqual(["morning", "evening"])
    expect(groups[0].slots).toHaveLength(1)
  })

  it("returns nothing for an empty day", () => {
    expect(groupSlots([])).toEqual([])
  })
})

describe("relativeDay", () => {
  it("names the first two days rather than dating them", () => {
    expect(relativeDay(0, "Thu")).toBe("Today")
    expect(relativeDay(1, "Fri")).toBe("Tomorrow")
    expect(relativeDay(2, "Sat")).toBe("Sat")
  })
})

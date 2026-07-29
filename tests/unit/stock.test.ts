import { describe, it, expect } from "vitest"
import {
  allocateFefo,
  sortFefo,
  isExpired,
  expiryTier,
  expiryLabel,
  sellableQty,
  daysBetween,
  type StockBatch,
} from "@/lib/pharmacy/stock"

const TODAY = "2026-07-26"

const batch = (id: string, expiryDate: string | null, qtyAvailable: number): StockBatch => ({
  id,
  batchNo: `B-${id}`,
  expiryDate,
  qtyAvailable,
})

describe("daysBetween", () => {
  it("counts whole days in both directions", () => {
    expect(daysBetween(TODAY, "2026-07-27")).toBe(1)
    expect(daysBetween(TODAY, TODAY)).toBe(0)
    expect(daysBetween(TODAY, "2026-07-25")).toBe(-1)
  })

  it("crosses a month and a year boundary correctly", () => {
    expect(daysBetween("2026-07-26", "2026-08-26")).toBe(31)
    expect(daysBetween("2026-12-31", "2027-01-01")).toBe(1)
  })

  it("ignores a time component", () => {
    expect(daysBetween("2026-07-26T23:59:00Z", "2026-07-27T00:01:00Z")).toBe(1)
  })
})

describe("isExpired", () => {
  it("treats stock as good through its expiry date", () => {
    expect(isExpired({ expiryDate: TODAY }, TODAY)).toBe(false)
    expect(isExpired({ expiryDate: "2026-07-25" }, TODAY)).toBe(true)
    expect(isExpired({ expiryDate: "2026-07-27" }, TODAY)).toBe(false)
  })

  it("never expires undated stock", () => {
    expect(isExpired({ expiryDate: null }, TODAY)).toBe(false)
  })
})

describe("sortFefo", () => {
  it("puts the soonest expiry first", () => {
    const sorted = sortFefo([
      batch("c", "2027-01-01", 5),
      batch("a", "2026-09-01", 5),
      batch("b", "2026-12-01", 5),
    ])
    expect(sorted.map((b) => b.id)).toEqual(["a", "b", "c"])
  })

  it("sorts undated stock last — it has no urgency", () => {
    const sorted = sortFefo([batch("none", null, 5), batch("dated", "2027-01-01", 5)])
    expect(sorted.map((b) => b.id)).toEqual(["dated", "none"])
  })

  it("is stable for identical expiries", () => {
    const input = [batch("z", "2026-09-01", 5), batch("a", "2026-09-01", 5)]
    expect(sortFefo(input).map((b) => b.batchNo)).toEqual(["B-a", "B-z"])
    // And does not mutate the caller's array.
    expect(input.map((b) => b.id)).toEqual(["z", "a"])
  })
})

describe("allocateFefo", () => {
  it("takes from the soonest-expiring batch first", () => {
    const res = allocateFefo([batch("late", "2027-01-01", 10), batch("soon", "2026-09-01", 10)], 6, TODAY)
    expect(res.allocations).toEqual([
      { batchId: "soon", batchNo: "B-soon", expiryDate: "2026-09-01", qty: 6 },
    ])
    expect(res.shortfall).toBe(0)
  })

  it("spans batches when one is not enough", () => {
    const res = allocateFefo([batch("soon", "2026-09-01", 4), batch("late", "2027-01-01", 10)], 6, TODAY)
    expect(res.allocations.map((a) => [a.batchId, a.qty])).toEqual([
      ["soon", 4],
      ["late", 2],
    ])
    expect(res.shortfall).toBe(0)
  })

  it("NEVER allocates expired stock, even when it would cover the order", () => {
    // The safety rule. 100 units sitting there are irrelevant if they expired.
    const res = allocateFefo([batch("dead", "2026-07-25", 100)], 5, TODAY)
    expect(res.allocations).toEqual([])
    expect(res.shortfall).toBe(5)
    expect(res.skippedExpired.map((b) => b.id)).toEqual(["dead"])
  })

  it("skips expired stock and fills from what is still good", () => {
    const res = allocateFefo(
      [batch("dead", "2026-01-01", 50), batch("good", "2026-09-01", 10)],
      6,
      TODAY,
    )
    expect(res.allocations.map((a) => a.batchId)).toEqual(["good"])
    expect(res.shortfall).toBe(0)
    expect(res.skippedExpired.map((b) => b.id)).toEqual(["dead"])
  })

  it("reports a shortfall instead of throwing", () => {
    const res = allocateFefo([batch("a", "2026-09-01", 3)], 10, TODAY)
    expect(res.allocations).toEqual([
      { batchId: "a", batchNo: "B-a", expiryDate: "2026-09-01", qty: 3 },
    ])
    expect(res.shortfall).toBe(7)
  })

  it("ignores batches with nothing left", () => {
    const res = allocateFefo([batch("empty", "2026-08-01", 0), batch("full", "2026-09-01", 5)], 5, TODAY)
    expect(res.allocations.map((a) => a.batchId)).toEqual(["full"])
  })

  it("allocates nothing for a zero or negative request", () => {
    expect(allocateFefo([batch("a", "2026-09-01", 5)], 0, TODAY).allocations).toEqual([])
    expect(allocateFefo([batch("a", "2026-09-01", 5)], -3, TODAY).allocations).toEqual([])
  })

  it("still reports expired batches when the request is already satisfied", () => {
    // The clinic should learn about dead stock regardless of this dispense.
    const res = allocateFefo([batch("good", "2026-09-01", 10), batch("dead", "2026-01-01", 5)], 2, TODAY)
    expect(res.shortfall).toBe(0)
    expect(res.skippedExpired.map((b) => b.id)).toEqual(["dead"])
  })

  it("dispenses undated stock only after dated stock", () => {
    const res = allocateFefo([batch("none", null, 10), batch("dated", "2026-09-01", 3)], 5, TODAY)
    expect(res.allocations.map((a) => [a.batchId, a.qty])).toEqual([
      ["dated", 3],
      ["none", 2],
    ])
  })
})

describe("expiryTier", () => {
  it("maps to the 90/60/30 alert bands", () => {
    expect(expiryTier("2026-07-25", TODAY)).toBe("expired")
    expect(expiryTier(TODAY, TODAY)).toBe("critical")
    expect(expiryTier("2026-08-25", TODAY)).toBe("critical") // 30 days
    expect(expiryTier("2026-08-26", TODAY)).toBe("warning") // 31
    expect(expiryTier("2026-09-24", TODAY)).toBe("warning") // 60
    expect(expiryTier("2026-09-25", TODAY)).toBe("watch") // 61
    expect(expiryTier("2026-10-24", TODAY)).toBe("watch") // 90
    expect(expiryTier("2026-10-25", TODAY)).toBe("ok") // 91
  })

  it("distinguishes undated stock from stock that is comfortably fine", () => {
    // "none" must not read as "checked and fine".
    expect(expiryTier(null, TODAY)).toBe("none")
    expect(expiryTier("2030-01-01", TODAY)).toBe("ok")
  })
})

describe("expiryLabel", () => {
  it("phrases the urgent cases and stays quiet on the rest", () => {
    expect(expiryLabel("2026-08-05", TODAY)).toBe("Expires in 10 days")
    expect(expiryLabel("2026-07-27", TODAY)).toBe("Expires in 1 day")
    expect(expiryLabel(TODAY, TODAY)).toBe("Expires in 0 days")
    expect(expiryLabel("2026-07-25", TODAY)).toBe("Expired 1 day ago")
    expect(expiryLabel("2030-01-01", TODAY)).toBeNull()
    expect(expiryLabel(null, TODAY)).toBeNull()
  })
})

describe("sellableQty", () => {
  it("excludes expired stock from what can be sold", () => {
    const batches = [batch("dead", "2026-01-01", 50), batch("good", "2026-09-01", 10), batch("none", null, 5)]
    expect(sellableQty(batches, TODAY)).toBe(15)
  })
})

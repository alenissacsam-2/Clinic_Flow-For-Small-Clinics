import { describe, it, expect } from "vitest"
import {
  outstandingAmount,
  isOutstanding,
  CLAIM_STATUSES,
  CLAIM_NEXT,
  CLAIM_STATUS_LABELS,
  CLAIM_STATUS_TONE,
  type ClaimStatus,
} from "@/lib/insurance"

const claim = (over: Partial<Parameters<typeof outstandingAmount>[0]> = {}) => ({
  status: "submitted",
  claimed_amount: 10000,
  approved_amount: null,
  settled_amount: null,
  ...over,
})

describe("isOutstanding", () => {
  it("counts everything except settled and rejected", () => {
    expect(isOutstanding("submitted")).toBe(true)
    expect(isOutstanding("queried")).toBe(true)
    expect(isOutstanding("approved")).toBe(true)
    expect(isOutstanding("settled")).toBe(false)
    expect(isOutstanding("rejected")).toBe(false)
  })
})

describe("outstandingAmount", () => {
  it("uses the claimed amount before anything is approved", () => {
    // Treating an un-approved claim as zero would flatter the total, which is
    // the opposite of what a clinic chasing payers needs.
    expect(outstandingAmount(claim())).toBe(10000)
  })

  it("switches to the approved amount once the payer has decided", () => {
    expect(outstandingAmount(claim({ status: "approved", approved_amount: 8000 }))).toBe(8000)
  })

  it("subtracts a part-settlement", () => {
    expect(
      outstandingAmount(claim({ status: "approved", approved_amount: 8000, settled_amount: 7600 })),
    ).toBe(400)
  })

  it("is zero once settled or rejected, whatever the amounts say", () => {
    expect(outstandingAmount(claim({ status: "settled", settled_amount: 7600 }))).toBe(0)
    expect(outstandingAmount(claim({ status: "rejected" }))).toBe(0)
  })

  it("never goes negative when a payer overpays", () => {
    expect(
      outstandingAmount(claim({ status: "approved", approved_amount: 8000, settled_amount: 9000 })),
    ).toBe(0)
  })

  it("handles amounts arriving as numeric strings from Postgres", () => {
    expect(
      outstandingAmount(claim({ claimed_amount: "10000.00", approved_amount: "8000.00" })),
    ).toBe(8000)
  })
})

describe("claim status vocabulary", () => {
  it("labels and tones every status", () => {
    for (const s of CLAIM_STATUSES) {
      expect(CLAIM_STATUS_LABELS[s], s).toBeTruthy()
      expect(CLAIM_STATUS_TONE[s], s).toBeTruthy()
    }
  })

  it("only ever offers transitions to real statuses", () => {
    const known = new Set<string>(CLAIM_STATUSES)
    for (const [from, tos] of Object.entries(CLAIM_NEXT)) {
      expect(known, from).toContain(from)
      for (const to of tos) expect(known, `${from} → ${to}`).toContain(to)
    }
  })

  it("lets a queried claim be resubmitted", () => {
    // The loop that makes TPA work painful, and the reason claim_events exists.
    expect(CLAIM_NEXT.queried).toContain("submitted")
    expect(CLAIM_NEXT.rejected).toContain("submitted")
  })

  it("gives every status somewhere to go", () => {
    for (const s of CLAIM_STATUSES) {
      expect(CLAIM_NEXT[s as ClaimStatus]?.length, s).toBeGreaterThan(0)
    }
  })
})

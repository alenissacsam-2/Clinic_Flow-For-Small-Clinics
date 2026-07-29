/**
 * Stock allocation and expiry — pure, no I/O, deterministic.
 *
 * ── FEFO, and the one safety rule ────────────────────────────────────
 * Dispensing is First-Expiry-First-Out: the batch that expires soonest goes
 * out first, so stock is used before it turns. **Expired batches are never
 * allocated**, no matter how much is left in them — that is a patient-safety
 * rule, not an inventory preference, and it is why `allocateFefo` needs to
 * know today's date.
 *
 * `today` is always passed in, never read from the clock, so every allocation
 * is reproducible and testable.
 */

export type StockBatch = {
  id: string
  batchNo: string
  /** ISO date, or null for stock that does not expire. */
  expiryDate: string | null
  qtyAvailable: number
}

export type Allocation = {
  batchId: string
  batchNo: string
  expiryDate: string | null
  qty: number
}

export type AllocationResult = {
  allocations: Allocation[]
  /** How much of the request could not be filled. 0 when fully satisfied. */
  shortfall: number
  /** Batches skipped because they had already expired. */
  skippedExpired: StockBatch[]
}

/** Whole days from `from` to `to`; negative when `to` is in the past. */
export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from.slice(0, 10)}T00:00:00Z`)
  const b = Date.parse(`${to.slice(0, 10)}T00:00:00Z`)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return NaN
  return Math.round((b - a) / 86_400_000)
}

/** True when the batch is expired as of `today`. Undated stock never expires. */
export function isExpired(batch: Pick<StockBatch, "expiryDate">, today: string): boolean {
  if (!batch.expiryDate) return false
  const days = daysBetween(today, batch.expiryDate)
  if (!Number.isFinite(days)) return false
  // A batch is good through its expiry date and dead the day after.
  return days < 0
}

/**
 * Order batches First-Expiry-First-Out.
 *
 * Undated stock sorts last: it never expires, so there is no urgency to move
 * it ahead of something that does. Ties break on batch number, purely so the
 * order is stable and two identical calls agree.
 */
export function sortFefo(batches: StockBatch[]): StockBatch[] {
  return [...batches].sort((a, b) => {
    if (a.expiryDate && b.expiryDate) {
      if (a.expiryDate !== b.expiryDate) return a.expiryDate < b.expiryDate ? -1 : 1
    } else if (a.expiryDate !== b.expiryDate) {
      return a.expiryDate ? -1 : 1
    }
    return a.batchNo.localeCompare(b.batchNo)
  })
}

/**
 * Allocate `qty` units across batches, FEFO, skipping expired stock.
 *
 * Returns a shortfall rather than throwing: the caller decides whether a
 * partial fill is acceptable, and the UI can say exactly how short it is.
 */
export function allocateFefo(batches: StockBatch[], qty: number, today: string): AllocationResult {
  const allocations: Allocation[] = []
  const skippedExpired: StockBatch[] = []
  let remaining = Math.max(0, Math.floor(qty))

  for (const batch of sortFefo(batches)) {
    if (batch.qtyAvailable <= 0) continue
    if (isExpired(batch, today)) {
      skippedExpired.push(batch)
      continue
    }
    if (remaining === 0) continue

    const take = Math.min(batch.qtyAvailable, remaining)
    allocations.push({
      batchId: batch.id,
      batchNo: batch.batchNo,
      expiryDate: batch.expiryDate,
      qty: take,
    })
    remaining -= take
  }

  return { allocations, shortfall: remaining, skippedExpired }
}

// ─── Expiry tiers ────────────────────────────────────────────────────

export type ExpiryTier = "expired" | "critical" | "warning" | "watch" | "ok" | "none"

/** Days-remaining boundaries for the 90/60/30 alert tiers. */
export const EXPIRY_TIERS: { tier: ExpiryTier; withinDays: number; label: string }[] = [
  { tier: "critical", withinDays: 30, label: "Expires within 30 days" },
  { tier: "warning", withinDays: 60, label: "Expires within 60 days" },
  { tier: "watch", withinDays: 90, label: "Expires within 90 days" },
]

/**
 * Which alert tier a batch falls into.
 *
 * `none` means undated stock — distinct from `ok`, which means dated and
 * comfortably far off. Collapsing the two would make "no expiry recorded"
 * look like "checked and fine".
 */
export function expiryTier(expiryDate: string | null, today: string): ExpiryTier {
  if (!expiryDate) return "none"
  const days = daysBetween(today, expiryDate)
  if (!Number.isFinite(days)) return "none"
  if (days < 0) return "expired"
  for (const t of EXPIRY_TIERS) {
    if (days <= t.withinDays) return t.tier
  }
  return "ok"
}

export function expiryLabel(expiryDate: string | null, today: string): string | null {
  const tier = expiryTier(expiryDate, today)
  if (tier === "none" || tier === "ok") return null
  if (tier === "expired") {
    const days = Math.abs(daysBetween(today, expiryDate!))
    return days === 0 ? "Expires today" : `Expired ${days} day${days === 1 ? "" : "s"} ago`
  }
  const days = daysBetween(today, expiryDate!)
  return `Expires in ${days} day${days === 1 ? "" : "s"}`
}

/** Total sellable units: on-hand minus anything already expired. */
export function sellableQty(batches: StockBatch[], today: string): number {
  return batches.reduce((sum, b) => (isExpired(b, today) ? sum : sum + Math.max(0, b.qtyAvailable)), 0)
}

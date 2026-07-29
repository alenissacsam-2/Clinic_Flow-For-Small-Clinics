import { istDateTimeToUtc, istWeekday, IST_TZ } from "@/lib/format"
import { formatInTimeZone } from "date-fns-tz"

export type SlotSession = {
  weekday: number
  start_time: string // "HH:mm" or "HH:mm:ss"
  end_time: string
}

export type OverrideRow = {
  date: string // yyyy-MM-dd
  closed: boolean
  start_time: string | null
  end_time: string | null
}

export type BlockRow = {
  start_time: string // "HH:mm" or "HH:mm:ss" (already filtered to this day by the caller)
  end_time: string
}

export type Slot = {
  startUtc: string // ISO instant
  endUtc: string
  label: string // "10:15 AM" in IST
  blocked?: boolean // only set when includeBlocked is true (calendar view)
}

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number)
  return h * 60 + m
}

function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

export type DaySlotParams = {
  dateKey: string // yyyy-MM-dd (IST)
  sessions: SlotSession[] // all availability rows for the clinic
  override?: OverrideRow | null
  slotMinutes: number
  leadMinutes: number
  now?: Date
  bookedStartsUtc?: Set<string> // ISO strings of taken slot starts
  blocks?: BlockRow[] // blocked windows for this day
  includeBlocked?: boolean // if true, keep blocked slots (flagged) instead of removing them
}

/** A slot [m, m+len) in minutes overlaps a block [bStart, bEnd). */
function overlapsBlock(m: number, slotMinutes: number, blocks: BlockRow[]): boolean {
  const end = m + slotMinutes
  return blocks.some((b) => m < toMinutes(b.end_time) && end > toMinutes(b.start_time))
}

/**
 * Open slots for a single IST calendar day. Pure — the caller supplies
 * availability, the day's override, and the set of already-booked starts.
 * Single source of truth for both the calendar and the booking page.
 */
export function generateDaySlots({
  dateKey,
  sessions,
  override,
  slotMinutes,
  leadMinutes,
  now = new Date(),
  bookedStartsUtc = new Set(),
  blocks = [],
  includeBlocked = false,
}: DaySlotParams): Slot[] {
  // 1. Effective working windows for the day
  let windows: { start: string; end: string }[]
  if (override) {
    if (override.closed) return []
    windows =
      override.start_time && override.end_time
        ? [{ start: override.start_time, end: override.end_time }]
        : sessions
            .filter((s) => s.weekday === istWeekday(dateKey))
            .map((s) => ({ start: s.start_time, end: s.end_time }))
  } else {
    const wd = istWeekday(dateKey)
    windows = sessions
      .filter((s) => s.weekday === wd)
      .map((s) => ({ start: s.start_time, end: s.end_time }))
  }

  // 2. Tile each window into slots
  const cutoff = now.getTime() + leadMinutes * 60_000
  const slots: Slot[] = []
  for (const w of windows) {
    const startM = toMinutes(w.start)
    const endM = toMinutes(w.end)
    for (let m = startM; m + slotMinutes <= endM; m += slotMinutes) {
      const startUtc = istDateTimeToUtc(dateKey, minutesToTime(m))
      // 3. Skip past slots (respecting lead time) and booked slots
      if (startUtc.getTime() < cutoff) continue
      if (bookedStartsUtc.has(startUtc.toISOString())) continue
      // 4. Blocked windows: remove for booking, or flag for the calendar view
      const blocked = overlapsBlock(m, slotMinutes, blocks)
      if (blocked && !includeBlocked) continue
      const endUtc = istDateTimeToUtc(dateKey, minutesToTime(m + slotMinutes))
      slots.push({
        startUtc: startUtc.toISOString(),
        endUtc: endUtc.toISOString(),
        label: formatInTimeZone(startUtc, IST_TZ, "hh:mm a"),
        ...(includeBlocked ? { blocked } : {}),
      })
    }
  }
  return slots
}

/** Convenience: the next N IST day-keys starting from a given day. */
export function nextDateKeys(fromDateKey: string, count: number): string[] {
  const keys: string[] = []
  const [y, mo, d] = fromDateKey.split("-").map(Number)
  const cursor = new Date(Date.UTC(y, mo - 1, d, 12)) // noon UTC avoids TZ drift
  for (let i = 0; i < count; i++) {
    keys.push(formatInTimeZone(cursor, IST_TZ, "yyyy-MM-dd"))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return keys
}

import { formatInTimeZone } from "date-fns-tz"
import { IST_TZ, istDateKey, istWeekday } from "@/lib/format"
import {
  generateDaySlots,
  nextDateKeys,
  type BlockRow,
  type OverrideRow,
  type SlotSession,
} from "@/lib/slots"

export const BOOKING_HORIZON_DAYS = 7

export type BookableSlot = {
  startUtc: string
  endUtc: string
  label: string
}

export type BookingDay = {
  dateKey: string
  weekdayLabel: string
  dateLabel: string
  /** The clinic does not work this weekday at all, or an override closed it. */
  closed: boolean
  slots: BookableSlot[]
}

type BuildInput = {
  availability?: SlotSession[] | null
  overrides?: OverrideRow[] | null
  blocks?: (BlockRow & { date: string })[] | null
  booked?: string[] | null
  slotMinutes?: number | null
  leadMinutes?: number | null
  /** Injectable for tests; defaults to the real clock. */
  now?: Date
}

/**
 * The clinic's effective working windows for a day, ignoring bookings, blocks
 * and lead time.
 *
 * This exists so the day strip can tell a patient *why* a day has no slots.
 * "Closed" and "fully booked" look identical if you only count free slots, and
 * they are completely different messages: one means come another day, the
 * other means try calling. `generateDaySlots` deliberately collapses both to
 * an empty array, so the distinction is recovered here instead of complicating
 * the slot generator that the calendar also depends on.
 */
function worksThisDay(
  dateKey: string,
  sessions: SlotSession[],
  override: OverrideRow | null | undefined,
): boolean {
  if (override) {
    if (override.closed) return false
    if (override.start_time && override.end_time) return true
  }
  return sessions.some((s) => s.weekday === istWeekday(dateKey))
}

/**
 * Turn a raw booking context into the day-by-day slot grid the widget renders.
 *
 * Lives here rather than inline in the page because the widget re-fetches it:
 * slots go stale while a patient is deciding, and the refresh path has to
 * produce byte-identical shapes to the server render or the selected slot
 * silently changes meaning between the two.
 */
export function buildBookingDays(input: BuildInput): BookingDay[] {
  const sessions = input.availability ?? []
  const slotMinutes = input.slotMinutes ?? 15
  const leadMinutes = input.leadMinutes ?? 30
  const now = input.now ?? new Date()

  const bookedSet = new Set((input.booked ?? []).map((b) => new Date(b).toISOString()))
  const overridesByDate = new Map((input.overrides ?? []).map((o) => [o.date, o]))
  const blocksByDate = new Map<string, BlockRow[]>()
  for (const b of input.blocks ?? []) {
    const list = blocksByDate.get(b.date) ?? []
    list.push({ start_time: b.start_time, end_time: b.end_time })
    blocksByDate.set(b.date, list)
  }

  return nextDateKeys(istDateKey(now), BOOKING_HORIZON_DAYS).map((dateKey) => {
    const override = overridesByDate.get(dateKey) ?? null
    const slots = generateDaySlots({
      dateKey,
      sessions,
      override,
      slotMinutes,
      leadMinutes,
      now,
      bookedStartsUtc: bookedSet,
      blocks: blocksByDate.get(dateKey) ?? [],
    }).map((s) => ({ startUtc: s.startUtc, endUtc: s.endUtc, label: s.label }))

    return {
      dateKey,
      weekdayLabel: formatInTimeZone(`${dateKey}T12:00:00Z`, IST_TZ, "EEE"),
      dateLabel: formatInTimeZone(`${dateKey}T12:00:00Z`, IST_TZ, "d MMM"),
      closed: !worksThisDay(dateKey, sessions, override),
      slots,
    }
  })
}

/* ── Grouping slots into parts of the day ─────────────────────────────────── */

export type PartOfDay = "morning" | "afternoon" | "evening"

export const PART_LABELS: Record<PartOfDay, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
}

/**
 * A 15-minute clinic running 9–1 and 5–9 offers 32 slots. Rendered as one flat
 * grid that is a wall of near-identical numbers, and a patient scanning for
 * "something after work" has to read all of it. Splitting on the two boundaries
 * people already think in — lunch and the end of the working day — turns the
 * scan into a jump.
 */
export function partOfDay(startUtc: string): PartOfDay {
  const hour = Number(formatInTimeZone(startUtc, IST_TZ, "H"))
  if (hour < 12) return "morning"
  if (hour < 16) return "afternoon"
  return "evening"
}

export type SlotGroup = { part: PartOfDay; label: string; slots: BookableSlot[] }

/** Slots split into parts of the day, empty parts dropped, order preserved. */
export function groupSlots(slots: BookableSlot[]): SlotGroup[] {
  const order: PartOfDay[] = ["morning", "afternoon", "evening"]
  const buckets = new Map<PartOfDay, BookableSlot[]>()
  for (const s of slots) {
    const part = partOfDay(s.startUtc)
    const list = buckets.get(part) ?? []
    list.push(s)
    buckets.set(part, list)
  }
  return order
    .filter((p) => (buckets.get(p)?.length ?? 0) > 0)
    .map((p) => ({ part: p, label: PART_LABELS[p], slots: buckets.get(p)! }))
}

/** Today / Tomorrow / weekday — days arrive earliest-first. */
export function relativeDay(index: number, weekday: string): string {
  if (index === 0) return "Today"
  if (index === 1) return "Tomorrow"
  return weekday
}

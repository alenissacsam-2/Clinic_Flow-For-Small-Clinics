import { formatInTimeZone, toZonedTime, fromZonedTime } from "date-fns-tz"

export const IST_TZ = "Asia/Kolkata"

// ─── Money ──────────────────────────────────────────────────────
const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
})
export function formatINR(amount: number | string): string {
  return inr.format(typeof amount === "string" ? Number(amount) : amount)
}

// ─── Dates & times (always render in IST) ───────────────────────
export function formatISTDate(iso: string | Date): string {
  return formatInTimeZone(iso, IST_TZ, "dd MMM yyyy")
}
export function formatISTTime(iso: string | Date): string {
  return formatInTimeZone(iso, IST_TZ, "hh:mm a")
}
export function formatISTDateTime(iso: string | Date): string {
  return formatInTimeZone(iso, IST_TZ, "dd MMM yyyy, hh:mm a")
}
export function formatISTWeekday(iso: string | Date): string {
  return formatInTimeZone(iso, IST_TZ, "EEE")
}

/** The IST calendar date (yyyy-MM-dd) for an instant. */
export function istDateKey(iso: string | Date = new Date()): string {
  return formatInTimeZone(iso, IST_TZ, "yyyy-MM-dd")
}

/** IST weekday index for a yyyy-MM-dd date (0 = Sunday, matches DB). */
export function istWeekday(dateKey: string): number {
  return toZonedTime(`${dateKey}T12:00:00Z`, IST_TZ).getDay()
}

/**
 * UTC instant boundaries [start, end) covering a full IST calendar day.
 * e.g. "2026-07-23" → 2026-07-22T18:30:00Z .. 2026-07-23T18:30:00Z
 */
export function istDayRangeUtc(dateKey: string): { start: Date; end: Date } {
  const start = fromZonedTime(`${dateKey}T00:00:00`, IST_TZ)
  const end = fromZonedTime(`${dateKey}T00:00:00`, IST_TZ)
  end.setUTCDate(end.getUTCDate() + 1)
  return { start, end }
}

/** Combine an IST date (yyyy-MM-dd) and time (HH:mm[:ss]) into a UTC instant. */
export function istDateTimeToUtc(dateKey: string, time: string): Date {
  const t = time.length === 5 ? `${time}:00` : time
  return fromZonedTime(`${dateKey}T${t}`, IST_TZ)
}

// ─── Phone (E.164, India-first) ─────────────────────────────────
export class PhoneError extends Error {}

/**
 * Normalize an Indian mobile number to E.164 (+91XXXXXXXXXX).
 * Accepts spaces, dashes, leading 0, +91, or bare 10 digits.
 */
export function normalizePhone(input: string): string {
  const digits = input.replace(/[^\d+]/g, "")
  let d = digits.replace(/^\+/, "")
  if (d.startsWith("91") && d.length === 12) d = d.slice(2)
  else if (d.startsWith("0") && d.length === 11) d = d.slice(1)
  if (d.length !== 10 || !/^[6-9]\d{9}$/.test(d)) {
    throw new PhoneError("Enter a valid 10-digit Indian mobile number")
  }
  return `+91${d}`
}

/** True if the input is a valid Indian mobile number. */
export function isValidPhone(input: string): boolean {
  try {
    normalizePhone(input)
    return true
  } catch {
    return false
  }
}

/** E.164 → WhatsApp "to" format (digits only, no +). */
export function toWhatsAppNumber(e164: string): string {
  return e164.replace(/^\+/, "")
}

/** Pretty display: +91 98765 43210 */
export function formatPhoneDisplay(e164: string): string {
  const d = e164.replace(/^\+91/, "")
  return d.length === 10 ? `+91 ${d.slice(0, 5)} ${d.slice(5)}` : e164
}

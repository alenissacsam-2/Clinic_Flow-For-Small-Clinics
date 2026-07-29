/**
 * Calendar export for a confirmed booking.
 *
 * A patient who books at 11pm from a WhatsApp link has no clinic app to remind
 * them; the WhatsApp reminder helps, but the appointment only becomes *real*
 * when it is sitting in the calendar they already check. This produces both
 * routes to that: an `.ics` file (iOS, Outlook, anything native) and a Google
 * Calendar template URL (most Android users, one tap, no download).
 *
 * Times go out as UTC instants with a `Z` suffix rather than an IST-local time
 * plus a VTIMEZONE block. A booking is a fixed moment, every calendar client
 * understands `Z`, and shipping a hand-written VTIMEZONE is a well-known way
 * to be an hour off twice a year.
 */

const CRLF = "\r\n"

/** ICS escaping: backslash, semicolon, comma and newline are all significant. */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n")
}

/** 2026-07-28T09:15:00.000Z → 20260728T091500Z */
export function toIcsStamp(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")
}

/**
 * Fold lines to the 75-octet limit RFC 5545 sets. Ignoring this is why long
 * clinic addresses land in some clients as a truncated line and a stray one.
 */
function fold(line: string): string {
  if (line.length <= 74) return line
  const parts: string[] = [line.slice(0, 74)]
  let rest = line.slice(74)
  while (rest.length > 73) {
    parts.push(" " + rest.slice(0, 73))
    rest = rest.slice(73)
  }
  if (rest) parts.push(" " + rest)
  return parts.join(CRLF)
}

export type CalendarEvent = {
  title: string
  description?: string
  location?: string
  startUtc: string
  endUtc: string
  /** Stable per booking. Callers pass the appointment identity, not a random. */
  uid: string
  /** Injectable so the output is deterministic under test. */
  stampUtc?: string
}

export function buildIcs(event: CalendarEvent): string {
  const stamp = toIcsStamp(event.stampUtc ?? event.startUtc)
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ClinicFlow//Booking//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${toIcsStamp(event.startUtc)}`,
    `DTEND:${toIcsStamp(event.endUtc)}`,
    `SUMMARY:${escapeText(event.title)}`,
    ...(event.description ? [`DESCRIPTION:${escapeText(event.description)}`] : []),
    ...(event.location ? [`LOCATION:${escapeText(event.location)}`] : []),
    "STATUS:CONFIRMED",
    // One reminder, an hour out. Enough to leave for the clinic; not so early
    // that it is noise the patient dismisses and then forgets.
    "BEGIN:VALARM",
    "TRIGGER:-PT60M",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeText(event.title)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
  return lines.map(fold).join(CRLF) + CRLF
}

/** A `data:` URL suitable for a download link — no server round-trip needed. */
export function icsDataUrl(event: CalendarEvent): string {
  return "data:text/calendar;charset=utf-8," + encodeURIComponent(buildIcs(event))
}

/** Google Calendar's event-template URL, for one-tap add on Android. */
export function googleCalendarUrl(event: CalendarEvent): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${toIcsStamp(event.startUtc)}/${toIcsStamp(event.endUtc)}`,
  })
  if (event.description) params.set("details", event.description)
  if (event.location) params.set("location", event.location)
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

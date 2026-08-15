import { formatInTimeZone } from "date-fns-tz"

import { IST_TZ } from "@/lib/format"

/**
 * Every word the bot says, in one file.
 *
 * Kept out of `machine.ts` so the conversation can be read and corrected
 * without reading the state machine.
 *
 * ── English only, deliberately ────────────────────────────────────────────
 * `ClinicSettings.template_lang` selects English or Hindi for the *outbound
 * templates* (confirmations, reminders, receipts) and is untouched by this.
 * The bot does not branch on it. A clinic set to Hindi therefore sends Hindi
 * reminders but converses in English — a real inconsistency, and the thing to
 * revisit first if this is ever localised. Doing it properly is more than
 * translating these strings: `PART_LABELS` and `relativeDay` in
 * `booking-days.ts` are English-only too, so a half-translation would leave
 * "Morning" and "Tomorrow" sitting inside otherwise-Hindi menus.
 *
 * These are free-form session messages, not templates. They need no Meta
 * approval, which is the whole reason the bot can only ever *reply* — see the
 * note on the 24-hour window in `machine.ts`.
 */

/* ── Time formatting ────────────────────────────────────────────────────── */

/** "10:30 AM" */
export const timeLabel = (startUtc: string) => formatInTimeZone(startUtc, IST_TZ, "h:mm a")

/** "Tue, 16 Aug" */
export const dateLabel = (startUtc: string) => formatInTimeZone(startUtc, IST_TZ, "EEE, d MMM")

/* ── Openers and menus ──────────────────────────────────────────────────── */

export const greeting = (clinic: string) =>
  `Welcome to ${clinic}. I can book you an appointment right here.`

export const pickDay = "Which day suits you?"
export const pickDayButton = "Choose a day"
export const pickSlot = (day: string) => `Times available on ${day}. Which one works?`
export const pickSlotButton = "Choose a time"
export const morePrompt = "More times"
export const backToDays = "Another day"

export const slotsOpen = (n: number) => (n === 1 ? "1 time open" : `${n} times open`)

/* ── Name ───────────────────────────────────────────────────────────────── */

export const askName = "And what name should I book this under?"
export const nameTooShort = "Please send the patient's full name."

/* ── Confirmation ───────────────────────────────────────────────────────── */

export const confirmPrompt = (name: string, doctor: string, date: string, time: string) =>
  `Please check:\n\n*${name}*\n${doctor}\n${date} at ${time}\n\nShall I book it?`

export const confirmYes = "Yes, book it"
export const confirmChange = "Change time"

export const tokenSuffix = (n: number) => ` Your token number is ${n}.`

export const bookedInstant = (date: string, time: string, token: string) =>
  `Booked. ${date} at ${time}.${token}\n\nPlease arrive a few minutes early. Reply CANCEL if you cannot make it.`

export const bookedPending = (date: string, time: string) =>
  `Requested: ${date} at ${time}. The clinic will confirm shortly — I will message you as soon as they do.`

export const slotTaken = "Sorry — that time was just taken. Here are the times still open."

export const bookFailed =
  "Something went wrong at our end and the booking did not go through. Please try again in a moment."

/* ── Status and cancellation ────────────────────────────────────────────── */

export const statusUpcoming = (date: string, time: string, token: string) =>
  `Your next appointment is on ${date} at ${time}.${token}`

export const noUpcoming = "You have no upcoming appointment. Reply BOOK to make one."

export const cancelConfirm = (date: string, time: string) =>
  `Cancel your appointment on ${date} at ${time}?`

export const cancelYes = "Yes, cancel"
export const keepIt = "Keep it"

export const cancelled =
  "Your appointment is cancelled. Reply BOOK any time to make a new one."

export const cancelFailed = "I could not cancel that just now. Please call the clinic."
export const keptIt = "No change — your appointment stands."

/* ── Opt-out ────────────────────────────────────────────────────────────── */

export const optedOut =
  "You will not receive any more WhatsApp messages from us. Reply START to turn them back on."

/* ── Dead ends ──────────────────────────────────────────────────────────── */

export const bookingDisabled = (clinic: string) =>
  `${clinic} is not taking online bookings at the moment. Please call the clinic.`

export const noSlots =
  "There are no free slots in the next week. Please call the clinic and they will fit you in."

export const dayNowFull = "That day just filled up. Please pick another."

export const notUnderstood =
  "Sorry, I did not follow that. Reply BOOK to book an appointment, STATUS to see your next one, or CANCEL to cancel it."

export const unsupportedMedia =
  "I can only read text here. Please use the buttons, or reply BOOK to start."

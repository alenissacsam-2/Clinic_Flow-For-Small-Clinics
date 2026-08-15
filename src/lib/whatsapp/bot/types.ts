import type { BookingDay } from "@/lib/booking-days"

/**
 * Types for the booking bot's conversation.
 *
 * Deliberately free of `server-only`, Supabase and the Meta client: the reducer
 * in `machine.ts` is a pure function over these, so the entire booking
 * conversation can be unit-tested without a network, a database, or an approved
 * WhatsApp template. The caller (the webhook) is the only thing that does I/O.
 *
 * `ClinicSettings` is not imported from `@/lib/clinic` on purpose — that module
 * is `server-only`, and pulling it in here would make the reducer unloadable in
 * a plain Node test environment for the sake of two fields.
 */

export type Lang = "en" | "hi"

/* ── What arrives from the patient ──────────────────────────────────────── */

/**
 * A normalised inbound message. Meta's payload distinguishes button replies
 * from list replies; the bot does not care which control the patient touched,
 * only which id came back, so both collapse to `reply`.
 */
export type Inbound =
  | { type: "text"; body: string }
  | { type: "reply"; id: string }
  /** Voice notes, images, locations, stickers — anything the bot cannot read. */
  | { type: "unsupported" }

/* ── What the bot sends back ────────────────────────────────────────────── */

export type ReplyButton = { id: string; title: string }
export type ListRow = { id: string; title: string; description?: string }
export type ListSection = { title: string; rows: ListRow[] }

export type Outbound =
  | { type: "text"; body: string }
  | { type: "buttons"; body: string; buttons: ReplyButton[] }
  | { type: "list"; body: string; button: string; sections: ListSection[] }

/* ── Conversation state ─────────────────────────────────────────────────── */

export type BotState =
  | "idle"
  | "awaiting_day"
  | "awaiting_slot"
  | "awaiting_name"
  | "awaiting_confirm"
  | "awaiting_cancel_confirm"

/**
 * Everything the bot remembers between messages. Persisted per phone number by
 * the caller; small and JSON-serialisable so it can live in one `jsonb` column.
 */
export type Session = {
  state: BotState
  clinicId: string | null
  /** Draft booking, built up across turns. */
  dateKey?: string
  startUtc?: string
  name?: string
  /** Which page of a long slot list the patient is on. */
  slotPage?: number
}

export const INITIAL_SESSION: Session = { state: "idle", clinicId: null }

/* ── What the caller must load before invoking the reducer ──────────────── */

export type BotClinic = {
  id: string
  name: string
  doctorName: string | null
  bookingEnabled: boolean
  bookingMode: "instant" | "approve"
  lang: Lang
}

export type BotContext = {
  clinic: BotClinic
  /** The full horizon from `buildBookingDays`, earliest first, including closed days. */
  days: BookingDay[]
  /** Set when this phone is already a patient of this clinic. */
  patient: { id: string; fullName: string } | null
  /** The patient's next confirmed or pending appointment, if any. */
  upcoming: { id: string; startsAt: string; tokenNumber: number | null } | null
  now: Date
}

/* ── Events in, effects out ─────────────────────────────────────────────── */

/**
 * The reducer is pure, so it cannot book anything itself. It returns an
 * `Action` describing what the caller should do; the caller performs it and
 * feeds the outcome back in as another event. That keeps every branch —
 * including "the slot was taken while they were typing their name" —
 * reachable from a test with no database involved.
 */
export type Action =
  | { type: "book"; startUtc: string; name: string }
  | { type: "cancel"; appointmentId: string }
  | { type: "opt_out" }
  | { type: "opt_in" }

export type BotEvent =
  | { kind: "message"; message: Inbound }
  | { kind: "booked"; tokenNumber: number | null; startUtc: string; pending: boolean }
  | { kind: "book_failed"; reason: "slot_taken" | "error" }
  | { kind: "cancelled"; ok: boolean }

export type BotResult = {
  replies: Outbound[]
  session: Session
  action?: Action
}

/* ── Meta's interactive-message limits ──────────────────────────────────── */

/**
 * These are hard limits in the Cloud API, not style guidance. Exceeding any of
 * them gets the message rejected at send time with an opaque `#131009`, which
 * surfaces as the bot going silent mid-conversation — so the builders in
 * `machine.ts` clamp against them and `assertSendable` re-checks in tests.
 */
export const WA_LIMITS = {
  /** Rows across *all* sections of one list, not per section. */
  listRows: 10,
  listSections: 10,
  rowTitle: 24,
  rowDescription: 72,
  sectionTitle: 24,
  buttons: 3,
  buttonTitle: 20,
  listButton: 20,
  body: 1024,
} as const

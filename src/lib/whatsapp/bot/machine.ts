import { groupSlots, relativeDay, type BookingDay } from "@/lib/booking-days"

import * as C from "./copy"
import {
  INITIAL_SESSION,
  WA_LIMITS,
  type Action,
  type BotContext,
  type BotEvent,
  type BotResult,
  type Inbound,
  type ListRow,
  type ListSection,
  type Outbound,
  type Session,
} from "./types"

/**
 * The booking conversation, as a pure function.
 *
 * `reduce(session, event, ctx)` returns the replies to send, the session to
 * persist, and at most one `Action` for the caller to perform. It never touches
 * the network or the database, so every branch — including the ones that only
 * happen under a race, like a slot being taken while the patient types their
 * name — is reachable from a unit test.
 *
 * ── Why there is no natural-language understanding ────────────────────────
 * Booking runs on interactive lists and buttons, where every reply carries an
 * id this file authored. That is not a shortcut, it is the more correct design
 * for this audience: it cannot mis-parse a time, it is immune to typos, voice
 * notes and autocorrect, and it costs no model call. The only free text the bot
 * ever accepts is the patient's name, which is the one field where any string
 * is a legitimate answer. It is also what would make localising this cheap —
 * only the strings in `copy.ts` are language-bound, never the control flow.
 *
 * ── Why the bot can only ever reply ───────────────────────────────────────
 * Meta permits free-form messages only inside 24 hours of the patient's last
 * inbound message. Everything here is a response to something the patient just
 * sent, so it always falls inside that window and needs no approved template.
 * Anything that *starts* a conversation is a template and does not belong in
 * this file.
 */

/* ── Reply ids ──────────────────────────────────────────────────────────── */

const ID = {
  day: (dateKey: string) => `day:${dateKey}`,
  slot: (startUtc: string) => `slot:${startUtc}`,
  more: "more",
  days: "days",
  confirm: "confirm",
  cancelYes: "cancel_yes",
  cancelNo: "cancel_no",
} as const

/** Slots shown per page. Leaves room for "More times" and "Another day". */
const SLOT_PAGE = 8

/* ── Builders that respect Meta's limits ────────────────────────────────── */

const clamp = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, n - 1)}…`)

const text = (body: string): Outbound => ({ type: "text", body: clamp(body, WA_LIMITS.body) })

const buttons = (body: string, bs: { id: string; title: string }[]): Outbound => ({
  type: "buttons",
  body: clamp(body, WA_LIMITS.body),
  buttons: bs.slice(0, WA_LIMITS.buttons).map((b) => ({
    id: b.id,
    title: clamp(b.title, WA_LIMITS.buttonTitle),
  })),
})

/**
 * Meta caps a list at ten rows across *all* sections, not per section, and
 * silently rejects the whole message if that is exceeded. Trimming here means
 * the failure mode is a slightly shorter list rather than a bot that goes
 * quiet mid-conversation.
 */
const list = (body: string, button: string, sections: ListSection[]): Outbound => {
  const out: ListSection[] = []
  let budget = WA_LIMITS.listRows
  for (const s of sections.slice(0, WA_LIMITS.listSections)) {
    if (budget <= 0) break
    const rows = s.rows.slice(0, budget).map((r) => ({
      id: r.id,
      title: clamp(r.title, WA_LIMITS.rowTitle),
      ...(r.description ? { description: clamp(r.description, WA_LIMITS.rowDescription) } : {}),
    }))
    if (rows.length === 0) continue
    budget -= rows.length
    out.push({ title: clamp(s.title, WA_LIMITS.sectionTitle), rows })
  }
  return {
    type: "list",
    body: clamp(body, WA_LIMITS.body),
    button: clamp(button, WA_LIMITS.listButton),
    sections: out,
  }
}

/* ── Small helpers over the booking grid ────────────────────────────────── */

const openDays = (days: BookingDay[]) => days.filter((d) => !d.closed && d.slots.length > 0)

const findDay = (ctx: BotContext, dateKey: string) =>
  ctx.days.find((d) => d.dateKey === dateKey) ?? null

/** Position in the full horizon, which always starts at today — so 0 is today. */
const dayOffset = (ctx: BotContext, dateKey: string) =>
  ctx.days.findIndex((d) => d.dateKey === dateKey)

const dayTitle = (ctx: BotContext, day: BookingDay) => {
  const rel = relativeDay(dayOffset(ctx, day.dateKey), day.weekdayLabel)
  return `${rel}, ${day.dateLabel}`
}

const doctorLine = (ctx: BotContext) =>
  ctx.clinic.doctorName ? `${ctx.clinic.doctorName}, ${ctx.clinic.name}` : ctx.clinic.name

const tokenText = (ctx: BotContext, token: number | null) =>
  token == null ? "" : C.tokenSuffix(token)

/* ── Screens ────────────────────────────────────────────────────────────── */

/** The day picker, or a dead end if the clinic has nothing to offer. */
function showDays(ctx: BotContext, session: Session, lead?: string): BotResult {
  if (!ctx.clinic.bookingEnabled) {
    return {
      replies: [text(C.bookingDisabled(ctx.clinic.name))],
      session: { ...INITIAL_SESSION, clinicId: ctx.clinic.id },
    }
  }

  const open = openDays(ctx.days)
  if (open.length === 0) {
    return {
      replies: [text(C.noSlots)],
      session: { ...INITIAL_SESSION, clinicId: ctx.clinic.id },
    }
  }

  const rows: ListRow[] = open.map((d) => ({
    id: ID.day(d.dateKey),
    title: dayTitle(ctx, d),
    description: C.slotsOpen(d.slots.length),
  }))

  const body = [lead, C.pickDay].filter(Boolean).join("\n\n")
  return {
    replies: [list(body, C.pickDayButton, [{ title: C.pickDayButton, rows }])],
    session: { state: "awaiting_day", clinicId: ctx.clinic.id },
  }
}

/** One page of times for a chosen day. */
function showSlots(ctx: BotContext, dateKey: string, page: number, lead?: string): BotResult {
  const day = findDay(ctx, dateKey)

  // The grid is re-read on every turn, so a day that was open when it was
  // offered can be empty by the time it is chosen.
  if (!day || day.slots.length === 0) {
    return showDays(ctx, INITIAL_SESSION, C.dayNowFull)
  }

  const start = page * SLOT_PAGE
  const slice = day.slots.slice(start, start + SLOT_PAGE)
  if (slice.length === 0) return showSlots(ctx, dateKey, 0, C.dayNowFull)

  const hasMore = day.slots.length > start + SLOT_PAGE

  const sections: ListSection[] = groupSlots(slice).map((g) => ({
    title: g.label,
    rows: g.slots.map((s) => ({ id: ID.slot(s.startUtc), title: s.label })),
  }))

  const nav: ListRow[] = []
  if (hasMore) nav.push({ id: ID.more, title: C.morePrompt })
  nav.push({ id: ID.days, title: C.backToDays })
  sections.push({ title: C.pickSlotButton, rows: nav })

  const body = [lead, C.pickSlot(dayTitle(ctx, day))].filter(Boolean).join("\n\n")
  return {
    replies: [list(body, C.pickSlotButton, sections)],
    session: { state: "awaiting_slot", clinicId: ctx.clinic.id, dateKey, slotPage: page },
  }
}

/**
 * A returning patient is never asked their name again — the clinic already has
 * it, and asking implies they are a stranger to a practice they have used.
 */
function afterSlot(ctx: BotContext, session: Session, startUtc: string): BotResult {
  const known = ctx.patient?.fullName?.trim()
  const next: Session = { ...session, state: "awaiting_name", startUtc }

  if (known && known.length >= 2) return showConfirm(ctx, { ...next, name: known })
  return { replies: [text(C.askName)], session: next }
}

function showConfirm(ctx: BotContext, session: Session): BotResult {
  const startUtc = session.startUtc!
  return {
    replies: [
      buttons(
        C.confirmPrompt(
          session.name ?? "",
          doctorLine(ctx),
          C.dateLabel(startUtc),
          C.timeLabel(startUtc),
        ),
        [
          { id: ID.confirm, title: C.confirmYes },
          { id: ID.days, title: C.confirmChange },
        ],
      ),
    ],
    session: { ...session, state: "awaiting_confirm" },
  }
}

function showStatus(ctx: BotContext, session: Session): BotResult {
  if (!ctx.upcoming) return { replies: [text(C.noUpcoming)], session }
  const { startsAt, tokenNumber } = ctx.upcoming
  return {
    replies: [
      text(
        C.statusUpcoming(
          C.dateLabel(startsAt),
          C.timeLabel(startsAt),
          tokenText(ctx, tokenNumber),
        ),
      ),
    ],
    session,
  }
}

function askCancel(ctx: BotContext, session: Session): BotResult {
  if (!ctx.upcoming) return { replies: [text(C.noUpcoming)], session }
  return {
    replies: [
      buttons(C.cancelConfirm(C.dateLabel(ctx.upcoming.startsAt), C.timeLabel(ctx.upcoming.startsAt)), [
        { id: ID.cancelYes, title: C.cancelYes },
        { id: ID.cancelNo, title: C.keepIt },
      ]),
    ],
    session: { ...session, state: "awaiting_cancel_confirm" },
  }
}

/* ── Global commands ────────────────────────────────────────────────────── */

type Command = "book" | "cancel" | "status" | "stop" | "start"

/**
 * Recognised in any state, because a patient halfway through picking a time who
 * types STOP means it, and burying an opt-out behind a flow they have to finish
 * first is both hostile and, for a health service messaging on WhatsApp, wrong.
 */
function commandOf(body: string): Command | null {
  const t = body.trim().toLowerCase()
  if (/^(stop|unsubscribe|band karo)$/.test(t)) return "stop"
  if (/^(start|resume)$/.test(t)) return "start"
  if (/^(cancel|rad+ karo)$/.test(t)) return "cancel"
  if (/^(status|my appointment)$/.test(t)) return "status"
  if (/^(book|hi|hello|hey|menu|namaste|appointment)$/.test(t)) return "book"
  return null
}

/* ── The reducer ────────────────────────────────────────────────────────── */

export function reduce(session: Session, event: BotEvent, ctx: BotContext): BotResult {
  switch (event.kind) {
    /* Outcomes of an action the caller performed for us. */
    case "booked": {
      const body = event.pending
        ? C.bookedPending(C.dateLabel(event.startUtc), C.timeLabel(event.startUtc))
        : C.bookedInstant(
            C.dateLabel(event.startUtc),
            C.timeLabel(event.startUtc),
            tokenText(ctx, event.tokenNumber),
          )
      return { replies: [text(body)], session: { ...INITIAL_SESSION, clinicId: ctx.clinic.id } }
    }

    case "book_failed": {
      // A taken slot is not an error the patient caused, so it re-offers the
      // same day rather than dumping them back at the start.
      if (event.reason === "slot_taken" && session.dateKey) {
        return showSlots(ctx, session.dateKey, 0, C.slotTaken)
      }
      return {
        replies: [text(C.bookFailed)],
        session: { ...INITIAL_SESSION, clinicId: ctx.clinic.id },
      }
    }

    case "cancelled":
      return {
        replies: [text(event.ok ? C.cancelled : C.cancelFailed)],
        session: { ...INITIAL_SESSION, clinicId: ctx.clinic.id },
      }

    case "message":
      return onMessage(session, event.message, ctx)
  }
}

function onMessage(session: Session, msg: Inbound, ctx: BotContext): BotResult {
  if (msg.type === "unsupported") {
    return { replies: [text(C.unsupportedMedia)], session }
  }

  /* Commands first — they outrank whatever screen the patient is on. */
  if (msg.type === "text") {
    const cmd = commandOf(msg.body)
    if (cmd === "stop") {
      return {
        replies: [text(C.optedOut)],
        session: { ...INITIAL_SESSION, clinicId: ctx.clinic.id },
        action: { type: "opt_out" },
      }
    }
    if (cmd === "start") {
      const next = showDays(ctx, session, C.greeting(ctx.clinic.name))
      return { ...next, action: { type: "opt_in" } }
    }
    if (cmd === "cancel") return askCancel(ctx, session)
    if (cmd === "status") return showStatus(ctx, session)
    if (cmd === "book") return showDays(ctx, session, C.greeting(ctx.clinic.name))
  }

  const reply = msg.type === "reply" ? msg.id : null

  /* Navigation that is valid from any list screen. */
  if (reply === ID.days) return showDays(ctx, session)
  if (reply === ID.more && session.dateKey) {
    return showSlots(ctx, session.dateKey, (session.slotPage ?? 0) + 1)
  }

  switch (session.state) {
    case "awaiting_day": {
      if (reply?.startsWith("day:")) return showSlots(ctx, reply.slice(4), 0)
      break
    }

    case "awaiting_slot": {
      if (reply?.startsWith("slot:")) {
        const startUtc = reply.slice(5)
        const day = session.dateKey ? findDay(ctx, session.dateKey) : null
        // Re-validate against the freshly read grid: the id came from a list
        // this bot sent, but that list may be minutes old.
        if (!day || !day.slots.some((s) => s.startUtc === startUtc)) {
          return session.dateKey
            ? showSlots(ctx, session.dateKey, 0, C.slotTaken)
            : showDays(ctx, session, C.slotTaken)
        }
        return afterSlot(ctx, session, startUtc)
      }
      break
    }

    case "awaiting_name": {
      if (msg.type === "text") {
        const name = msg.body.trim().replace(/\s+/g, " ")
        if (name.length < 2) return { replies: [text(C.nameTooShort)], session }
        return showConfirm(ctx, { ...session, name: name.slice(0, 80) })
      }
      break
    }

    case "awaiting_confirm": {
      if (reply === ID.confirm && session.startUtc && session.name) {
        const action: Action = { type: "book", startUtc: session.startUtc, name: session.name }
        return { replies: [], session, action }
      }
      break
    }

    case "awaiting_cancel_confirm": {
      if (reply === ID.cancelNo) {
        return {
          replies: [text(C.keptIt)],
          session: { ...INITIAL_SESSION, clinicId: ctx.clinic.id },
        }
      }
      if (reply === ID.cancelYes && ctx.upcoming) {
        return {
          replies: [],
          session,
          action: { type: "cancel", appointmentId: ctx.upcoming.id },
        }
      }
      break
    }

    case "idle":
      break
  }

  return { replies: [text(C.notUnderstood)], session }
}

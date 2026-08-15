import { INITIAL_SESSION, type BotState, type Session } from "./types"

/**
 * Turning a `wa_sessions` row into a `Session` and back.
 *
 * Split out of `store.ts` because that module is `server-only` and this is the
 * part with the interesting decisions in it — expiry, validation, and what
 * happens when a stored row does not match the code that reads it. Keeping it
 * pure means those are unit-testable without a database.
 */

/**
 * How long a half-finished booking survives.
 *
 * Long enough to answer the door or serve a patient and come back; short enough
 * that a slot list from an hour ago is never presented as current. The grid is
 * re-read on every turn regardless, so this bounds staleness of the *draft*,
 * not of the times shown.
 */
export const SESSION_TTL_MS = 30 * 60_000

const STATES: readonly BotState[] = [
  "idle",
  "awaiting_day",
  "awaiting_slot",
  "awaiting_name",
  "awaiting_confirm",
  "awaiting_cancel_confirm",
]

/**
 * A stored state that this build does not recognise is treated as `idle`.
 *
 * Rows outlive deploys. Removing or renaming a state while conversations are in
 * flight would otherwise leave patients pinned in a state nothing handles,
 * which presents as a bot that has stopped replying. Falling back to `idle`
 * costs them one "reply BOOK to start" and cannot wedge.
 */
function stateOf(raw: unknown): BotState {
  return STATES.includes(raw as BotState) ? (raw as BotState) : "idle"
}

const str = (v: unknown): string | undefined => (typeof v === "string" && v ? v : undefined)

export type SessionRow = {
  clinic_id: string | null
  state: string
  context: unknown
  expires_at: string
}

/** A stored row as a `Session`, or a fresh one if it has lapsed. */
export function sessionFromRow(row: SessionRow | null, now: Date): Session {
  if (!row) return { ...INITIAL_SESSION }
  if (new Date(row.expires_at).getTime() <= now.getTime()) {
    // Expired rows are not deleted on read — the cron sweeps them. Keeping the
    // clinic means a patient who wanders back an hour later is still talking to
    // the practice they started with, rather than being asked which one again.
    return { ...INITIAL_SESSION, clinicId: row.clinic_id }
  }

  const c = (row.context ?? {}) as Record<string, unknown>
  const slotPage = typeof c.slotPage === "number" && c.slotPage >= 0 ? c.slotPage : undefined

  return {
    state: stateOf(row.state),
    clinicId: row.clinic_id,
    ...(str(c.dateKey) ? { dateKey: str(c.dateKey) } : {}),
    ...(str(c.startUtc) ? { startUtc: str(c.startUtc) } : {}),
    ...(str(c.name) ? { name: str(c.name) } : {}),
    ...(slotPage !== undefined ? { slotPage } : {}),
  }
}

export type SessionInsert = {
  phone: string
  clinic_id: string | null
  state: string
  context: Record<string, unknown>
  expires_at: string
  updated_at: string
}

/**
 * The draft goes to `context` rather than to columns: its shape belongs to the
 * state machine, and giving each field a column would mean a migration every
 * time the conversation gains a step.
 */
export function sessionToRow(phone: string, session: Session, now: Date): SessionInsert {
  const context: Record<string, unknown> = {}
  if (session.dateKey) context.dateKey = session.dateKey
  if (session.startUtc) context.startUtc = session.startUtc
  if (session.name) context.name = session.name
  if (typeof session.slotPage === "number") context.slotPage = session.slotPage

  return {
    phone,
    clinic_id: session.clinicId,
    state: session.state,
    context,
    expires_at: new Date(now.getTime() + SESSION_TTL_MS).toISOString(),
    updated_at: now.toISOString(),
  }
}

/* ── Clinic deep links ──────────────────────────────────────────────────── */

/**
 * Pull a clinic slug out of a deep-link message.
 *
 * The platform's Meta number is shared by every clinic on it, so the first
 * message has to say who the patient is trying to reach. `wa.me/<number>?text=
 * BOOK%20<slug>` prefills exactly that, and the patient sends it without typing
 * anything — which is why the slug is only accepted *with* the `BOOK` prefix. A
 * bare word is not treated as a clinic code: patients say "hello" and "doctor"
 * and one of those will eventually collide with somebody's slug, and silently
 * routing a patient to the wrong practice is much worse than asking.
 */
export function parseClinicCode(text: string): string | null {
  const m = /^\s*book\s+([a-z0-9][a-z0-9-]{1,60})\s*$/i.exec(text)
  return m ? m[1].toLowerCase() : null
}

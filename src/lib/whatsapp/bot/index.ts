/**
 * Server-side entry point for the booking bot.
 *
 * ⚠️ This barrel re-exports `store` and `routing`, which are `server-only`.
 * Importing it from a client component, or from a plain Node context, throws.
 *
 * `machine`, `codec` and `types` are deliberately pure and carry no such
 * marker — that is what makes the whole conversation unit-testable without a
 * database. Import those from their modules directly rather than through here,
 * as `tests/unit/wa-bot.test.ts` and `tests/unit/wa-session.test.ts` do, or the
 * server-only guard will drag the database layer into the test.
 */
export { reduce } from "./machine"
export { SESSION_TTL_MS, parseClinicCode, sessionFromRow, sessionToRow } from "./codec"
export { clearSession, loadSession, purgeExpiredSessions, saveSession } from "./store"
export { resolveClinic, type ClinicResolution } from "./routing"
export {
  INITIAL_SESSION,
  WA_LIMITS,
  type Action,
  type BotClinic,
  type BotContext,
  type BotEvent,
  type BotResult,
  type BotState,
  type Inbound,
  type ListRow,
  type ListSection,
  type Outbound,
  type ReplyButton,
  type Session,
} from "./types"

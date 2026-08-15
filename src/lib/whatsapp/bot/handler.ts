import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"

import { buildBookingDays } from "@/lib/booking-days"
import type { BookingContext } from "@/lib/booking-context"
import type { Database } from "@/types/database"
import { WA_ERROR, sendSessionMessage } from "../client"
import { reduce } from "./machine"
import { resolveClinic } from "./routing"
import { clearSession, loadSession, saveSession } from "./store"
import type { Action, BotClinic, BotContext, BotEvent, Inbound, Outbound } from "./types"

type DB = SupabaseClient<Database>

/**
 * The one impure function in the bot: everything the reducer cannot do.
 *
 * Order matters and is the whole substance of this file — deduplicate, resolve
 * the tenant, load state, read the world, reduce, act, reply, persist.
 */

/* ── Copy that belongs to routing rather than to the conversation ────────── */

const NOT_RECOGNISED =
  "I could not tell which clinic you are trying to reach. Please open the booking link your clinic sent you, and I will take it from there."

const AMBIGUOUS =
  "You are registered with more than one clinic on this number, so I cannot tell which one you mean. Please open the booking link for the clinic you want."

/**
 * Record the inbound message, and say whether it is new.
 *
 * Insert-first rather than select-then-insert: Meta redelivers on any response
 * that is not a prompt 2xx, and two deliveries can land on two concurrent
 * serverless invocations. A `select` would see nothing in both, and both would
 * proceed to book. The unique index from migration 0034 makes the database the
 * arbiter, and a unique violation is simply "someone else already has this".
 */
async function claimInbound(
  admin: DB,
  args: { clinicId: string; patientId: string | null; phone: string; waMessageId: string; body: string },
): Promise<boolean> {
  const { error } = await admin.from("wa_messages").insert({
    clinic_id: args.clinicId,
    patient_id: args.patientId,
    to_phone: args.phone,
    direction: "in",
    body: args.body,
    status: "delivered",
    wa_message_id: args.waMessageId,
  })
  // 23505 = unique_violation. Anything else (a dropped connection, say) is not
  // evidence of a duplicate, so the message is allowed through rather than
  // silently swallowed.
  if (error) return error.code !== "23505"
  return true
}

/** Log a bot reply so the doctor sees the whole conversation in the timeline. */
async function sendAndLog(
  admin: DB,
  args: { clinicId: string; patientId: string | null; phone: string; reply: Outbound },
): Promise<void> {
  const result = await sendSessionMessage(args.phone.replace(/^\+/, ""), args.reply)

  // The 24-hour window closing is not a fault to chase — it means the patient
  // stopped replying and the conversation lapsed. Say so plainly in the log so
  // it is not mistaken for a broken integration.
  if (result.code === WA_ERROR.outsideWindow) {
    console.warn("[wa-bot] 24h session window closed for", args.phone, "— reply not delivered")
  }

  await admin.from("wa_messages").insert({
    clinic_id: args.clinicId,
    patient_id: args.patientId,
    to_phone: args.phone,
    direction: "out",
    body: "body" in args.reply ? args.reply.body : null,
    status: result.id ? "sent" : "failed",
    wa_message_id: result.id ?? null,
    error: result.code ? `${result.code}: ${result.error}` : (result.error ?? null),
    sent_at: result.id ? new Date().toISOString() : null,
  })
}

/** Everything the reducer needs to know about the world right now. */
async function loadContext(admin: DB, clinic: BotClinic, phone: string, now: Date): Promise<BotContext> {
  const { data: ctxRow } = await admin.rpc("get_booking_context", { p_slug: clinic.slug })
  const bc = (ctxRow as unknown as BookingContext | null) ?? null

  const days = bc?.found
    ? buildBookingDays({
        availability: bc.availability,
        overrides: bc.overrides,
        blocks: bc.blocks,
        booked: bc.booked,
        slotMinutes: bc.clinic?.settings?.slot_minutes,
        leadMinutes: bc.clinic?.settings?.lead_time_minutes,
        now,
      })
    : []

  const { data: patient } = await admin
    .from("patients")
    .select("id, full_name")
    .eq("clinic_id", clinic.id)
    .eq("phone", phone)
    .is("deleted_at", null)
    .maybeSingle()

  const { data: upcoming } = patient
    ? await admin
        .from("appointments")
        .select("id, starts_at, token_number")
        .eq("clinic_id", clinic.id)
        .eq("patient_id", patient.id)
        .in("status", ["pending", "confirmed"])
        .gte("starts_at", now.toISOString())
        .order("starts_at", { ascending: true })
        .limit(1)
        .maybeSingle()
    : { data: null }

  return {
    clinic,
    days,
    patient: patient ? { id: patient.id, fullName: patient.full_name } : null,
    upcoming: upcoming
      ? { id: upcoming.id, startsAt: upcoming.starts_at, tokenNumber: upcoming.token_number }
      : null,
    now,
  }
}

/**
 * Carry out what the reducer asked for, and turn the outcome back into an event.
 * Returns null for actions that produce no follow-up message of their own.
 */
async function perform(
  admin: DB,
  action: Action,
  ctx: BotContext,
  phone: string,
): Promise<BotEvent | null> {
  switch (action.type) {
    case "book": {
      const { data, error } = await admin.rpc("create_whatsapp_booking", {
        p_clinic_id: ctx.clinic.id,
        p_phone: phone,
        p_name: action.name,
        p_starts_at: action.startUtc,
        p_reason: null,
      })
      const res = data as {
        ok?: boolean
        error?: string
        token_number?: number | null
        starts_at?: string
        pending?: boolean
      } | null

      if (error || !res?.ok) {
        return { kind: "book_failed", reason: res?.error === "slot_taken" ? "slot_taken" : "error" }
      }
      return {
        kind: "booked",
        tokenNumber: res.token_number ?? null,
        startUtc: res.starts_at ?? action.startUtc,
        pending: res.pending === true,
      }
    }

    case "cancel": {
      const { error } = await admin
        .from("appointments")
        .update({ status: "cancelled" })
        .eq("id", action.appointmentId)
        .eq("clinic_id", ctx.clinic.id)
      return { kind: "cancelled", ok: !error }
    }

    case "opt_out":
    case "opt_in": {
      if (ctx.patient) {
        await admin
          .from("patients")
          .update({ whatsapp_opt_in: action.type === "opt_in" })
          .eq("id", ctx.patient.id)
      }
      // The reducer already said what it needed to say about this.
      return null
    }
  }
}

/**
 * Throughput one person could plausibly produce by tapping buttons, with room
 * to spare. A patient working through the booking flow sends perhaps six
 * messages in a minute; anything past this is a stuck client or someone leaning
 * on the send key.
 */
const RATE_WINDOW_SECONDS = 60
const RATE_LIMIT = 20

export type HandleInput = {
  /** E.164, as normalised by the webhook. */
  phone: string
  waMessageId: string
  message: Inbound
  now?: Date
}

/** Drive one inbound message all the way through. */
export async function handleBotMessage(admin: DB, input: HandleInput): Promise<void> {
  const now = input.now ?? new Date()
  const text = input.message.type === "text" ? input.message.body : null

  // Throttle before doing any work, and before spending a Cloud API send.
  //
  // Dropped silently on purpose: telling a flooder they are being throttled is
  // itself an outbound message, so it would bill for exactly the traffic this
  // suppresses and hand them an amplifier. A real person who somehow trips it
  // simply taps again a moment later.
  const { data: allowed } = await admin.rpc("wa_rate_allow", {
    p_phone: input.phone,
    p_window_seconds: RATE_WINDOW_SECONDS,
    p_limit: RATE_LIMIT,
  })
  if (allowed === false) {
    console.warn("[wa-bot] rate limited", input.phone)
    return
  }

  const session = await loadSession(admin, input.phone, now)
  const routed = await resolveClinic(admin, { phone: input.phone, text, session })

  // A message we cannot attribute to a clinic gets one honest sentence and
  // nothing else. It is deliberately not deduplicated: `wa_messages.clinic_id`
  // is NOT NULL, so there is nowhere to record it, and a Meta retry sending
  // this line twice is a far smaller problem than guessing at a tenant.
  if (routed.kind !== "clinic") {
    const body = routed.kind === "ambiguous" ? AMBIGUOUS : NOT_RECOGNISED
    await sendSessionMessage(input.phone.replace(/^\+/, ""), { type: "text", body })
    return
  }

  const clinic = routed.clinic
  const ctx = await loadContext(admin, clinic, input.phone, now)

  const fresh = await claimInbound(admin, {
    clinicId: clinic.id,
    patientId: ctx.patient?.id ?? null,
    phone: input.phone,
    waMessageId: input.waMessageId,
    body: text ?? `(${input.message.type})`,
  })
  if (!fresh) return

  // The deep-link code has done its job (identify the clinic) and the raw text
  // "BOOK <slug>" means nothing to the reducer's command matching — without
  // this, a new patient's very first message gets "I did not follow that"
  // instead of the day picker. See the note on `consumedCode` in routing.ts.
  const message: Inbound =
    routed.consumedCode && input.message.type === "text" ? { type: "text", body: "book" } : input.message

  const replies: Outbound[] = []
  let result = reduce(session, { kind: "message", message }, ctx)
  replies.push(...result.replies)

  if (result.action) {
    const followUp = await perform(admin, result.action, ctx, input.phone)
    if (followUp) {
      // Re-read the patient: a booking may have just created one, and the
      // confirmation should be filed against them rather than against nobody.
      const after = await loadContext(admin, clinic, input.phone, now)
      result = reduce(result.session, followUp, after)
      replies.push(...result.replies)
    }
  }

  const patientId =
    (await admin
      .from("patients")
      .select("id")
      .eq("clinic_id", clinic.id)
      .eq("phone", input.phone)
      .is("deleted_at", null)
      .maybeSingle()).data?.id ?? null

  for (const reply of replies) {
    await sendAndLog(admin, { clinicId: clinic.id, patientId, phone: input.phone, reply })
  }

  if (result.session.state === "idle") await clearSession(admin, input.phone, clinic.id)
  else await saveSession(admin, input.phone, result.session, now)
}

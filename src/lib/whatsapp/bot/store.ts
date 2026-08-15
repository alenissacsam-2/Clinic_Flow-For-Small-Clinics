import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database, Json } from "@/types/database"
import { sessionFromRow, sessionToRow, type SessionRow } from "./codec"
import { INITIAL_SESSION, type Session } from "./types"

type DB = SupabaseClient<Database>

/**
 * Where a conversation lives between messages.
 *
 * Every function here takes the admin client: `wa_sessions` has RLS on with no
 * policies, so the service role is the only thing that can reach it. That is
 * deliberate — a half-finished booking is a name and a phone number attached to
 * a clinic, and nothing in a browser has any business reading it.
 */

/** The patient's conversation, or a fresh one if they have none or it lapsed. */
export async function loadSession(admin: DB, phone: string, now = new Date()): Promise<Session> {
  const { data } = await admin
    .from("wa_sessions")
    .select("clinic_id, state, context, expires_at")
    .eq("phone", phone)
    .maybeSingle()

  return sessionFromRow((data as SessionRow | null) ?? null, now)
}

/**
 * Persist the conversation, extending its life by the TTL.
 *
 * Upsert on `phone`, which is the primary key — one number is one conversation,
 * enforced by the schema rather than by remembering to check. Every save is
 * also a heartbeat: a patient who is still replying never has their draft
 * expire under them.
 */
export async function saveSession(
  admin: DB,
  phone: string,
  session: Session,
  now = new Date(),
): Promise<void> {
  const row = sessionToRow(phone, session, now)
  await admin.from("wa_sessions").upsert(
    {
      phone: row.phone,
      clinic_id: row.clinic_id,
      state: row.state,
      context: row.context as Json,
      expires_at: row.expires_at,
      updated_at: row.updated_at,
    },
    { onConflict: "phone" },
  )
}

/**
 * Drop the draft but keep the clinic.
 *
 * Used when a conversation ends cleanly — booked, cancelled, opted out. The
 * clinic is retained so the patient's next "hi" goes to the practice they
 * already used instead of asking them to identify it again.
 */
export async function clearSession(admin: DB, phone: string, clinicId: string | null): Promise<void> {
  await saveSession(admin, phone, { ...INITIAL_SESSION, clinicId })
}

/**
 * Sweep lapsed conversations. Called from the reminders cron alongside the
 * other retention jobs — abandoned drafts are patient data with no further
 * purpose, and DPDP says data kept past its purpose should not be kept.
 */
export async function purgeExpiredSessions(admin: DB, now = new Date()): Promise<void> {
  await admin.from("wa_sessions").delete().lt("expires_at", now.toISOString())
}

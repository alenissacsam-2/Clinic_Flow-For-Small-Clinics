import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/types/database"
import { parseClinicCode } from "./codec"
import type { BotClinic, Session } from "./types"

type DB = SupabaseClient<Database>

/**
 * Which clinic is this message for?
 *
 * The hard problem of running a booking bot on a SaaS platform: one Meta phone
 * number serves every clinic, so an inbound message carries no tenant. Getting
 * this wrong is not a cosmetic bug — it books a patient into a stranger's
 * practice, and the existing `handleInbound` already has the milder form of it,
 * looping over *every* patient row matching a phone across *every* clinic.
 *
 * Four sources, most explicit first. The bot asks rather than guesses whenever
 * the answer is not singular.
 */

export type ClinicResolution =
  | {
      kind: "clinic"
      clinic: BotClinic
      /**
       * True when this resolution consumed a `BOOK <slug>` code out of the
       * message text. The caller should treat the message as a bare "start
       * booking" from here on — `machine.ts`'s command matching is intentionally
       * strict (`^book$`, not a prefix match, so words like "bookish" or
       * "booking issue" are not misread as a command), so the raw text
       * "BOOK sunrise-clinic" would otherwise reach the reducer unrecognised and
       * be told "I did not follow that" on the very first message a new patient
       * ever sends.
       */
      consumedCode: boolean
    }
  /** The phone belongs to patients at several clinics and the message said nothing. */
  | { kind: "ambiguous"; options: { id: string; name: string }[] }
  /** Nobody we can identify — no code, no session, no patient record. */
  | { kind: "unknown" }

type ClinicRow = {
  id: string
  slug: string
  name: string
  doctor_name: string | null
  suspended_at: string | null
  settings: unknown
}

const SELECT = "id, slug, name, doctor_name, suspended_at, settings"

function toBotClinic(row: ClinicRow): BotClinic {
  const s = (row.settings ?? {}) as Record<string, unknown>
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    doctorName: row.doctor_name,
    // A suspended clinic is closed for business, exactly as it is in the
    // booking RPCs and on the public page. Folding suspension into this flag
    // means the state machine never has to know suspension exists.
    bookingEnabled: row.suspended_at == null && (s.booking_enabled ?? true) !== false,
    bookingMode: s.booking_mode === "approve" ? "approve" : "instant",
  }
}

export async function resolveClinic(
  admin: DB,
  input: { phone: string; text: string | null; session: Session },
): Promise<ClinicResolution> {
  /* 1. An explicit code in the message. The deep link puts it there, and it
        outranks everything else — a patient who scans a second clinic's QR is
        telling us plainly that they want the second clinic. */
  const code = input.text ? parseClinicCode(input.text) : null
  if (code) {
    const { data } = await admin.from("clinics").select(SELECT).eq("slug", code).maybeSingle()
    if (data) return { kind: "clinic", clinic: toBotClinic(data as ClinicRow), consumedCode: true }
    // A code that matches nothing falls through rather than dead-ending: the
    // patient may simply be a returning patient who typed something odd.
  }

  /* 2. The conversation already in progress. */
  if (input.session.clinicId) {
    const { data } = await admin
      .from("clinics")
      .select(SELECT)
      .eq("id", input.session.clinicId)
      .maybeSingle()
    if (data) return { kind: "clinic", clinic: toBotClinic(data as ClinicRow), consumedCode: false }
  }

  /* 3. The phone is on file. One match is an answer; several is a question. */
  const { data: patients } = await admin
    .from("patients")
    .select("clinic_id")
    .eq("phone", input.phone)
    .is("deleted_at", null)

  const clinicIds = [...new Set((patients ?? []).map((p) => p.clinic_id))]
  if (clinicIds.length === 1) {
    const { data } = await admin.from("clinics").select(SELECT).eq("id", clinicIds[0]).maybeSingle()
    if (data) return { kind: "clinic", clinic: toBotClinic(data as ClinicRow), consumedCode: false }
  }
  if (clinicIds.length > 1) {
    const { data } = await admin.from("clinics").select("id, name").in("id", clinicIds)
    const options = (data ?? []).map((c) => ({ id: c.id, name: c.name }))
    if (options.length > 1) return { kind: "ambiguous", options }
    if (options.length === 1) {
      const { data: one } = await admin.from("clinics").select(SELECT).eq("id", options[0].id).maybeSingle()
      if (one) return { kind: "clinic", clinic: toBotClinic(one as ClinicRow), consumedCode: false }
    }
  }

  /* 4. A stranger messaging the platform number directly. */
  return { kind: "unknown" }
}

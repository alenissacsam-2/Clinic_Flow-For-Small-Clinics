import { NextResponse, type NextRequest } from "next/server"
import { serverEnv, hasServiceRole } from "@/lib/env"
import { createAdminClient } from "@/lib/supabase/admin"
import { clinicSettings, type Clinic } from "@/lib/clinic"
import { istDateKey } from "@/lib/format"
import { notifyApptReminder, notifyFollowupDue } from "@/lib/whatsapp/triggers"
import { sendQueuedMessage } from "@/lib/whatsapp/enqueue"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type PatientLite = { id: string; full_name: string; phone: string }

/**
 * Runs every ~15 min (Vercel Cron). Sends due reminders and follow-ups,
 * retries failed messages, and marks stale appointments as no-shows.
 * Protected by CRON_SECRET.
 */
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization")
  if (auth !== `Bearer ${serverEnv.cronSecret}`) {
    return new NextResponse("Unauthorized", { status: 401 })
  }
  if (!hasServiceRole()) {
    return NextResponse.json({ skipped: "service role not configured" })
  }

  const admin = createAdminClient()
  const now = new Date()
  const counters = { reminders: 0, followups: 0, retries: 0, noShows: 0 }

  // A paused clinic sends nothing. This runs on the service role, which bypasses
  // RLS and every suspension check in the RPCs, so without the filter an
  // operator could suspend a clinic for non-payment or abuse and it would carry
  // on sending WhatsApp reminders on the platform's account — billed to us,
  // signed with the clinic's name.
  const { data: clinics } = await admin.from("clinics").select("*").is("suspended_at", null)
  for (const clinic of (clinics ?? []) as Clinic[]) {
    const settings = clinicSettings(clinic)

    // 1. Reminders per configured offset
    for (const h of settings.reminder_offsets_hours) {
      const winStart = new Date(now.getTime() + h * 3600_000)
      const winEnd = new Date(winStart.getTime() + 15 * 60_000)
      const { data: appts } = await admin
        .from("appointments")
        .select("id, starts_at, reminders_sent, patient:patients(id, full_name, phone)")
        .eq("clinic_id", clinic.id)
        .eq("status", "confirmed")
        .gte("starts_at", winStart.toISOString())
        .lt("starts_at", winEnd.toISOString())

      for (const a of (appts ?? []) as unknown as {
        id: string
        starts_at: string
        reminders_sent: number[]
        patient: PatientLite | null
      }[]) {
        if (!a.patient || (a.reminders_sent ?? []).includes(h)) continue
        await notifyApptReminder(admin, clinic, { id: a.id, starts_at: a.starts_at, patient: a.patient }, h)
        await admin
          .from("appointments")
          .update({ reminders_sent: [...(a.reminders_sent ?? []), h] })
          .eq("id", a.id)
        counters.reminders++
      }
    }

    // 2. Follow-ups due tomorrow (IST)
    const tomorrow = new Date(now.getTime() + 24 * 3600_000)
    const tomorrowKey = istDateKey(tomorrow)
    const { data: visits } = await admin
      .from("visits")
      .select("id, followup_date, patient:patients(id, full_name, phone)")
      .eq("clinic_id", clinic.id)
      .eq("followup_date", tomorrowKey)
      .is("followup_notified_at", null)

    for (const v of (visits ?? []) as unknown as {
      id: string
      followup_date: string
      patient: PatientLite | null
    }[]) {
      if (!v.patient) continue
      await notifyFollowupDue(admin, clinic, {
        patient: v.patient,
        followupDate: v.followup_date,
        visitId: v.id,
      })
      await admin.from("visits").update({ followup_notified_at: now.toISOString() }).eq("id", v.id)
      counters.followups++
    }

    // 4. No-show: appointments long past their end time that were never
    //    marked as attended.
    //
    //    Only `confirmed` qualifies. An appointment sitting at `arrived` or
    //    `in_progress` is positive evidence the patient walked in — the clinic
    //    checked them in. Auto-labelling those a no-show records an attendance
    //    fact that is simply untrue, and it feeds the reports the doctor uses
    //    to judge which slots patients actually keep. A stale `arrived` row is
    //    an unclosed consultation for the doctor to tidy, not a missed one.
    const cutoff = new Date(now.getTime() - 3 * 3600_000)
    const { data: stale } = await admin
      .from("appointments")
      .select("id")
      .eq("clinic_id", clinic.id)
      .eq("status", "confirmed")
      .lt("ends_at", cutoff.toISOString())
    for (const s of stale ?? []) {
      await admin.from("appointments").update({ status: "no_show" }).eq("id", s.id)
      counters.noShows++
    }
  }

  // 3. Retry failed messages (across all clinics)
  const { data: retryRows } = await admin
    .from("wa_messages")
    .select("id")
    .eq("status", "failed")
    .lt("attempts", 3)
    .limit(100)
  for (const r of retryRows ?? []) {
    await sendQueuedMessage(admin, r.id)
    counters.retries++
  }

  // 5. DPDP: purge patients soft-deleted more than 30 days ago.
  const purgeCutoff = new Date(now.getTime() - 30 * 24 * 3600_000).toISOString()
  await admin.from("patients").delete().not("deleted_at", "is", null).lt("deleted_at", purgeCutoff)

  // 6. Purge spent/expired booking OTPs (older than 24h).
  const otpCutoff = new Date(now.getTime() - 24 * 3600_000).toISOString()
  await admin.from("booking_otps").delete().lt("created_at", otpCutoff)

  return NextResponse.json({ ok: true, ...counters })
}

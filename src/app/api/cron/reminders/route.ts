import { NextResponse, type NextRequest } from "next/server"
import crypto from "node:crypto"
import { hasServiceRole } from "@/lib/env"
import { createAdminClient } from "@/lib/supabase/admin"
import { clinicSettings, type Clinic } from "@/lib/clinic"
import { istDateKey } from "@/lib/format"
import { notifyApptReminder, notifyFollowupDue } from "@/lib/whatsapp/triggers"
import { sendQueuedMessage } from "@/lib/whatsapp/enqueue"
import { purgeExpiredSessions } from "@/lib/whatsapp/bot/store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type PatientLite = { id: string; full_name: string; phone: string }

/**
 * Sends due reminders and follow-ups, retries failed messages, and marks stale
 * appointments as no-shows. Protected by CRON_SECRET.
 *
 * ── This must not assume how often it runs ────────────────────────────────
 * It used to. Reminders were found by asking for appointments starting inside a
 * fixed **15-minute window** at each offset, which is only correct if the cron
 * fires every 15 minutes — the schedule `vercel.json` originally carried.
 *
 * Vercel's Hobby plan rejects sub-daily cron schedules at deploy time, so that
 * schedule cannot ship on Hobby and was changed to once a day. Nothing failed
 * loudly: the endpoint still returned `{ok: true}`, still sent follow-ups, still
 * closed out no-shows. It just silently stopped sending nearly every reminder,
 * because a once-a-day run only ever inspects one 15-minute slice of each day
 * and every appointment outside that slice is invisible. A daily run catches
 * roughly 1% of them.
 *
 * So the window is gone. Each run now sweeps everything whose moment has
 * arrived and that has not been sent yet, which is correct at *any* cadence —
 * every 15 minutes, hourly, or once a day. `reminders_sent` was already the
 * idempotency record and does the same job here; the unique index
 * `wa_reminder_uniq` backs it at the database.
 *
 * Cadence still decides *quality*: a daily run cannot deliver a 2-hour reminder
 * near its mark. To get the intended timing, point an external scheduler at
 * this endpoint every 15 minutes with the same bearer token — see README.
 */
export async function GET(request: NextRequest) {
  // Read directly rather than through `serverEnv.cronSecret`, which throws on a
  // missing value. An uncaught throw here is a 500 with a stack trace, which
  // Vercel's scheduler treats as a failing job and retries — noisy, and it
  // reads like a broken endpoint rather than an unconfigured one. A missing
  // secret is a deployment that is not finished, so say that and fail closed.
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error("[cron] CRON_SECRET is not set — refusing to run. Set it in the Vercel project's environment variables; the scheduler sends it as a bearer token.")
    return new NextResponse("Cron is not configured", { status: 503 })
  }

  const auth = request.headers.get("authorization") ?? ""
  const expected = `Bearer ${secret}`
  const a = Buffer.from(auth)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
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

    // 1. Reminders per configured offset, largest first.
    const offsets = [...settings.reminder_offsets_hours].sort((a, b) => b - a)
    if (offsets.length > 0) {
      const horizon = new Date(now.getTime() + offsets[0] * 3600_000)
      const { data: appts } = await admin
        .from("appointments")
        .select("id, starts_at, reminders_sent, patient:patients(id, full_name, phone)")
        .eq("clinic_id", clinic.id)
        .eq("status", "confirmed")
        .gte("starts_at", now.toISOString())
        .lt("starts_at", horizon.toISOString())

      for (const a of (appts ?? []) as unknown as {
        id: string
        starts_at: string
        reminders_sent: number[]
        patient: PatientLite | null
      }[]) {
        if (!a.patient) continue
        const sent = a.reminders_sent ?? []
        const hoursAway = (new Date(a.starts_at).getTime() - now.getTime()) / 3600_000

        // Every offset whose moment has arrived and that has not gone out yet.
        const due = offsets.filter((h) => hoursAway <= h && !sent.includes(h))
        if (due.length === 0) continue

        // Send only the most urgent of them. A patient who books two hours
        // before their slot has technically "passed" the 24-hour mark too, and
        // firing both would put two messages on their phone at once, one of
        // them claiming a day's notice it cannot give. The coarser offsets are
        // recorded as handled without being sent — their moment is gone, and
        // leaving them unmarked would re-send this every single run.
        const soonest = due[due.length - 1]
        await notifyApptReminder(
          admin,
          clinic,
          { id: a.id, starts_at: a.starts_at, patient: a.patient },
          soonest,
        )
        await admin
          .from("appointments")
          .update({ reminders_sent: [...sent, ...due] })
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

  // 7. Purge lapsed WhatsApp conversations. An abandoned half-finished booking
  //    is a name and a phone number with no remaining purpose, which is exactly
  //    the sort of thing DPDP says not to keep.
  await purgeExpiredSessions(admin, now)

  return NextResponse.json({ ok: true, ...counters })
}

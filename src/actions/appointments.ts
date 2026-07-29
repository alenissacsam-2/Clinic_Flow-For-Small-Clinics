"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireClinic, clinicSettings, type Clinic } from "@/lib/clinic"
import { ownsRef, FOREIGN_REF_ERROR } from "@/lib/ownership"
import { hasServiceRole } from "@/lib/env"
import { istDateKey } from "@/lib/format"
import { notifyApptConfirmed, notifyApptCancelled } from "@/lib/whatsapp/triggers"
import { createIntakeRequest } from "@/lib/intake"
import type { Enums } from "@/types/database"

/** Best-effort intake request for a confirmed appointment (needs the service role). */
async function tryCreateIntake(clinic: Clinic, appointmentId: string): Promise<void> {
  if (!hasServiceRole()) return
  try {
    await createIntakeRequest(createAdminClient(), clinic, appointmentId)
  } catch {
    // Non-fatal: the appointment stands regardless of the intake link.
  }
}

type Result = { error?: string; ok?: boolean; appointmentId?: string }

async function tokenFor(clinicId: string, dayKey: string): Promise<number | null> {
  const supabase = await createClient()
  const { data } = await supabase.rpc("next_token_number", {
    p_clinic: clinicId,
    p_day: dayKey,
  })
  return typeof data === "number" ? data : null
}

/** Book an existing patient into a specific slot (from the calendar). */
export async function createAppointment(input: {
  patientId: string
  startsAt: string // ISO
  reason?: string
  source?: Enums<"appointment_source">
}): Promise<Result> {
  const clinic = await requireClinic()
  const settings = clinicSettings(clinic)
  const start = new Date(input.startsAt)
  const end = new Date(start.getTime() + settings.slot_minutes * 60_000)
  const dayKey = istDateKey(start)

  const supabase = await createClient()
  // The patient id comes from the client. `tenant_all` only validates the
  // clinic_id on the row being written, so a forged id books an appointment in
  // our clinic against another clinic's patient — a slot we can see and they
  // cannot. See src/lib/ownership.ts.
  if (!(await ownsRef(supabase, clinic.id, "patients", input.patientId))) {
    return { error: FOREIGN_REF_ERROR }
  }

  const { data, error } = await supabase
    .from("appointments")
    .insert({
      clinic_id: clinic.id,
      patient_id: input.patientId,
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      status: "confirmed",
      source: input.source ?? "staff",
      reason: input.reason || null,
      token_number: await tokenFor(clinic.id, dayKey),
    })
    .select("id")
    .single()

  if (error) {
    // Unique partial index → slot already taken.
    if (error.code === "23505") return { error: "That slot is already booked." }
    return { error: error.message }
  }
  revalidatePath("/calendar")
  revalidatePath("/today")
  await notifyApptConfirmed(supabase, clinic, data.id)
  await tryCreateIntake(clinic, data.id)
  return { ok: true, appointmentId: data.id }
}

/** Quick walk-in: drop a patient into today's queue with the next token. */
export async function addWalkIn(patientId: string): Promise<Result> {
  const clinic = await requireClinic()
  const settings = clinicSettings(clinic)
  const now = new Date()
  const end = new Date(now.getTime() + settings.slot_minutes * 60_000)
  const dayKey = istDateKey(now)

  const supabase = await createClient()
  if (!(await ownsRef(supabase, clinic.id, "patients", patientId))) {
    return { error: FOREIGN_REF_ERROR }
  }

  const { data, error } = await supabase
    .from("appointments")
    .insert({
      clinic_id: clinic.id,
      patient_id: patientId,
      starts_at: now.toISOString(),
      ends_at: end.toISOString(),
      status: "arrived",
      source: "walk_in",
      token_number: await tokenFor(clinic.id, dayKey),
    })
    .select("id")
    .single()

  if (error) return { error: error.message }
  revalidatePath("/today")
  return { ok: true, appointmentId: data.id }
}

export async function setAppointmentStatus(
  appointmentId: string,
  status: Enums<"appointment_status">,
): Promise<Result> {
  await requireClinic()
  const supabase = await createClient()
  const { error } = await supabase
    .from("appointments")
    .update({ status })
    .eq("id", appointmentId)
  if (error) return { error: error.message }
  revalidatePath("/today")
  revalidatePath("/calendar")
  return { ok: true }
}

export async function rescheduleAppointment(
  appointmentId: string,
  startsAt: string,
): Promise<Result> {
  const clinic = await requireClinic()
  const settings = clinicSettings(clinic)
  const start = new Date(startsAt)
  const end = new Date(start.getTime() + settings.slot_minutes * 60_000)

  const supabase = await createClient()
  const { error } = await supabase
    .from("appointments")
    .update({ starts_at: start.toISOString(), ends_at: end.toISOString() })
    .eq("id", appointmentId)
  if (error) {
    if (error.code === "23505") return { error: "That slot is already booked." }
    return { error: error.message }
  }
  revalidatePath("/calendar")
  revalidatePath("/today")
  return { ok: true }
}

/** Accept an online (pending) booking: confirm it, assign a token, notify. */
export async function acceptBooking(appointmentId: string): Promise<Result> {
  const clinic = await requireClinic()
  const supabase = await createClient()

  const { data: appt } = await supabase
    .from("appointments")
    .select("id, starts_at, status")
    .eq("id", appointmentId)
    .maybeSingle()
  if (!appt || appt.status !== "pending") return { error: "This booking can't be accepted." }

  const token = await tokenFor(clinic.id, istDateKey(new Date(appt.starts_at)))
  const { error } = await supabase
    .from("appointments")
    .update({ status: "confirmed", token_number: token })
    .eq("id", appointmentId)
  if (error) return { error: error.message }

  await notifyApptConfirmed(supabase, clinic, appointmentId)
  await tryCreateIntake(clinic, appointmentId)
  revalidatePath("/today")
  revalidatePath("/calendar")
  return { ok: true }
}

export async function rejectBooking(appointmentId: string): Promise<Result> {
  await requireClinic()
  const supabase = await createClient()
  const { error } = await supabase
    .from("appointments")
    .update({ status: "cancelled" })
    .eq("id", appointmentId)
    .eq("status", "pending")
  if (error) return { error: error.message }
  revalidatePath("/today")
  return { ok: true }
}

/**
 * Cancel one appointment and send the WhatsApp cancellation.
 * Shared by the manual cancel action and slot/day blocking.
 * Notifies before the status flips (the trigger reads the patient via the appointment).
 */
export async function cancelWithNotify(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clinic: Clinic,
  appointmentId: string,
): Promise<{ error?: string }> {
  await notifyApptCancelled(supabase, clinic, appointmentId)
  const { error } = await supabase
    .from("appointments")
    .update({ status: "cancelled" })
    .eq("id", appointmentId)
  return error ? { error: error.message } : {}
}

export async function cancelAppointment(appointmentId: string): Promise<Result> {
  const clinic = await requireClinic()
  const supabase = await createClient()
  const { error } = await cancelWithNotify(supabase, clinic, appointmentId)
  if (error) return { error }
  revalidatePath("/calendar")
  revalidatePath("/today")
  return { ok: true }
}

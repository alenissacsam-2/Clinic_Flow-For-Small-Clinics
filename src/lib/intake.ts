import "server-only"
import { randomBytes, createHash } from "crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"
import { clinicSettings, type Clinic } from "@/lib/clinic"
import { env } from "@/lib/env"
import { enqueueWhatsApp } from "@/lib/whatsapp/enqueue"

type DB = SupabaseClient<Database>

/**
 * Create a pre-visit intake request for a confirmed appointment and send the
 * tokenized link on WhatsApp. Idempotent via the appointment_id unique
 * constraint. `admin` must be a service-role client (writes bypass RLS).
 */
export async function createIntakeRequest(
  admin: DB,
  clinic: Clinic,
  appointmentId: string,
): Promise<void> {
  const { data: appt } = await admin
    .from("appointments")
    .select("id, ends_at, patient:patients(id, full_name, phone, whatsapp_opt_in)")
    .eq("id", appointmentId)
    .maybeSingle()
  const a = appt as unknown as {
    id: string
    ends_at: string
    patient: { id: string; full_name: string; phone: string; whatsapp_opt_in: boolean } | null
  } | null
  if (!a?.patient) return

  const rawToken = randomBytes(32).toString("hex")
  const tokenHash = createHash("sha256").update(rawToken).digest("hex")
  const expiresAt = new Date(new Date(a.ends_at).getTime() + 24 * 3600_000).toISOString()

  const { error } = await admin.from("intake_requests").insert({
    clinic_id: clinic.id,
    appointment_id: a.id,
    patient_id: a.patient.id,
    token_hash: tokenHash,
    expires_at: expiresAt,
  })
  // Duplicate (already has an intake request) → nothing more to do.
  if (error) return

  await enqueueWhatsApp(admin, {
    clinicId: clinic.id,
    patientId: a.patient.id,
    toPhone: a.patient.phone,
    template: "intake_link",
    lang: clinicSettings(clinic).template_lang,
    values: [a.patient.full_name, clinic.name, `${env.appUrl}/intake/${rawToken}`],
    relatedType: "appointment",
    relatedId: a.id,
  })
}

import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"
import { clinicSettings, type Clinic } from "@/lib/clinic"
import { formatISTDate, formatISTTime, formatINR } from "@/lib/format"
import { env } from "@/lib/env"
import { enqueueWhatsApp } from "./enqueue"

type DB = SupabaseClient<Database>
type PatientLite = { id: string; full_name: string; phone: string }

export async function notifyApptConfirmed(supabase: DB, clinic: Clinic, appointmentId: string) {
  const { data } = await supabase
    .from("appointments")
    .select("id, starts_at, token_number, patient:patients(id, full_name, phone)")
    .eq("id", appointmentId)
    .maybeSingle()
  const appt = data as unknown as {
    id: string
    starts_at: string
    token_number: number | null
    patient: PatientLite | null
  } | null
  if (!appt?.patient) return

  await enqueueWhatsApp(supabase, {
    clinicId: clinic.id,
    patientId: appt.patient.id,
    toPhone: appt.patient.phone,
    template: "appt_confirmed",
    lang: clinicSettings(clinic).template_lang,
    values: [
      clinic.doctor_name,
      clinic.name,
      formatISTDate(appt.starts_at),
      formatISTTime(appt.starts_at),
      String(appt.token_number ?? "-"),
    ],
    relatedType: "appointment",
    relatedId: appt.id,
  })
}

export async function notifyApptReminder(
  supabase: DB,
  clinic: Clinic,
  appt: { id: string; starts_at: string; patient: PatientLite },
  offsetHours: number,
) {
  await enqueueWhatsApp(supabase, {
    clinicId: clinic.id,
    patientId: appt.patient.id,
    toPhone: appt.patient.phone,
    template: "appt_reminder",
    lang: clinicSettings(clinic).template_lang,
    values: [
      clinic.doctor_name,
      clinic.name,
      formatISTDate(appt.starts_at),
      formatISTTime(appt.starts_at),
    ],
    relatedType: "appointment",
    relatedId: appt.id,
    offset: offsetHours,
  })
}

export async function notifyApptCancelled(supabase: DB, clinic: Clinic, appointmentId: string) {
  const { data } = await supabase
    .from("appointments")
    .select("id, starts_at, patient:patients(id, full_name, phone)")
    .eq("id", appointmentId)
    .maybeSingle()
  const appt = data as unknown as {
    id: string
    starts_at: string
    patient: PatientLite | null
  } | null
  if (!appt?.patient) return

  await enqueueWhatsApp(supabase, {
    clinicId: clinic.id,
    patientId: appt.patient.id,
    toPhone: appt.patient.phone,
    template: "appt_cancelled",
    lang: clinicSettings(clinic).template_lang,
    values: [clinic.name, formatISTDate(appt.starts_at), clinic.phone ?? clinic.name],
    relatedType: "appointment",
    relatedId: appt.id,
  })
}

export async function notifyPrescription(supabase: DB, clinic: Clinic, prescriptionId: string) {
  const { data } = await supabase
    .from("prescriptions")
    .select("id, pdf_path, patient:patients(id, full_name, phone)")
    .eq("id", prescriptionId)
    .maybeSingle()
  const rx = data as unknown as {
    id: string
    pdf_path: string | null
    patient: PatientLite | null
  } | null
  if (!rx?.patient) return

  await enqueueWhatsApp(supabase, {
    clinicId: clinic.id,
    patientId: rx.patient.id,
    toPhone: rx.patient.phone,
    template: "prescription_doc",
    lang: clinicSettings(clinic).template_lang,
    values: [rx.patient.full_name, clinic.doctor_name],
    documentPath: rx.pdf_path,
    relatedType: "prescription",
    relatedId: rx.id,
  })
}

export async function notifyPaymentReceipt(
  supabase: DB,
  clinic: Clinic,
  args: { patient: PatientLite; amount: number; receiptPath?: string | null; paymentId: string },
) {
  await enqueueWhatsApp(supabase, {
    clinicId: clinic.id,
    patientId: args.patient.id,
    toPhone: args.patient.phone,
    template: "payment_receipt",
    lang: clinicSettings(clinic).template_lang,
    values: [args.patient.full_name, formatINR(args.amount).replace("₹", ""), clinic.name],
    documentPath: args.receiptPath,
    relatedType: "payment",
    relatedId: args.paymentId,
  })
}

export async function notifyFollowupDue(
  supabase: DB,
  clinic: Clinic,
  args: { patient: PatientLite; followupDate: string; visitId: string },
) {
  await enqueueWhatsApp(supabase, {
    clinicId: clinic.id,
    patientId: args.patient.id,
    toPhone: args.patient.phone,
    template: "followup_due",
    lang: clinicSettings(clinic).template_lang,
    values: [
      args.patient.full_name,
      clinic.doctor_name,
      formatISTDate(args.followupDate),
      `${env.appUrl}/book/${clinic.slug}`,
    ],
    relatedType: "visit",
    relatedId: args.visitId,
  })
}

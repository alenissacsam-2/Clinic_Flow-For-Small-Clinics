"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { requireClinic } from "@/lib/clinic"
import { firstForeignRef, FOREIGN_REF_ERROR } from "@/lib/ownership"
import { storeRxPdf } from "@/lib/pdf/store"
import { notifyPrescription } from "@/lib/whatsapp/triggers"
import { ensureInvoiceForVisit } from "@/lib/billing"

export type RxItemInput = {
  medicine_name: string
  dosage?: string
  duration_days?: number | null
  instructions?: string
}

export type SaveVisitInput = {
  appointmentId?: string | null
  patientId: string
  visitId?: string | null
  vitals: Record<string, number | undefined>
  complaints?: string
  diagnosis?: string
  /** Optional ICD-10 codes alongside the free-text diagnosis. */
  diagnosisCodes?: string[]
  advice?: string
  followupDate?: string | null
  items: RxItemInput[]
  finalize: boolean
}

export type SaveVisitResult = {
  error?: string
  ok?: boolean
  visitId?: string
  prescriptionId?: string
}

export async function saveVisit(input: SaveVisitInput): Promise<SaveVisitResult> {
  const clinic = await requireClinic()
  const supabase = await createClient()

  // Every id here reaches us from the browser, and this action writes the most
  // consequential rows in the product: a clinical note and a prescription. The
  // `tenant_all` policy checks only the clinic_id being written, so without this
  // a forged patient id would file our diagnosis and our prescription against
  // another clinic's patient — a corrupted medical record, whoever can read it.
  // See src/lib/ownership.ts.
  const foreign = await firstForeignRef(supabase, clinic.id, [
    ["patients", input.patientId],
    ["appointments", input.appointmentId],
    ["visits", input.visitId],
  ])
  if (foreign) return { error: FOREIGN_REF_ERROR }

  const cleanVitals = Object.fromEntries(
    Object.entries(input.vitals).filter(([, v]) => typeof v === "number" && !Number.isNaN(v)),
  )

  // 1. Upsert the visit
  let visitId = input.visitId ?? null
  const visitPayload = {
    clinic_id: clinic.id,
    appointment_id: input.appointmentId ?? null,
    patient_id: input.patientId,
    vitals: cleanVitals,
    complaints: input.complaints || null,
    diagnosis: input.diagnosis || null,
    diagnosis_codes: input.diagnosisCodes ?? [],
    advice: input.advice || null,
    followup_date: input.followupDate || null,
  }

  if (visitId) {
    const { error } = await supabase.from("visits").update(visitPayload).eq("id", visitId)
    if (error) return { error: error.message }
  } else {
    const { data, error } = await supabase.from("visits").insert(visitPayload).select("id").single()
    if (error) return { error: error.message }
    visitId = data.id
  }

  // 2. Prescription (one per visit). Create/refresh only if there are items or finalizing.
  let prescriptionId: string | undefined
  if (input.items.length > 0 || input.finalize) {
    const { data: existing } = await supabase
      .from("prescriptions")
      .select("id")
      .eq("visit_id", visitId)
      .maybeSingle()

    if (existing) {
      prescriptionId = existing.id
      await supabase
        .from("prescriptions")
        .update({ finalized_at: input.finalize ? new Date().toISOString() : null })
        .eq("id", existing.id)
    } else {
      const { data, error } = await supabase
        .from("prescriptions")
        .insert({
          clinic_id: clinic.id,
          visit_id: visitId,
          patient_id: input.patientId,
          finalized_at: input.finalize ? new Date().toISOString() : null,
        })
        .select("id")
        .single()
      if (error) return { error: error.message }
      prescriptionId = data.id
    }

    // Replace items
    await supabase.from("prescription_items").delete().eq("prescription_id", prescriptionId)
    if (input.items.length > 0) {
      const rows = input.items
        .filter((it) => it.medicine_name.trim())
        .map((it, i) => ({
          prescription_id: prescriptionId!,
          position: i,
          medicine_name: it.medicine_name.trim(),
          dosage: it.dosage || null,
          duration_days: it.duration_days ?? null,
          instructions: it.instructions || null,
        }))
      if (rows.length) {
        const { error } = await supabase.from("prescription_items").insert(rows)
        if (error) return { error: error.message }
      }
    }
  }

  // 3. On finalize, complete the appointment and send the Rx over WhatsApp.
  if (input.finalize && input.appointmentId) {
    await supabase.from("appointments").update({ status: "completed" }).eq("id", input.appointmentId)
  }
  if (input.finalize && prescriptionId) {
    // Best-effort PDF upload (needs service role); dry-run sends text only.
    const pdfPath = await storeRxPdf(clinic, prescriptionId)
    if (pdfPath) {
      await supabase.from("prescriptions").update({ pdf_path: pdfPath }).eq("id", prescriptionId)
    }
    await notifyPrescription(supabase, clinic, prescriptionId)
  }

  // On finalize, draft an invoice seeded with the consultation fee.
  if (input.finalize && visitId) {
    await ensureInvoiceForVisit(supabase, clinic, visitId, input.patientId)
  }

  revalidatePath("/today")
  revalidatePath("/billing")
  revalidatePath(`/patients/${input.patientId}`)

  return { ok: true, visitId: visitId!, prescriptionId }
}

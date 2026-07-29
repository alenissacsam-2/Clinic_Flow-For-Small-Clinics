"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { requireDoctor } from "@/lib/clinic"
import { requestConsent, abdmConfigured } from "@/lib/abdm/gateway"
import { HI_TYPES, PURPOSE_CARE_MANAGEMENT } from "@/lib/abdm/consent"

export type ConsentRequestState = { error?: string; ok?: boolean; dryRun?: boolean }

/**
 * Ask the patient — via the ABDM gateway — for consent to fetch their records.
 *
 * Doctor-gated: consent is a clinical-record decision, not a front-desk one.
 * The artefact row is written whether or not the gateway is live, so the
 * request is auditable from the moment it is made. ABDM is consent-first; a
 * record with no artefact is a record we had no right to fetch.
 */
export async function requestPatientConsent(input: {
  patientId: string
  hiTypes: string[]
  /** How far back to request, in days. */
  lookbackDays?: number
}): Promise<ConsentRequestState> {
  const clinic = await requireDoctor()
  const supabase = await createClient()

  const { data: patient } = await supabase
    .from("patients")
    .select("id, abha_address")
    .eq("id", input.patientId)
    .maybeSingle()

  if (!patient) return { error: "Patient not found." }
  if (!patient.abha_address) {
    return { error: "Add this patient's ABHA address before requesting consent." }
  }

  const hiTypes = input.hiTypes.filter((t) => (HI_TYPES as readonly string[]).includes(t))
  if (hiTypes.length === 0) return { error: "Choose at least one record type." }

  const now = new Date()
  const from = new Date(now)
  from.setDate(from.getDate() - (input.lookbackDays ?? 365))
  // Consent expiry is deliberately short: ask again rather than hold a
  // standing claim on someone's health record.
  const expires = new Date(now)
  expires.setDate(expires.getDate() + 30)

  const res = await requestConsent({
    abhaAddress: patient.abha_address,
    purposeCode: PURPOSE_CARE_MANAGEMENT,
    hiTypes,
    dateFrom: from.toISOString(),
    dateTo: now.toISOString(),
    expiresAt: expires.toISOString(),
  })

  if (res.error) return { error: res.error }

  const { error } = await supabase.from("consent_artefacts").insert({
    clinic_id: clinic.id,
    patient_id: patient.id,
    request_id: res.requestId ?? null,
    status: "requested",
    purpose_code: PURPOSE_CARE_MANAGEMENT,
    hi_types: hiTypes,
    date_from: from.toISOString(),
    date_to: now.toISOString(),
    expires_at: expires.toISOString(),
  })

  if (error) return { error: error.message }

  revalidatePath(`/patients/${patient.id}`)
  return { ok: true, dryRun: res.dryRun }
}

/** Whether the gateway is live, for UI that must not imply it is. */
export async function isAbdmLive(): Promise<boolean> {
  return abdmConfigured()
}

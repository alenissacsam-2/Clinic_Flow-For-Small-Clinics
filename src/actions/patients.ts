"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { requireClinic } from "@/lib/clinic"
import { patientSchema, parseTags } from "@/lib/validation/patient"

/**
 * What the doctor actually typed, echoed back when a save is rejected.
 *
 * React 19 resets an uncontrolled `<form action={…}>` once the action settles.
 * Without this, a single bad field (a mistyped ABHA number, say) threw away
 * every *other* edit in the dialog and silently restored the saved record —
 * the doctor retypes an address they already entered, or worse, doesn't notice
 * and saves stale data over a correction.
 */
export type PatientFormValues = {
  full_name: string
  phone: string
  gender: string
  age_years: string
  dob: string
  address: string
  blood_group: string
  allergies: string
  chronic_conditions: string
  abha_number: string
  abha_address: string
  tags: string
  notes: string
  whatsapp_opt_in: boolean
}

export type PatientFormState =
  | { error?: string; ok?: boolean; patientId?: string; values?: PatientFormValues }
  | undefined

const str = (v: FormDataEntryValue | null): string => (typeof v === "string" ? v : "")

/** Verbatim echo of the submitted fields, for re-populating a rejected form. */
function submitted(formData: FormData): PatientFormValues {
  return {
    full_name: str(formData.get("full_name")),
    phone: str(formData.get("phone")),
    gender: str(formData.get("gender")),
    age_years: str(formData.get("age_years")),
    dob: str(formData.get("dob")),
    address: str(formData.get("address")),
    blood_group: str(formData.get("blood_group")),
    allergies: str(formData.get("allergies")),
    chronic_conditions: str(formData.get("chronic_conditions")),
    abha_number: str(formData.get("abha_number")),
    abha_address: str(formData.get("abha_address")),
    tags: str(formData.get("tags")),
    notes: str(formData.get("notes")),
    whatsapp_opt_in: formData.get("whatsapp_opt_in") != null,
  }
}

function extract(formData: FormData) {
  return {
    full_name: formData.get("full_name"),
    phone: formData.get("phone"),
    gender: formData.get("gender") ?? "",
    age_years: formData.get("age_years") ?? "",
    dob: formData.get("dob") ?? "",
    address: formData.get("address") ?? "",
    blood_group: formData.get("blood_group") ?? "",
    allergies: formData.get("allergies") ?? "",
    chronic_conditions: formData.get("chronic_conditions") ?? "",
    abha_number: formData.get("abha_number") ?? "",
    abha_address: formData.get("abha_address") ?? "",
    tags: formData.get("tags") ?? "",
    whatsapp_opt_in: formData.get("whatsapp_opt_in") ?? false,
    notes: formData.get("notes") ?? "",
  }
}

export async function createPatient(
  _prev: PatientFormState,
  formData: FormData,
): Promise<PatientFormState> {
  const clinic = await requireClinic()
  const parsed = patientSchema.safeParse(extract(formData))
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Please check the form.",
      values: submitted(formData),
    }
  }
  const v = parsed.data
  const optIn = v.whatsapp_opt_in === "on" || v.whatsapp_opt_in === true

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("patients")
    .insert({
      clinic_id: clinic.id,
      full_name: v.full_name,
      phone: v.phone,
      gender: v.gender || null,
      age_years: typeof v.age_years === "number" ? v.age_years : null,
      dob: v.dob || null,
      address: v.address || null,
      blood_group: v.blood_group || null,
      allergies: v.allergies || null,
      chronic_conditions: v.chronic_conditions || null,
      abha_number: v.abha_number || null,
      abha_address: v.abha_address || null,
      tags: parseTags(v.tags),
      whatsapp_opt_in: optIn,
      consent_at: optIn ? new Date().toISOString() : null,
      notes: v.notes || null,
    })
    .select("id")
    .single()

  if (error) return { error: error.message, values: submitted(formData) }
  revalidatePath("/patients")
  return { ok: true, patientId: data.id }
}

export async function updatePatient(
  patientId: string,
  _prev: PatientFormState,
  formData: FormData,
): Promise<PatientFormState> {
  await requireClinic()
  const parsed = patientSchema.safeParse(extract(formData))
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Please check the form.",
      values: submitted(formData),
    }
  }
  const v = parsed.data
  const optIn = v.whatsapp_opt_in === "on" || v.whatsapp_opt_in === true

  const supabase = await createClient()
  const { error } = await supabase
    .from("patients")
    .update({
      full_name: v.full_name,
      phone: v.phone,
      gender: v.gender || null,
      age_years: typeof v.age_years === "number" ? v.age_years : null,
      dob: v.dob || null,
      address: v.address || null,
      blood_group: v.blood_group || null,
      allergies: v.allergies || null,
      chronic_conditions: v.chronic_conditions || null,
      abha_number: v.abha_number || null,
      abha_address: v.abha_address || null,
      tags: parseTags(v.tags),
      whatsapp_opt_in: optIn,
    })
    .eq("id", patientId)

  if (error) return { error: error.message, values: submitted(formData) }
  revalidatePath(`/patients/${patientId}`)
  revalidatePath("/patients")
  return { ok: true, patientId }
}

/** Soft-delete (DPDP): hidden immediately, purged later by a scheduled job. */
export async function softDeletePatient(patientId: string): Promise<{ error?: string }> {
  await requireClinic()
  const supabase = await createClient()
  const { error } = await supabase
    .from("patients")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", patientId)
  if (error) return { error: error.message }
  revalidatePath("/patients")
  return {}
}

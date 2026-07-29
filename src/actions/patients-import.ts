"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { requireClinic } from "@/lib/clinic"
import { patientSchema, parseTags } from "@/lib/validation/patient"
import type { TablesInsert } from "@/types/database"

export type ImportRow = Record<string, string>

export type RowResult = { row: number; status: "inserted" | "skipped-duplicate" | "error"; reason?: string }
export type ImportResult = {
  inserted: number
  skipped: number
  errored: number
  results: RowResult[]
  error?: string
}

const MAX_ROWS = 2000

/**
 * Import patients from mapped CSV rows. Re-validates every row server-side,
 * dedupes by normalized phone (in-file and against existing patients), and
 * inserts in batches. Consent gates whatsapp_opt_in (DPDP-safe default off).
 */
export async function importPatients(rows: ImportRow[], consent: boolean): Promise<ImportResult> {
  const clinic = await requireClinic()
  if (!Array.isArray(rows)) return { inserted: 0, skipped: 0, errored: 0, results: [], error: "No rows." }
  if (rows.length > MAX_ROWS) {
    return { inserted: 0, skipped: 0, errored: 0, results: [], error: `Too many rows (max ${MAX_ROWS}).` }
  }

  const supabase = await createClient()

  // Existing (live) phones for this clinic.
  const { data: existing } = await supabase
    .from("patients")
    .select("phone")
    .eq("clinic_id", clinic.id)
    .is("deleted_at", null)
  const seen = new Set((existing ?? []).map((p) => p.phone))

  const consentAt = consent ? new Date().toISOString() : null
  const toInsert: {
    payload: TablesInsert<"patients">
    row: number
  }[] = []
  const results: RowResult[] = []

  rows.forEach((raw, i) => {
    const rowNum = i + 1
    const parsed = patientSchema.safeParse({
      full_name: raw.full_name ?? "",
      phone: raw.phone ?? "",
      gender: raw.gender ?? "",
      age_years: raw.age_years ?? "",
      dob: raw.dob ?? "",
      address: raw.address ?? "",
      blood_group: raw.blood_group ?? "",
      allergies: raw.allergies ?? "",
      chronic_conditions: raw.chronic_conditions ?? "",
      tags: raw.tags ?? "",
      notes: raw.notes ?? "",
    })
    if (!parsed.success) {
      results.push({ row: rowNum, status: "error", reason: parsed.error.issues[0]?.message ?? "Invalid row" })
      return
    }
    const v = parsed.data
    if (seen.has(v.phone)) {
      results.push({ row: rowNum, status: "skipped-duplicate", reason: v.phone })
      return
    }
    seen.add(v.phone) // guard against in-file duplicates too

    toInsert.push({
      row: rowNum,
      payload: {
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
        tags: parseTags(v.tags),
        whatsapp_opt_in: consent,
        consent_at: consentAt,
        notes: v.notes || null,
      },
    })
  })

  // Batch insert (500/insert).
  let inserted = 0
  for (let i = 0; i < toInsert.length; i += 500) {
    const chunk = toInsert.slice(i, i + 500)
    const { error, count } = await supabase
      .from("patients")
      .insert(chunk.map((c) => c.payload), { count: "exact" })
    if (error) {
      for (const c of chunk) results.push({ row: c.row, status: "error", reason: error.message })
    } else {
      inserted += count ?? chunk.length
      for (const c of chunk) results.push({ row: c.row, status: "inserted" })
    }
  }

  results.sort((a, b) => a.row - b.row)
  const skipped = results.filter((r) => r.status === "skipped-duplicate").length
  const errored = results.filter((r) => r.status === "error").length
  revalidatePath("/patients")
  return { inserted, skipped, errored, results }
}

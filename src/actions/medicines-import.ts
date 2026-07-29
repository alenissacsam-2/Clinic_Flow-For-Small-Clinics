"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { requireDoctor } from "@/lib/clinic"
import type { TablesInsert } from "@/types/database"

export type MedicineImportRow = Record<string, string>

export type MedicineRowResult = {
  row: number
  status: "inserted" | "skipped-duplicate" | "error"
  reason?: string
}

export type MedicineImportResult = {
  inserted: number
  skipped: number
  errored: number
  results: MedicineRowResult[]
  error?: string
}

const MAX_ROWS = 5000

/**
 * Bulk-add medicines to this clinic's list from mapped CSV rows.
 *
 * This is how a clinic gets past the curated seed to a full drug database
 * (CDSCO/NPPA published lists, or a licensed dataset). Imported rows are scoped
 * to the clinic — the shared global list stays seed-owned — and clinic rows sort
 * above global ones in the prescription picker.
 *
 * `composition` matters more than it looks: it is the ingredient string the
 * allergy and interaction checks match on. A row imported without it still
 * autocompletes, but is silently excluded from safety screening, so the UI
 * warns when the column is absent.
 */
export async function importMedicines(
  rows: MedicineImportRow[],
): Promise<MedicineImportResult> {
  const clinic = await requireDoctor()
  const empty = { inserted: 0, skipped: 0, errored: 0, results: [] }

  if (!Array.isArray(rows) || rows.length === 0) return { ...empty, error: "No rows." }
  if (rows.length > MAX_ROWS) {
    return { ...empty, error: `Too many rows (max ${MAX_ROWS}). Split the file and import again.` }
  }

  const supabase = await createClient()

  // Dedupe against everything the clinic can already see: its own rows and the
  // global seed. Mirrors the medicines_dedupe_uniq index (name, form, strength).
  const { data: existing } = await supabase.from("medicines").select("name, form, strength")
  const key = (n: string, f: string | null, s: string | null) =>
    `${n.trim().toLowerCase()}|${(f ?? "").trim().toLowerCase()}|${(s ?? "").trim().toLowerCase()}`
  const seen = new Set((existing ?? []).map((m) => key(m.name, m.form, m.strength)))

  const toInsert: { payload: TablesInsert<"medicines">; row: number }[] = []
  const results: MedicineRowResult[] = []

  rows.forEach((raw, i) => {
    const rowNum = i + 1
    const name = (raw.name ?? "").trim()
    const form = (raw.form ?? "").trim()
    const strength = (raw.strength ?? "").trim()
    const composition = (raw.composition ?? "").trim()

    if (!name) {
      results.push({ row: rowNum, status: "error", reason: "Missing medicine name" })
      return
    }
    if (name.length > 200) {
      results.push({ row: rowNum, status: "error", reason: "Name too long" })
      return
    }

    const k = key(name, form, strength)
    if (seen.has(k)) {
      results.push({ row: rowNum, status: "skipped-duplicate", reason: name })
      return
    }
    seen.add(k) // also guards against duplicates within the file

    toInsert.push({
      row: rowNum,
      payload: {
        clinic_id: clinic.id,
        name,
        form: form || null,
        strength: strength || null,
        // Fall back to the name so generics still screen for allergies.
        composition: composition || name,
      },
    })
  })

  let inserted = 0
  for (let i = 0; i < toInsert.length; i += 500) {
    const chunk = toInsert.slice(i, i + 500)
    const { error, count } = await supabase
      .from("medicines")
      .insert(
        chunk.map((c) => c.payload),
        { count: "exact" },
      )
    if (error) {
      for (const c of chunk) results.push({ row: c.row, status: "error", reason: error.message })
    } else {
      inserted += count ?? chunk.length
      for (const c of chunk) results.push({ row: c.row, status: "inserted" })
    }
  }

  results.sort((a, b) => a.row - b.row)
  revalidatePath("/settings/medicines")
  return {
    inserted,
    skipped: results.filter((r) => r.status === "skipped-duplicate").length,
    errored: results.filter((r) => r.status === "error").length,
    results,
  }
}

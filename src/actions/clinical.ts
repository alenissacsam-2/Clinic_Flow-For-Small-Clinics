"use server"

import { createClient } from "@/lib/supabase/server"
import { requireClinic } from "@/lib/clinic"
import {
  runSafetyChecks,
  parseIngredients,
  type DrugEntry,
  type InteractionRule,
  type SafetyReport,
} from "@/lib/clinical/safety"

/**
 * Screen a draft prescription against the patient's recorded allergies and the
 * interaction rule set.
 *
 * Runs server-side so the rule table is never shipped to the browser and so the
 * patient's allergy text is read under RLS rather than passed in by the client.
 * Purely advisory — `saveVisit` does not consult this, and nothing here can
 * block a prescription.
 */
export async function checkPrescriptionSafety(input: {
  patientId: string
  medicineNames: string[]
}): Promise<SafetyReport> {
  const empty: SafetyReport = { allergies: [], interactions: [], unresolved: [] }

  const names = input.medicineNames.map((n) => n.trim()).filter(Boolean)
  if (names.length === 0) return empty

  await requireClinic()
  const supabase = await createClient()

  const { data: patient } = await supabase
    .from("patients")
    .select("allergies")
    .eq("id", input.patientId)
    .maybeSingle()

  // Nothing to screen against and nothing to interact — skip the round trip.
  if (!patient?.allergies && names.length < 2) return empty

  const drugs = await resolveDrugs(supabase, names)

  const { data: ruleRows } = await supabase
    .from("drug_interactions")
    .select("ingredient_a, ingredient_b, severity, description, source")

  const rules: InteractionRule[] = (ruleRows ?? []).map((r) => ({
    a: r.ingredient_a,
    b: r.ingredient_b,
    severity: r.severity as InteractionRule["severity"],
    description: r.description,
    source: r.source,
  }))

  return runSafetyChecks(patient?.allergies ?? null, drugs, rules)
}

type Client = Awaited<ReturnType<typeof createClient>>

/**
 * Map each prescribed free-text name to its active ingredients.
 *
 * Prescription items store a display string ("Augmentin 625 mg"), not a
 * medicine id, so resolution is by name. Two passes: an exact case-insensitive
 * match on the leading name, then a prefix match for entries that carry a
 * trailing strength. Anything still unmatched is returned with no ingredients
 * and surfaces to the user as explicitly *unchecked* rather than as safe.
 */
async function resolveDrugs(supabase: Client, names: string[]): Promise<DrugEntry[]> {
  const { data } = await supabase.from("medicines").select("name, composition")
  const rows = data ?? []

  const byName = new Map<string, string | null>()
  for (const r of rows) {
    const key = r.name.toLowerCase()
    // First writer wins; clinic rows and seed rows share a namespace here and
    // any row for the name gives the same ingredients in practice.
    if (!byName.has(key)) byName.set(key, r.composition)
  }
  // Longest names first so "Amoxicillin + Clavulanic Acid" is preferred over
  // "Amoxicillin" when a typed entry could match either.
  const sortedNames = [...byName.keys()].sort((a, b) => b.length - a.length)

  return names.map((typed) => {
    const t = typed.toLowerCase().trim()

    let composition = byName.get(t) ?? null
    if (composition == null) {
      const hit = sortedNames.find((n) => t === n || t.startsWith(n + " "))
      if (hit) composition = byName.get(hit) ?? null
    }

    return { name: typed, ingredients: parseIngredients(composition) }
  })
}

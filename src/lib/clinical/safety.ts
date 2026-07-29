/**
 * Clinical safety checks for prescribing: allergy cross-checks and drug–drug
 * interaction screening.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SCOPE AND LIMITS — this is decision *support*, not a decision maker.
 *
 * The interaction rule set is CURATED and NON-EXHAUSTIVE: it covers widely
 * documented, clinically significant pairs, not the full interaction space of a
 * licensed drug-safety database. A drug pair producing no warning here has NOT
 * been cleared — it may simply be absent from the rule set. Every result is
 * advisory and must be read as such in the UI; nothing here ever blocks a
 * prescription. The prescriber's judgement governs.
 *
 * Matching is done on ACTIVE INGREDIENTS (`medicines.composition`), never on
 * brand names, so "Augmentin" correctly trips a penicillin allergy. A medicine
 * whose ingredients we cannot resolve is reported as `unresolved` rather than
 * silently passing — an unchecked drug must never look like a checked one.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type Severity = "major" | "moderate" | "minor"

/** A drug as it appears on the prescription, paired with its ingredients. */
export type DrugEntry = {
  /** Free text exactly as prescribed, e.g. "Augmentin 625 mg". */
  name: string
  /** Active ingredients from `medicines.composition`; empty if unresolved. */
  ingredients: string[]
}

export type AllergyHit = {
  drugName: string
  ingredient: string
  /** The patient's own recorded wording that matched. */
  allergyTerm: string
  /**
   * `direct`      — the ingredient itself matches the recorded allergy.
   * `class`       — the ingredient belongs to a class the patient reacts to.
   * `cross-class` — a documented cross-reactivity risk between classes.
   */
  basis: "direct" | "class" | "cross-class"
}

export type InteractionRule = {
  /** An ingredient ("warfarin") or a class token ("class:nsaid"). */
  a: string
  b: string
  severity: Severity
  description: string
  source?: string | null
}

export type InteractionHit = {
  severity: Severity
  description: string
  drugA: string
  drugB: string
  ingredientA: string
  ingredientB: string
}

export type SafetyReport = {
  allergies: AllergyHit[]
  interactions: InteractionHit[]
  /** Prescribed names whose ingredients could not be resolved — NOT checked. */
  unresolved: string[]
}

/* ── Normalisation ─────────────────────────────────────────────────────────── */

/** Lowercase, strip punctuation and dose/strength noise, collapse whitespace. */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/** "Amoxicillin + Clavulanic Acid" → ["amoxicillin", "clavulanic acid"] */
export function parseIngredients(composition: string | null | undefined): string[] {
  if (!composition) return []
  return composition
    .split(/[+,/]/)
    .map((p) => normalize(p))
    .filter(Boolean)
}

/**
 * `patients.allergies` is free text ("Penicillin, sulfa drugs; dust").
 * Split it into candidate terms. Non-drug entries (dust, pollen) simply never
 * match an ingredient, so they cost nothing.
 */
export function parseAllergyTerms(text: string | null | undefined): string[] {
  if (!text) return []
  return text
    .split(/[,;/\n]/)
    .map((p) => normalize(p).replace(/\b(allergy|allergic|to|drugs?|group)\b/g, "").trim())
    .filter((p) => p.length >= 3)
}

/* ── Drug classes ──────────────────────────────────────────────────────────── */

/**
 * Class → member ingredients. Used for BOTH allergy expansion (a penicillin
 * allergy implicates every penicillin) and interaction rules (`class:nsaid`),
 * so a rule is written once instead of per-member.
 *
 * Deliberately conservative: members are drugs actually present in the seeded
 * medicine list, named by ingredient.
 */
export const DRUG_CLASSES: Record<string, string[]> = {
  penicillin: [
    "amoxicillin", "ampicillin", "cloxacillin", "piperacillin",
    "benzathine benzylpenicillin", "benzylpenicillin", "phenoxymethylpenicillin",
  ],
  cephalosporin: [
    "cefixime", "cefpodoxime", "cefuroxime", "cephalexin", "cefadroxil",
    "ceftriaxone", "cefotaxime", "ceftazidime", "cefdinir",
  ],
  sulfa: ["sulfamethoxazole", "sulfasalazine", "silver sulfadiazine", "cotrimoxazole"],
  nsaid: [
    "ibuprofen", "diclofenac", "aceclofenac", "naproxen", "mefenamic acid",
    "etoricoxib", "piroxicam", "indomethacin", "ketorolac", "nimesulide", "aspirin",
  ],
  macrolide: ["azithromycin", "clarithromycin", "erythromycin", "roxithromycin"],
  quinolone: [
    "ciprofloxacin", "levofloxacin", "ofloxacin", "norfloxacin",
    "moxifloxacin", "gatifloxacin",
  ],
  tetracycline: ["doxycycline", "minocycline", "tetracycline"],
  aminoglycoside: ["gentamicin", "amikacin", "neomycin", "tobramycin", "streptomycin"],
  statin: ["atorvastatin", "rosuvastatin", "simvastatin"],
  ace: ["ramipril", "enalapril", "lisinopril", "perindopril"],
  arb: ["telmisartan", "losartan", "olmesartan", "valsartan"],
  ssri: ["sertraline", "escitalopram", "fluoxetine", "paroxetine", "citalopram"],
  ppi: ["pantoprazole", "omeprazole", "esomeprazole", "rabeprazole", "lansoprazole"],
  beta_blocker: [
    "propranolol", "atenolol", "metoprolol", "bisoprolol", "carvedilol", "nebivolol",
  ],
  anticoagulant: [
    "warfarin", "acenocoumarol", "dabigatran", "rivaroxaban", "apixaban", "enoxaparin",
  ],
  benzodiazepine: [
    "alprazolam", "clonazepam", "lorazepam", "diazepam", "etizolam", "clobazam",
    "chlordiazepoxide",
  ],
  potassium_sparing: ["spironolactone", "potassium chloride"],
  antiepileptic_inducer: ["carbamazepine", "phenytoin", "oxcarbazepine"],
}

/**
 * Documented cross-reactivity between allergy classes. Penicillin↔cephalosporin
 * is the clinically important one (a small but real shared-sidechain risk);
 * flagged as advisory so the prescriber decides.
 */
const CROSS_REACTIVITY: Record<string, string[]> = {
  penicillin: ["cephalosporin"],
  cephalosporin: ["penicillin"],
}

/** Classes an ingredient belongs to. */
export function classesOf(ingredient: string): string[] {
  const n = normalize(ingredient)
  return Object.entries(DRUG_CLASSES)
    .filter(([, members]) => members.some((m) => n === m || n.includes(m)))
    .map(([cls]) => cls)
}

/** Expand a rule side into concrete ingredients. */
function expand(token: string): string[] {
  const t = token.trim().toLowerCase()
  if (t.startsWith("class:")) return DRUG_CLASSES[t.slice(6)] ?? []
  return [normalize(t)]
}

/* ── Allergy checking ──────────────────────────────────────────────────────── */

/**
 * Cross-check prescribed ingredients against the patient's recorded allergies.
 * Substring matching is intentional and one-directional: an allergy to
 * "penicillin" must catch "phenoxymethylpenicillin", but a term must be at
 * least 4 characters so short words can't match spuriously.
 */
export function checkAllergies(allergyText: string | null | undefined, drugs: DrugEntry[]): AllergyHit[] {
  const terms = parseAllergyTerms(allergyText)
  if (terms.length === 0) return []

  const hits: AllergyHit[] = []
  const seen = new Set<string>()

  for (const term of terms) {
    // Which classes does the patient's own wording name? ("penicillin" → penicillin)
    const namedClasses = Object.keys(DRUG_CLASSES).filter(
      (cls) => term.includes(cls.replace(/_/g, " ")) || cls.replace(/_/g, " ").includes(term),
    )

    for (const drug of drugs) {
      for (const ing of drug.ingredients) {
        let basis: AllergyHit["basis"] | null = null

        if (term.length >= 4 && (ing.includes(term) || term.includes(ing))) {
          basis = "direct"
        } else if (namedClasses.some((cls) => DRUG_CLASSES[cls].some((m) => ing === m || ing.includes(m)))) {
          basis = "class"
        } else if (
          namedClasses.some((cls) =>
            (CROSS_REACTIVITY[cls] ?? []).some((rel) =>
              DRUG_CLASSES[rel].some((m) => ing === m || ing.includes(m)),
            ),
          )
        ) {
          basis = "cross-class"
        }

        if (!basis) continue
        const key = `${drug.name}|${ing}|${term}`
        if (seen.has(key)) continue
        seen.add(key)
        hits.push({ drugName: drug.name, ingredient: ing, allergyTerm: term, basis })
      }
    }
  }

  // Definite matches first; cross-reactivity advisories last.
  const rank = { direct: 0, class: 1, "cross-class": 2 } as const
  return hits.sort((x, y) => rank[x.basis] - rank[y.basis])
}

/* ── Interaction checking ──────────────────────────────────────────────────── */

const SEVERITY_RANK: Record<Severity, number> = { major: 0, moderate: 1, minor: 2 }

/** Screen every prescribed pair against the rule set. */
export function checkInteractions(drugs: DrugEntry[], rules: InteractionRule[]): InteractionHit[] {
  const hits: InteractionHit[] = []
  const seen = new Set<string>()

  for (let i = 0; i < drugs.length; i++) {
    for (let j = i + 1; j < drugs.length; j++) {
      const left = drugs[i]
      const right = drugs[j]

      for (const rule of rules) {
        const sideA = expand(rule.a)
        const sideB = expand(rule.b)

        // A rule is direction-free: try both orientations.
        for (const [d1, d2] of [
          [left, right],
          [right, left],
        ] as const) {
          const ingA = d1.ingredients.find((x) => sideA.some((m) => x === m || x.includes(m)))
          const ingB = d2.ingredients.find((x) => sideB.some((m) => x === m || x.includes(m)))
          if (!ingA || !ingB) continue
          // Same molecule on both sides is not an interaction.
          if (d1.name === d2.name && ingA === ingB) continue

          const key = [left.name, right.name, rule.a, rule.b].join("|")
          if (seen.has(key)) continue
          seen.add(key)
          hits.push({
            severity: rule.severity,
            description: rule.description,
            drugA: d1.name,
            drugB: d2.name,
            ingredientA: ingA,
            ingredientB: ingB,
          })
        }
      }
    }
  }

  return hits.sort((x, y) => SEVERITY_RANK[x.severity] - SEVERITY_RANK[y.severity])
}

/* ── Combined ──────────────────────────────────────────────────────────────── */

export function runSafetyChecks(
  allergyText: string | null | undefined,
  drugs: DrugEntry[],
  rules: InteractionRule[],
): SafetyReport {
  const checkable = drugs.filter((d) => d.ingredients.length > 0)
  return {
    allergies: checkAllergies(allergyText, checkable),
    interactions: checkInteractions(checkable, rules),
    unresolved: drugs.filter((d) => d.ingredients.length === 0).map((d) => d.name),
  }
}

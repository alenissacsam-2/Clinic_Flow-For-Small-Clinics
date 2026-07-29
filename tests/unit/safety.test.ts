import { describe, it, expect } from "vitest"
import {
  DRUG_CLASSES,
  parseIngredients,
  parseAllergyTerms,
  classesOf,
  checkAllergies,
  checkInteractions,
  runSafetyChecks,
  type DrugEntry,
  type InteractionRule,
} from "@/lib/clinical/safety"

const drug = (name: string, composition: string): DrugEntry => ({
  name,
  ingredients: parseIngredients(composition),
})

const RULES: InteractionRule[] = [
  {
    a: "warfarin",
    b: "class:nsaid",
    severity: "major",
    description: "Increased bleeding risk.",
  },
  {
    a: "class:ace",
    b: "spironolactone",
    severity: "major",
    description: "Risk of hyperkalaemia.",
  },
  {
    a: "levothyroxine",
    b: "calcium carbonate",
    severity: "moderate",
    description: "Reduced levothyroxine absorption.",
  },
]

describe("parseIngredients", () => {
  it("splits a combination on +", () => {
    expect(parseIngredients("Amoxicillin + Clavulanic Acid")).toEqual([
      "amoxicillin",
      "clavulanic acid",
    ])
  })
  it("strips parenthetical qualifiers", () => {
    expect(parseIngredients("Insulin Human (Regular)")).toEqual(["insulin human"])
  })
  it("returns empty for null", () => {
    expect(parseIngredients(null)).toEqual([])
  })
})

describe("parseAllergyTerms", () => {
  it("splits on commas and semicolons", () => {
    expect(parseAllergyTerms("Penicillin, Sulfa; dust")).toEqual(["penicillin", "sulfa", "dust"])
  })
  it("drops filler words", () => {
    expect(parseAllergyTerms("allergic to penicillin")).toEqual(["penicillin"])
  })
  it("returns empty for blank input", () => {
    expect(parseAllergyTerms("")).toEqual([])
    expect(parseAllergyTerms(null)).toEqual([])
  })
})

describe("classesOf", () => {
  it("maps amoxicillin to penicillin", () => {
    expect(classesOf("amoxicillin")).toContain("penicillin")
  })
  it("maps ibuprofen to nsaid", () => {
    expect(classesOf("ibuprofen")).toContain("nsaid")
  })
})

describe("DRUG_CLASSES", () => {
  // Every `class:*` token used by the seeded rules in 0019_drug_safety.sql must
  // exist here, or that rule silently expands to nothing and never fires.
  // Adding a rule with a new class token means adding the class here too.
  const TOKENS_USED_BY_SEED = [
    "ace", "arb", "benzodiazepine", "beta_blocker", "macrolide", "nsaid",
    "ppi", "quinolone", "ssri", "statin", "tetracycline",
  ]
  it.each(TOKENS_USED_BY_SEED)("defines the %s class with members", (token) => {
    expect(DRUG_CLASSES[token]).toBeDefined()
    expect(DRUG_CLASSES[token].length).toBeGreaterThan(0)
  })
})

describe("checkAllergies", () => {
  // The headline case: a brand name must resolve through its ingredients.
  it("flags a penicillin allergy when a brand (Augmentin) is prescribed", () => {
    const hits = checkAllergies("Penicillin", [
      drug("Augmentin 625 mg", "Amoxicillin + Clavulanic Acid"),
    ])
    expect(hits).toHaveLength(1)
    expect(hits[0].basis).toBe("class")
    expect(hits[0].ingredient).toBe("amoxicillin")
  })

  it("flags a direct ingredient match", () => {
    const hits = checkAllergies("Ibuprofen", [drug("Brufen 400 mg", "Ibuprofen")])
    expect(hits[0].basis).toBe("direct")
  })

  it("catches penicillin as a substring of a longer ingredient", () => {
    const hits = checkAllergies("Penicillin", [drug("Penicillin V", "Phenoxymethylpenicillin")])
    expect(hits.length).toBeGreaterThan(0)
  })

  it("flags cephalosporin cross-reactivity for a penicillin allergy", () => {
    const hits = checkAllergies("Penicillin", [drug("Zifi 200", "Cefixime")])
    expect(hits).toHaveLength(1)
    expect(hits[0].basis).toBe("cross-class")
  })

  it("flags a sulfa allergy on cotrimoxazole", () => {
    const hits = checkAllergies("Sulfa", [
      drug("Cotrimoxazole", "Sulfamethoxazole + Trimethoprim"),
    ])
    expect(hits.length).toBeGreaterThan(0)
  })

  it("does not flag an unrelated drug", () => {
    expect(checkAllergies("Penicillin", [drug("Dolo 650", "Paracetamol")])).toEqual([])
  })

  it("ignores non-drug allergies", () => {
    expect(checkAllergies("Dust, pollen", [drug("Dolo 650", "Paracetamol")])).toEqual([])
  })

  it("returns nothing when no allergies are recorded", () => {
    expect(checkAllergies(null, [drug("Augmentin", "Amoxicillin")])).toEqual([])
  })

  it("orders direct matches before cross-reactivity advisories", () => {
    const hits = checkAllergies("Penicillin", [
      drug("Zifi 200", "Cefixime"),
      drug("Amoxil", "Amoxicillin"),
    ])
    expect(hits[0].basis).toBe("class")
    expect(hits[hits.length - 1].basis).toBe("cross-class")
  })
})

describe("checkInteractions", () => {
  it("flags warfarin + an NSAID via class expansion", () => {
    const hits = checkInteractions(
      [drug("Warfarin 5 mg", "Warfarin"), drug("Brufen 400", "Ibuprofen")],
      RULES,
    )
    expect(hits).toHaveLength(1)
    expect(hits[0].severity).toBe("major")
  })

  it("is direction-independent", () => {
    const forward = checkInteractions(
      [drug("Warfarin", "Warfarin"), drug("Combiflam", "Ibuprofen + Paracetamol")],
      RULES,
    )
    const reverse = checkInteractions(
      [drug("Combiflam", "Ibuprofen + Paracetamol"), drug("Warfarin", "Warfarin")],
      RULES,
    )
    expect(forward).toHaveLength(1)
    expect(reverse).toHaveLength(1)
  })

  it("matches a class on both rule sides", () => {
    const hits = checkInteractions(
      [drug("Ramipril 5", "Ramipril"), drug("Aldactone", "Spironolactone")],
      RULES,
    )
    expect(hits[0].description).toMatch(/hyperkalaemia/i)
  })

  it("finds nothing for a safe pair", () => {
    expect(
      checkInteractions([drug("Dolo 650", "Paracetamol"), drug("Cetzine", "Cetirizine")], RULES),
    ).toEqual([])
  })

  it("does not flag a single drug against itself", () => {
    expect(checkInteractions([drug("Warfarin", "Warfarin")], RULES)).toEqual([])
  })

  it("sorts major before moderate", () => {
    const hits = checkInteractions(
      [
        drug("Thyronorm", "Levothyroxine"),
        drug("Shelcal", "Calcium Carbonate + Cholecalciferol"),
        drug("Warfarin", "Warfarin"),
        drug("Brufen", "Ibuprofen"),
      ],
      RULES,
    )
    expect(hits[0].severity).toBe("major")
    expect(hits[hits.length - 1].severity).toBe("moderate")
  })
})

describe("runSafetyChecks", () => {
  it("reports unresolved drugs separately instead of passing them silently", () => {
    const report = runSafetyChecks(
      "Penicillin",
      [drug("Augmentin", "Amoxicillin"), { name: "Some handwritten drug", ingredients: [] }],
      RULES,
    )
    expect(report.allergies).toHaveLength(1)
    expect(report.unresolved).toEqual(["Some handwritten drug"])
  })

  it("returns an all-clear for a safe prescription", () => {
    const report = runSafetyChecks("Penicillin", [drug("Dolo 650", "Paracetamol")], RULES)
    expect(report.allergies).toEqual([])
    expect(report.interactions).toEqual([])
    expect(report.unresolved).toEqual([])
  })
})

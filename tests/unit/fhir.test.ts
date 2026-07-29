import { describe, it, expect } from "vitest"
import {
  buildOpConsultBundle,
  buildPatientRecordBundle,
  splitAllergyTerms,
  type FhirClinicInput,
  type FhirPatientInput,
  type FhirVisitInput,
  type FhirResource,
} from "@/lib/fhir/bundle"

const CLINIC_ID = "11111111-1111-1111-1111-111111111111"
const PATIENT_ID = "22222222-2222-2222-2222-222222222222"
const VISIT_ID = "33333333-3333-3333-3333-333333333333"
const GENERATED_AT = "2026-07-26T10:00:00.000Z"

const clinic: FhirClinicInput = {
  id: CLINIC_ID,
  name: "Sunrise Clinic",
  address: "12 MG Road, Pune",
  phone: "+912012345678",
  doctorName: "Dr. Test",
  qualifications: "MBBS, MD",
  registrationNo: "MH-12345",
  specialty: "General Physician",
}

const patient: FhirPatientInput = {
  id: PATIENT_ID,
  fullName: "Aarav Shah",
  phone: "+919876543210",
  gender: "male",
  dob: "1985-04-12",
  ageYears: 41,
  address: "5 Park Street, Pune",
  abhaNumber: "91112233445564",
  abhaAddress: "aarav.shah@sbx",
  allergies: "Penicillin, Sulfa drugs",
}

const visit: FhirVisitInput = {
  id: VISIT_ID,
  visitDate: "2026-07-20",
  createdAt: "2026-07-20T09:30:00.000Z",
  complaints: "Fever and sore throat for 3 days",
  diagnosis: "Acute upper respiratory infection",
  diagnosisCodes: [{ code: "J06.9", title: "Acute upper respiratory infection, unspecified" }],
  advice: "Rest, fluids",
  followupDate: "2026-07-27",
  vitals: { bp_sys: 122, bp_dia: 80, pulse: 88, temp_f: 101.2, spo2: 98 },
  medications: [
    { name: "Augmentin 625 mg", dosage: "1-0-1", durationDays: 5, instructions: "After food" },
    { name: "Dolo 650", dosage: "1-1-1", durationDays: null, instructions: null },
  ],
  labs: [
    {
      id: "55555555-5555-5555-5555-555555555555",
      status: "resulted",
      labName: "Metro Diagnostics",
      orderedAt: "2026-07-20T10:00:00.000Z",
      resultedAt: "2026-07-21T08:00:00.000Z",
      results: [
        {
          id: "66666666-6666-6666-6666-666666666666",
          testName: "Haemoglobin",
          loincCode: "718-7",
          valueText: "9.8",
          valueNumber: 9.8,
          unit: "g/dL",
          referenceLow: 12,
          referenceHigh: 15,
          referenceText: null,
          flag: "low",
          note: null,
        },
        {
          id: "77777777-7777-7777-7777-777777777777",
          testName: "Dengue NS1 Antigen",
          loincCode: null,
          valueText: "Negative",
          valueNumber: null,
          unit: null,
          referenceLow: null,
          referenceHigh: null,
          referenceText: "Negative",
          flag: null,
          note: null,
        },
      ],
    },
  ],
  attachments: [
    {
      id: "88888888-8888-8888-8888-888888888888",
      fileName: "cbc-report.pdf",
      mimeType: "application/pdf",
      kind: "lab_report",
      note: "Brought from Metro Diagnostics",
      createdAt: "2026-07-21T09:00:00.000Z",
    },
  ],
}

const record = { clinic, patient, generatedAt: GENERATED_AT }
const emptyRecord = { unlinkedLabs: [], unlinkedAttachments: [] }

/** Collect every `{ reference: "..." }` anywhere in a resource tree. */
function collectReferences(node: unknown, out: string[] = []): string[] {
  if (Array.isArray(node)) {
    for (const item of node) collectReferences(item, out)
  } else if (node && typeof node === "object") {
    for (const [key, value] of Object.entries(node)) {
      if (key === "reference" && typeof value === "string") out.push(value)
      else collectReferences(value, out)
    }
  }
  return out
}

const byType = (bundle: { entry: { resource: FhirResource }[] }, type: string) =>
  bundle.entry.map((e) => e.resource).filter((r) => r.resourceType === type)

describe("buildOpConsultBundle", () => {
  const bundle = buildOpConsultBundle(record, visit)

  it("is a document Bundle whose first entry is the Composition", () => {
    // R4 requires this ordering for document bundles.
    expect(bundle.resourceType).toBe("Bundle")
    expect(bundle.type).toBe("document")
    expect(bundle.entry[0].resource.resourceType).toBe("Composition")
  })

  it("resolves every internal reference to an entry in the same bundle", () => {
    // The single most valuable structural check: a dangling reference makes
    // the whole document unusable to a receiving system.
    const fullUrls = new Set(bundle.entry.map((e) => e.fullUrl))
    const refs = collectReferences(bundle.entry.map((e) => e.resource))
    expect(refs.length).toBeGreaterThan(0)
    for (const r of refs) expect(fullUrls).toContain(r)
  })

  it("gives every entry a fullUrl matching its resource id", () => {
    for (const e of bundle.entry) expect(e.fullUrl).toBe(`urn:uuid:${e.resource.id}`)
  })

  it("assigns unique ids across all resources", () => {
    const ids = bundle.entry.map((e) => e.resource.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("codes the diagnosis with ICD-10", () => {
    const [condition] = byType(bundle, "Condition")
    expect(condition.code).toMatchObject({
      coding: [
        {
          system: "http://hl7.org/fhir/sid/icd-10",
          code: "J06.9",
          display: "Acute upper respiratory infection, unspecified",
        },
      ],
    })
  })

  it("carries the ABHA number and address as Patient identifiers", () => {
    const [p] = byType(bundle, "Patient")
    const identifiers = p.identifier as { system: string; value: string }[]
    expect(identifiers).toContainEqual(
      expect.objectContaining({ system: "https://healthid.abdm.gov.in/ns/abha-number", value: "91112233445564" }),
    )
    expect(identifiers).toContainEqual(
      expect.objectContaining({ system: "https://healthid.abdm.gov.in/ns/abha-address", value: "aarav.shah@sbx" }),
    )
  })

  it("emits one AllergyIntolerance per recorded term, uncoded", () => {
    const allergies = byType(bundle, "AllergyIntolerance")
    expect(allergies).toHaveLength(2)
    expect(allergies.map((a) => (a.code as { text: string }).text)).toEqual(["Penicillin", "Sulfa drugs"])
    // We never invent a SNOMED code for text a clinic typed.
    expect(allergies[0].code).not.toHaveProperty("coding")
  })

  it("emits a LOINC-coded Observation per recorded vital and skips the rest", () => {
    // Filter by category — lab results are Observations too.
    const obs = byType(bundle, "Observation").filter(
      (o) => (o.category as { coding: { code: string }[] }[])[0].coding[0].code === "vital-signs",
    )
    // weight_kg was not recorded, so there must be no weight Observation.
    expect(obs).toHaveLength(5)
    const codes = obs.map((o) => (o.code as { coding: { code: string }[] }).coding[0].code)
    expect(codes).toEqual(["8480-6", "8462-4", "8867-4", "8310-5", "59408-5"])
    expect(obs[0].valueQuantity).toEqual({
      value: 122,
      unit: "mmHg",
      system: "http://unitsofmeasure.org",
      code: "mm[Hg]",
    })
  })

  it("maps prescription items to MedicationRequests with dosage and duration", () => {
    const meds = byType(bundle, "MedicationRequest")
    expect(meds).toHaveLength(2)
    expect(meds[0].medicationCodeableConcept).toEqual({ text: "Augmentin 625 mg" })
    expect(meds[0].dosageInstruction).toEqual([
      {
        text: "1-0-1 · After food",
        timing: {
          repeat: {
            boundsDuration: { value: 5, unit: "d", system: "http://unitsofmeasure.org", code: "d" },
          },
        },
      },
    ])
    // No duration recorded → no bounds invented.
    expect(meds[1].dosageInstruction).toEqual([{ text: "1-1-1" }])
  })

  it("prefers the recorded dob over the age", () => {
    const [p] = byType(bundle, "Patient")
    expect(p.birthDate).toBe("1985-04-12")
  })

  it("is deterministic — the same input exports byte-identical JSON", () => {
    expect(JSON.stringify(buildOpConsultBundle(record, visit))).toBe(
      JSON.stringify(buildOpConsultBundle(record, visit)),
    )
  })
})

describe("uncoded and missing data", () => {
  it("still exports a free-text diagnosis when nothing was coded", () => {
    const b = buildOpConsultBundle(record, { ...visit, diagnosisCodes: [] })
    const conditions = byType(b, "Condition")
    expect(conditions).toHaveLength(1)
    expect(conditions[0].code).toEqual({ text: "Acute upper respiratory infection" })
    // Uncoded means uncoded — no guessed coding block.
    expect(conditions[0].code).not.toHaveProperty("coding")
  })

  it("does not duplicate the diagnosis when it is already coded", () => {
    expect(byType(buildOpConsultBundle(record, visit), "Condition")).toHaveLength(1)
  })

  it("omits sections that have no content", () => {
    const bare = buildOpConsultBundle(
      { ...record, patient: { ...patient, allergies: null } },
      {
        ...visit,
        diagnosis: null,
        diagnosisCodes: [],
        vitals: {},
        medications: [],
        labs: [],
        attachments: [],
      },
    )
    const [composition] = byType(bare, "Composition")
    expect(composition.section).toBeUndefined()
  })

  it("derives a year-only birthDate from age when there is no dob", () => {
    // Year precision is the FHIR way of saying "this is all we know".
    const b = buildOpConsultBundle({ ...record, patient: { ...patient, dob: null } }, visit)
    expect(byType(b, "Patient")[0].birthDate).toBe("1985") // 2026 visit − 41 years
  })

  it("omits birthDate entirely when neither dob nor age is known", () => {
    const b = buildOpConsultBundle(
      { ...record, patient: { ...patient, dob: null, ageYears: null } },
      visit,
    )
    expect(byType(b, "Patient")[0]).not.toHaveProperty("birthDate")
  })

  it("maps an unrecognised gender to unknown rather than dropping it", () => {
    const b = buildOpConsultBundle({ ...record, patient: { ...patient, gender: null } }, visit)
    expect(byType(b, "Patient")[0].gender).toBe("unknown")
  })

  it("omits ABHA identifiers for a patient without one, keeping the local MRN", () => {
    const b = buildOpConsultBundle(
      { ...record, patient: { ...patient, abhaNumber: null, abhaAddress: null } },
      visit,
    )
    const identifiers = byType(b, "Patient")[0].identifier as { system: string }[]
    expect(identifiers).toHaveLength(1)
    expect(identifiers[0].system).toBe("urn:ietf:rfc:3986")
  })
})

describe("labs in the bundle", () => {
  const bundle = buildOpConsultBundle(record, visit)

  it("emits a DiagnosticReport that points at its Observations", () => {
    const [report] = byType(bundle, "DiagnosticReport")
    expect(report.status).toBe("final")
    expect(report.performer).toEqual([{ display: "Metro Diagnostics" }])
    expect(report.result).toHaveLength(2)
  })

  it("emits a numeric result as a Quantity with a reference range and interpretation", () => {
    const obs = byType(bundle, "Observation").find(
      (o) => (o.code as { text?: string }).text === "Haemoglobin",
    )!
    expect(obs.code).toMatchObject({ coding: [{ system: "http://loinc.org", code: "718-7" }] })
    expect(obs.valueQuantity).toEqual({
      value: 9.8,
      unit: "g/dL",
      system: "http://unitsofmeasure.org",
    })
    expect(obs.referenceRange).toEqual([
      { low: { value: 12, unit: "g/dL" }, high: { value: 15, unit: "g/dL" } },
    ])
    expect(obs.interpretation).toEqual([
      {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation",
            code: "L",
            display: "Low",
          },
        ],
      },
    ])
  })

  it("keeps a qualitative result as a string and leaves it uninterpreted", () => {
    const obs = byType(bundle, "Observation").find(
      (o) => (o.code as { text?: string }).text === "Dengue NS1 Antigen",
    )!
    expect(obs.valueString).toBe("Negative")
    expect(obs).not.toHaveProperty("valueQuantity")
    // No LOINC we can vouch for, and no flag was set — neither gets invented.
    expect(obs.code).not.toHaveProperty("coding")
    expect(obs).not.toHaveProperty("interpretation")
  })

  it("does not emit an Observation for a test with no result yet", () => {
    const pending = {
      ...visit,
      labs: [
        {
          ...visit.labs[0],
          status: "ordered",
          resultedAt: null,
          results: visit.labs[0].results.map((r) => ({ ...r, valueText: null, valueNumber: null })),
        },
      ],
    }
    const b = buildOpConsultBundle(record, pending)
    expect(byType(b, "Observation").filter((o) => (o.category as { coding: { code: string }[] }[])[0].coding[0].code === "laboratory")).toHaveLength(0)
    expect(byType(b, "DiagnosticReport")[0].status).toBe("registered")
    expect(byType(b, "DiagnosticReport")[0]).not.toHaveProperty("result")
  })
})

describe("attachments in the bundle", () => {
  const bundle = buildOpConsultBundle(record, visit)

  it("emits a DocumentReference describing the file", () => {
    const [doc] = byType(bundle, "DocumentReference")
    expect(doc.status).toBe("current")
    expect(doc.type).toEqual({ text: "Lab report" })
    expect(doc.content).toEqual([
      {
        attachment: {
          contentType: "application/pdf",
          title: "cbc-report.pdf",
          creation: "2026-07-21T09:00:00.000Z",
        },
      },
    ])
  })

  it("never embeds a storage URL", () => {
    // Our links are short-lived signed URLs — one in an exported bundle would
    // either expire in the recipient's hands or leak private-bucket access.
    const [doc] = byType(bundle, "DocumentReference")
    expect(JSON.stringify(doc)).not.toContain("http")
  })

  it("lists investigations and documents as Composition sections", () => {
    const [composition] = byType(bundle, "Composition")
    const titles = (composition.section as { title: string }[]).map((s) => s.title)
    expect(titles).toContain("Investigations")
    expect(titles).toContain("Documents")
  })

  it("keeps every reference resolvable once labs and files are included", () => {
    const fullUrls = new Set(bundle.entry.map((e) => e.fullUrl))
    for (const r of collectReferences(bundle.entry.map((e) => e.resource))) {
      expect(fullUrls).toContain(r)
    }
  })
})

describe("buildPatientRecordBundle", () => {
  it("wraps each visit as a nested document Bundle", () => {
    const second = { ...visit, id: "44444444-4444-4444-4444-444444444444" }
    const b = buildPatientRecordBundle({
      clinic,
      patient,
      visits: [visit, second],
      ...emptyRecord,
      generatedAt: GENERATED_AT,
    })
    expect(b.type).toBe("collection")
    expect(b.entry).toHaveLength(2)
    expect(b.entry.every((e) => e.resource.resourceType === "Bundle")).toBe(true)
  })

  it("exports demographics for a patient with no visits rather than nothing", () => {
    const b = buildPatientRecordBundle({
      clinic,
      patient,
      visits: [],
      ...emptyRecord,
      generatedAt: GENERATED_AT,
    })
    const doc = b.entry[0].resource as unknown as { entry: { resource: FhirResource }[] }
    const types = doc.entry.map((e) => e.resource.resourceType)
    expect(types).toContain("Patient")
    expect(types).toContain("Practitioner")
    expect(types).toContain("Organization")
    expect(types.filter((t) => t === "AllergyIntolerance")).toHaveLength(2)
  })

  it("gives labs and files with no visit their own 'Records on file' document", () => {
    // These must not be attributed to a consultation that did not produce
    // them, and must not be dropped either.
    const b = buildPatientRecordBundle({
      clinic,
      patient,
      visits: [visit],
      unlinkedLabs: visit.labs,
      unlinkedAttachments: visit.attachments,
      generatedAt: GENERATED_AT,
    })
    expect(b.entry).toHaveLength(2)
    const onFile = b.entry[1].resource as unknown as { entry: { resource: FhirResource }[] }
    const composition = onFile.entry[0].resource
    expect(composition.title).toBe("Records on file")
    // No visit, so no Encounter and nothing referencing one.
    expect(composition).not.toHaveProperty("encounter")
    expect(onFile.entry.map((e) => e.resource.resourceType)).not.toContain("Encounter")
    expect(onFile.entry.filter((e) => e.resource.resourceType === "DiagnosticReport")).toHaveLength(1)
    expect(onFile.entry.filter((e) => e.resource.resourceType === "DocumentReference")).toHaveLength(1)
  })

  it("keeps every reference resolvable inside the Records-on-file document", () => {
    const b = buildPatientRecordBundle({
      clinic,
      patient,
      visits: [],
      unlinkedLabs: visit.labs,
      unlinkedAttachments: visit.attachments,
      generatedAt: GENERATED_AT,
    })
    const onFile = b.entry[0].resource as unknown as {
      entry: { fullUrl: string; resource: FhirResource }[]
    }
    const fullUrls = new Set(onFile.entry.map((e) => e.fullUrl))
    const refs = collectReferences(onFile.entry.map((e) => e.resource))
    expect(refs.length).toBeGreaterThan(0)
    for (const r of refs) expect(fullUrls).toContain(r)
  })
})

describe("splitAllergyTerms", () => {
  it("splits on the separators clinics actually type", () => {
    expect(splitAllergyTerms("Penicillin, Sulfa; Dust / Pollen")).toEqual([
      "Penicillin",
      "Sulfa",
      "Dust",
      "Pollen",
    ])
  })

  it("returns nothing for empty input", () => {
    expect(splitAllergyTerms(null)).toEqual([])
    expect(splitAllergyTerms("   ")).toEqual([])
  })
})

/**
 * FHIR R4 export — pure mapping, no I/O. Data loading lives in `record.ts`.
 *
 * ── Scope and honesty ────────────────────────────────────────────────
 * This emits **valid FHIR R4** shaped along ABDM's OPConsultRecord: one
 * `document` Bundle per visit (Composition first, as R4 requires), and a
 * `collection` Bundle wrapping them for a whole-patient export.
 *
 * It is NOT certified against the NDHM StructureDefinitions. Conformance
 * to the published profiles is verified during NHA's M2 milestone, which
 * needs sandbox credentials the clinic must obtain. Everything a validator
 * would check mechanically — required fields, reference integrity, code
 * systems, cardinality — is correct here; profile assertions are not
 * claimed anywhere in the output.
 *
 * ── Determinism ──────────────────────────────────────────────────────
 * Every id is derived from a database UUID and every timestamp is passed
 * in by the caller. The same record always exports byte-identical JSON,
 * which is what makes the whole thing testable.
 */

// ─── Terminology ─────────────────────────────────────────────────────
// Centralised so certification-time corrections are a one-line change.
const SYS = {
  snomed: "http://snomed.info/sct",
  loinc: "http://loinc.org",
  icd10: "http://hl7.org/fhir/sid/icd-10",
  ucum: "http://unitsofmeasure.org",
  actCode: "http://terminology.hl7.org/CodeSystem/v3-ActCode",
  allergyClinical: "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical",
  identifierType: "http://terminology.hl7.org/CodeSystem/v2-0203",
  obsCategory: "http://terminology.hl7.org/CodeSystem/observation-category",
  obsInterpretation: "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation",
  /** ABDM identifier namespaces. Revisit at certification. */
  abhaNumber: "https://healthid.abdm.gov.in/ns/abha-number",
  abhaAddress: "https://healthid.abdm.gov.in/ns/abha-address",
} as const

// ─── Input shapes (plain data — mirrors the DB, not FHIR) ────────────

export type FhirClinicInput = {
  id: string
  name: string
  address: string | null
  phone: string | null
  doctorName: string
  qualifications: string | null
  registrationNo: string | null
  specialty: string | null
}

export type FhirPatientInput = {
  id: string
  fullName: string
  phone: string
  gender: string | null
  dob: string | null
  ageYears: number | null
  address: string | null
  abhaNumber: string | null
  abhaAddress: string | null
  /** Free text, as stored. Split into one AllergyIntolerance per term. */
  allergies: string | null
}

export type FhirVitals = Partial<{
  bp_sys: number
  bp_dia: number
  pulse: number
  temp_f: number
  weight_kg: number
  spo2: number
}>

export type FhirMedicationInput = {
  name: string
  dosage: string | null
  durationDays: number | null
  instructions: string | null
}

export type FhirLabResultInput = {
  id: string
  testName: string
  loincCode: string | null
  valueText: string | null
  valueNumber: number | null
  unit: string | null
  referenceLow: number | null
  referenceHigh: number | null
  referenceText: string | null
  /** low | normal | high | abnormal, or null when not interpreted. */
  flag: string | null
  note: string | null
}

export type FhirLabOrderInput = {
  id: string
  status: string
  labName: string | null
  orderedAt: string
  resultedAt: string | null
  results: FhirLabResultInput[]
}

export type FhirAttachmentInput = {
  id: string
  fileName: string
  mimeType: string | null
  kind: string
  note: string | null
  createdAt: string
}

export type FhirVisitInput = {
  id: string
  visitDate: string
  createdAt: string
  complaints: string | null
  diagnosis: string | null
  /** Resolved ICD-10 codes attached to this visit. */
  diagnosisCodes: { code: string; title: string }[]
  advice: string | null
  followupDate: string | null
  vitals: FhirVitals
  medications: FhirMedicationInput[]
  labs: FhirLabOrderInput[]
  attachments: FhirAttachmentInput[]
}

export type FhirRecordInput = {
  clinic: FhirClinicInput
  patient: FhirPatientInput
  visits: FhirVisitInput[]
  /**
   * Labs and files recorded against the patient but not against any visit —
   * an old report brought in, a scan uploaded from the profile. They get their
   * own "Records on file" document rather than being attributed to a
   * consultation that did not produce them.
   */
  unlinkedLabs: FhirLabOrderInput[]
  unlinkedAttachments: FhirAttachmentInput[]
  /** ISO timestamp stamped on the bundles. Passed in, never read from the clock. */
  generatedAt: string
}

// ─── Output shapes ───────────────────────────────────────────────────

export type FhirResource = { resourceType: string; id: string } & Record<string, unknown>
export type FhirEntry = { fullUrl: string; resource: FhirResource }
export type FhirBundle = {
  resourceType: "Bundle"
  id: string
  type: "document" | "collection"
  timestamp: string
  entry: FhirEntry[]
} & Record<string, unknown>

// ─── Helpers ─────────────────────────────────────────────────────────

const urn = (id: string) => `urn:uuid:${id}`
const ref = (id: string) => ({ reference: urn(id) })

/**
 * Derive a stable resource id from the row's UUID plus a discriminator, so
 * one visit row can yield several resources without id collisions and
 * without a random generator.
 */
const derive = (uuid: string, suffix: string) => `${uuid}-${suffix}`

/** FHIR Patient.gender is a closed value set; anything else is `unknown`. */
function fhirGender(gender: string | null): "male" | "female" | "other" | "unknown" {
  if (gender === "male" || gender === "female" || gender === "other") return gender
  return "unknown"
}

/**
 * FHIR partial dates carry their own precision. When we only know an age,
 * a year-only `birthDate` is the standard-correct way to say "this is all
 * the precision there is" — rather than inventing a full date. It is still
 * ±1 year, since the birthday may not have passed in the reference year.
 */
function birthDate(patient: FhirPatientInput, referenceDate: string): string | undefined {
  if (patient.dob) return patient.dob
  if (patient.ageYears == null) return undefined
  const year = Number(referenceDate.slice(0, 4))
  if (!Number.isFinite(year)) return undefined
  return String(year - patient.ageYears)
}

/** Split free-text allergies the same way the safety engine does. */
export function splitAllergyTerms(text: string | null): string[] {
  if (!text) return []
  return text
    .split(/[,;/\n]/)
    .map((t) => t.trim())
    .filter(Boolean)
}

// ─── Resource builders ───────────────────────────────────────────────

function patientResource(p: FhirPatientInput, referenceDate: string): FhirResource {
  const identifier: Record<string, unknown>[] = []
  if (p.abhaNumber) {
    identifier.push({ system: SYS.abhaNumber, value: p.abhaNumber, use: "official" })
  }
  if (p.abhaAddress) {
    identifier.push({ system: SYS.abhaAddress, value: p.abhaAddress, use: "official" })
  }
  identifier.push({
    system: "urn:ietf:rfc:3986",
    value: urn(p.id),
    use: "secondary",
    type: { coding: [{ system: SYS.identifierType, code: "MR", display: "Medical record number" }] },
  })

  const bd = birthDate(p, referenceDate)
  return {
    resourceType: "Patient",
    id: p.id,
    identifier,
    name: [{ text: p.fullName }],
    telecom: [{ system: "phone", value: p.phone, use: "mobile" }],
    gender: fhirGender(p.gender),
    ...(bd ? { birthDate: bd } : {}),
    ...(p.address ? { address: [{ text: p.address }] } : {}),
  }
}

function practitionerResource(c: FhirClinicInput): FhirResource {
  return {
    resourceType: "Practitioner",
    id: derive(c.id, "practitioner"),
    ...(c.registrationNo
      ? {
          identifier: [
            {
              system: "https://nmc.org.in/ns/registration-number",
              value: c.registrationNo,
              type: {
                coding: [{ system: SYS.identifierType, code: "MD", display: "Medical License number" }],
              },
            },
          ],
        }
      : {}),
    name: [{ text: c.doctorName }],
    ...(c.qualifications ? { qualification: [{ code: { text: c.qualifications } }] } : {}),
  }
}

function organizationResource(c: FhirClinicInput): FhirResource {
  const telecom: Record<string, unknown>[] = []
  if (c.phone) telecom.push({ system: "phone", value: c.phone })
  return {
    resourceType: "Organization",
    id: c.id,
    name: c.name,
    ...(telecom.length ? { telecom } : {}),
    ...(c.address ? { address: [{ text: c.address }] } : {}),
  }
}

function encounterResource(v: FhirVisitInput, patientId: string, orgId: string): FhirResource {
  return {
    resourceType: "Encounter",
    id: v.id,
    status: "finished",
    class: { system: SYS.actCode, code: "AMB", display: "ambulatory" },
    subject: ref(patientId),
    period: { start: v.createdAt },
    serviceProvider: ref(orgId),
  }
}

function conditionResources(v: FhirVisitInput, patientId: string): FhirResource[] {
  const out: FhirResource[] = []

  // One Condition per ICD-10 code — these are the machine-readable ones.
  v.diagnosisCodes.forEach((dc, i) => {
    out.push({
      resourceType: "Condition",
      id: derive(v.id, `condition-${i}`),
      subject: ref(patientId),
      encounter: ref(v.id),
      recordedDate: v.createdAt,
      code: {
        coding: [{ system: SYS.icd10, code: dc.code, display: dc.title }],
        text: dc.title,
      },
    })
  })

  // The doctor's free-text diagnosis is the primary record in ClinicFlow and
  // must survive export even when nothing was coded. Emitted as an uncoded
  // Condition — `code.text` with no `coding` is valid R4 and says plainly
  // "this was never coded", rather than guessing at a code.
  if (v.diagnosis && v.diagnosisCodes.length === 0) {
    out.push({
      resourceType: "Condition",
      id: derive(v.id, "condition-text"),
      subject: ref(patientId),
      encounter: ref(v.id),
      recordedDate: v.createdAt,
      code: { text: v.diagnosis },
    })
  }

  return out
}

function allergyResources(p: FhirPatientInput, recordedDate: string): FhirResource[] {
  return splitAllergyTerms(p.allergies).map((term, i) => ({
    resourceType: "AllergyIntolerance",
    id: derive(p.id, `allergy-${i}`),
    clinicalStatus: {
      coding: [{ system: SYS.allergyClinical, code: "active", display: "Active" }],
    },
    patient: ref(p.id),
    recordedDate,
    // Free text, uncoded: the clinic typed a term, we did not map it to
    // SNOMED. Claiming a code here would be inventing clinical data.
    code: { text: term },
  }))
}

type VitalSpec = {
  key: keyof FhirVitals
  loinc: string
  display: string
  unit: string
  ucum: string
}

const VITALS: VitalSpec[] = [
  { key: "bp_sys", loinc: "8480-6", display: "Systolic blood pressure", unit: "mmHg", ucum: "mm[Hg]" },
  { key: "bp_dia", loinc: "8462-4", display: "Diastolic blood pressure", unit: "mmHg", ucum: "mm[Hg]" },
  { key: "pulse", loinc: "8867-4", display: "Heart rate", unit: "/min", ucum: "/min" },
  { key: "temp_f", loinc: "8310-5", display: "Body temperature", unit: "°F", ucum: "[degF]" },
  { key: "weight_kg", loinc: "29463-7", display: "Body weight", unit: "kg", ucum: "kg" },
  { key: "spo2", loinc: "59408-5", display: "Oxygen saturation by pulse oximetry", unit: "%", ucum: "%" },
]

function vitalResources(v: FhirVisitInput, patientId: string): FhirResource[] {
  const out: FhirResource[] = []
  for (const spec of VITALS) {
    const value = v.vitals?.[spec.key]
    if (typeof value !== "number" || !Number.isFinite(value)) continue
    out.push({
      resourceType: "Observation",
      id: derive(v.id, `vital-${spec.key}`),
      status: "final",
      category: [
        {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/observation-category",
              code: "vital-signs",
              display: "Vital Signs",
            },
          ],
        },
      ],
      code: { coding: [{ system: SYS.loinc, code: spec.loinc, display: spec.display }] },
      subject: ref(patientId),
      encounter: ref(v.id),
      effectiveDateTime: v.createdAt,
      valueQuantity: { value, unit: spec.unit, system: SYS.ucum, code: spec.ucum },
    })
  }
  return out
}

function medicationResources(
  v: FhirVisitInput,
  patientId: string,
  practitionerId: string,
): FhirResource[] {
  return v.medications.map((m, i) => {
    const text = [m.dosage, m.instructions].filter(Boolean).join(" · ")
    const dosage: Record<string, unknown> = {}
    if (text) dosage.text = text
    if (m.durationDays) {
      dosage.timing = { repeat: { boundsDuration: { value: m.durationDays, unit: "d", system: SYS.ucum, code: "d" } } }
    }
    return {
      resourceType: "MedicationRequest",
      id: derive(v.id, `medication-${i}`),
      status: "active",
      intent: "order",
      // Uncoded on purpose: ClinicFlow's medicine list is curated, not a
      // licensed coded drug dictionary, so there is no defensible code to
      // emit. `text` is what the doctor actually prescribed.
      medicationCodeableConcept: { text: m.name },
      subject: ref(patientId),
      encounter: ref(v.id),
      authoredOn: v.createdAt,
      requester: ref(practitionerId),
      ...(Object.keys(dosage).length ? { dosageInstruction: [dosage] } : {}),
    }
  })
}

/** FHIR v3-ObservationInterpretation codes for our four flags. */
const INTERPRETATION: Record<string, { code: string; display: string }> = {
  low: { code: "L", display: "Low" },
  high: { code: "H", display: "High" },
  normal: { code: "N", display: "Normal" },
  abnormal: { code: "A", display: "Abnormal" },
}

function labObservation(
  r: FhirLabResultInput,
  patientId: string,
  encounterId: string | null,
  effective: string,
): FhirResource {
  // A numeric result with a unit is a real Quantity; anything else ("Negative",
  // "<0.01") stays a string rather than being coerced into a number.
  const value =
    r.valueNumber != null && r.unit
      ? { valueQuantity: { value: r.valueNumber, unit: r.unit, system: SYS.ucum } }
      : r.valueText
        ? { valueString: r.valueText }
        : {}

  const range: Record<string, unknown> = {}
  if (r.referenceLow != null) range.low = { value: r.referenceLow, ...(r.unit ? { unit: r.unit } : {}) }
  if (r.referenceHigh != null) range.high = { value: r.referenceHigh, ...(r.unit ? { unit: r.unit } : {}) }
  if (r.referenceText) range.text = r.referenceText

  const interp = r.flag ? INTERPRETATION[r.flag] : undefined

  return {
    resourceType: "Observation",
    id: r.id,
    status: "final",
    category: [
      { coding: [{ system: SYS.obsCategory, code: "laboratory", display: "Laboratory" }] },
    ],
    // Coded only when the catalogue carries a LOINC we are sure of; otherwise
    // the test name alone, which is honest rather than a guessed code.
    code: r.loincCode
      ? { coding: [{ system: SYS.loinc, code: r.loincCode, display: r.testName }], text: r.testName }
      : { text: r.testName },
    subject: ref(patientId),
    ...(encounterId ? { encounter: ref(encounterId) } : {}),
    effectiveDateTime: effective,
    ...value,
    ...(Object.keys(range).length ? { referenceRange: [range] } : {}),
    ...(interp
      ? {
          interpretation: [
            { coding: [{ system: SYS.obsInterpretation, code: interp.code, display: interp.display }] },
          ],
        }
      : {}),
    ...(r.note ? { note: [{ text: r.note }] } : {}),
  }
}

const REPORT_STATUS: Record<string, string> = {
  ordered: "registered",
  collected: "registered",
  resulted: "final",
  cancelled: "cancelled",
}

function labResources(
  orders: FhirLabOrderInput[],
  patientId: string,
  encounterId: string | null,
): { reports: FhirResource[]; observations: FhirResource[] } {
  const reports: FhirResource[] = []
  const observations: FhirResource[] = []

  for (const order of orders) {
    const effective = order.resultedAt ?? order.orderedAt
    // Only resulted tests become Observations — an ordered-but-unresulted test
    // has nothing to observe, and emitting an empty one would imply it does.
    const resulted = order.results.filter((r) => r.valueText)
    const obs = resulted.map((r) => labObservation(r, patientId, encounterId, effective))
    observations.push(...obs)

    reports.push({
      resourceType: "DiagnosticReport",
      id: order.id,
      status: REPORT_STATUS[order.status] ?? "registered",
      category: [
        { coding: [{ system: SYS.obsCategory, code: "laboratory", display: "Laboratory" }] },
      ],
      code: { text: order.results.map((r) => r.testName).join(", ") || "Laboratory report" },
      subject: ref(patientId),
      ...(encounterId ? { encounter: ref(encounterId) } : {}),
      effectiveDateTime: order.orderedAt,
      ...(order.resultedAt ? { issued: order.resultedAt } : {}),
      // A display-only performer: we know the lab's name, not its FHIR identity.
      ...(order.labName ? { performer: [{ display: order.labName }] } : {}),
      ...(obs.length ? { result: obs.map((o) => ref(o.id)) } : {}),
    })
  }

  return { reports, observations }
}

const ATTACHMENT_TYPE_TEXT: Record<string, string> = {
  scan: "Scan / X-ray",
  lab_report: "Lab report",
  discharge: "Discharge summary",
  photo: "Clinical photo",
  other: "Document",
}

function documentReferences(
  attachments: FhirAttachmentInput[],
  patientId: string,
  encounterId: string | null,
): FhirResource[] {
  return attachments.map((a) => ({
    resourceType: "DocumentReference",
    id: a.id,
    status: "current",
    type: { text: ATTACHMENT_TYPE_TEXT[a.kind] ?? "Document" },
    subject: ref(patientId),
    date: a.createdAt,
    ...(a.note ? { description: a.note } : {}),
    // Deliberately no `url`: our storage links are short-lived signed URLs, so
    // embedding one would either expire in the recipient's hands or leak read
    // access to a private bucket. The export states that the document exists
    // and what it is; fetching it stays an explicit, authenticated act.
    content: [
      {
        attachment: {
          ...(a.mimeType ? { contentType: a.mimeType } : {}),
          title: a.fileName,
          creation: a.createdAt,
        },
      },
    ],
    ...(encounterId ? { context: { encounter: [ref(encounterId)] } } : {}),
  }))
}

// ─── Bundles ─────────────────────────────────────────────────────────

const section = (title: string, code: { system: string; code: string; display: string } | null, ids: string[]) => ({
  title,
  ...(code ? { code: { coding: [code] } } : {}),
  entry: ids.map(ref),
})

type DocumentSource = {
  /** Id root for the bundle and its Composition. */
  root: string
  /** null for the visit-less "Records on file" document. */
  visit: FhirVisitInput | null
  labs: FhirLabOrderInput[]
  attachments: FhirAttachmentInput[]
  title: string
  date: string
  /** Reference date for deriving a year-only birthDate. */
  referenceDate: string
}

/**
 * The shared document builder. A `document` Bundle whose first entry is the
 * Composition, as R4 mandates.
 *
 * With a visit this is an ABDM-shaped OPConsultRecord. Without one it is a
 * "Records on file" document holding labs and files that belong to the patient
 * but to no consultation — those must not be attributed to a visit that did
 * not produce them, and must not be dropped either.
 */
function buildDocumentBundle(
  input: Omit<FhirRecordInput, "visits" | "unlinkedLabs" | "unlinkedAttachments">,
  src: DocumentSource,
): FhirBundle {
  const { clinic, patient, generatedAt } = input
  const { visit } = src

  const practitioner = practitionerResource(clinic)
  const organization = organizationResource(clinic)
  const patientRes = patientResource(patient, src.referenceDate)
  const encounter = visit ? encounterResource(visit, patient.id, clinic.id) : null

  const conditions = visit ? conditionResources(visit, patient.id) : []
  const allergies = allergyResources(patient, src.date)
  const vitals = visit ? vitalResources(visit, patient.id) : []
  const medications = visit ? medicationResources(visit, patient.id, practitioner.id) : []
  const { reports, observations } = labResources(src.labs, patient.id, visit?.id ?? null)
  const documents = documentReferences(src.attachments, patient.id, visit?.id ?? null)

  const sections: Record<string, unknown>[] = []
  if (conditions.length) {
    sections.push(
      section("Diagnosis", { system: SYS.snomed, code: "422735006", display: "Summary clinical document" }, conditions.map((c) => c.id)),
    )
  }
  if (medications.length) {
    sections.push(
      section("Medications", { system: SYS.snomed, code: "440545006", display: "Prescription record" }, medications.map((m) => m.id)),
    )
  }
  if (allergies.length) {
    sections.push(section("Allergies", null, allergies.map((a) => a.id)))
  }
  if (vitals.length) {
    sections.push(section("Vital signs", null, vitals.map((o) => o.id)))
  }
  if (reports.length) {
    sections.push(section("Investigations", null, reports.map((r) => r.id)))
  }
  if (documents.length) {
    sections.push(section("Documents", null, documents.map((d) => d.id)))
  }

  const composition: FhirResource = {
    resourceType: "Composition",
    id: derive(src.root, "composition"),
    status: "final",
    type: {
      coding: [{ system: SYS.snomed, code: "371530004", display: "Clinical consultation report" }],
      text: src.title,
    },
    subject: ref(patient.id),
    ...(visit ? { encounter: ref(visit.id) } : {}),
    date: src.date,
    author: [ref(practitioner.id)],
    title: src.title,
    custodian: ref(clinic.id),
    ...(sections.length ? { section: sections } : {}),
  }

  const resources = [
    composition,
    patientRes,
    practitioner,
    organization,
    ...(encounter ? [encounter] : []),
    ...conditions,
    ...allergies,
    ...vitals,
    ...medications,
    ...reports,
    ...observations,
    ...documents,
  ]

  return {
    resourceType: "Bundle",
    id: derive(src.root, "bundle"),
    type: "document",
    timestamp: generatedAt,
    identifier: { system: "urn:ietf:rfc:3986", value: urn(derive(src.root, "bundle")) },
    entry: resources.map((resource) => ({ fullUrl: urn(resource.id), resource })),
  }
}

/** One visit as an ABDM-shaped OPConsultRecord document Bundle. */
export function buildOpConsultBundle(
  input: Omit<FhirRecordInput, "visits" | "unlinkedLabs" | "unlinkedAttachments">,
  visit: FhirVisitInput,
): FhirBundle {
  return buildDocumentBundle(input, {
    root: visit.id,
    visit,
    labs: visit.labs,
    attachments: visit.attachments,
    title: "OP Consultation Record",
    date: visit.createdAt,
    referenceDate: visit.visitDate,
  })
}

/**
 * The patient's whole record: a `collection` Bundle of per-visit document
 * Bundles. Nesting Bundles is legal R4 and mirrors how ABDM transfers a
 * set of care contexts.
 *
 * A patient with no visits still exports — as a collection holding the
 * demographic resources — so an export never silently returns nothing.
 */
export function buildPatientRecordBundle(input: FhirRecordInput): FhirBundle {
  const { clinic, patient, visits, unlinkedLabs, unlinkedAttachments, generatedAt } = input
  const base = { clinic, patient, generatedAt }

  const resources: FhirResource[] = visits.map(
    (v) => buildOpConsultBundle(base, v) as unknown as FhirResource,
  )

  // Anything not tied to a consultation gets its own document — and a patient
  // with nothing at all still exports one, so an export is never empty.
  if (unlinkedLabs.length > 0 || unlinkedAttachments.length > 0 || visits.length === 0) {
    resources.push(
      buildDocumentBundle(base, {
        root: derive(patient.id, "onfile"),
        visit: null,
        labs: unlinkedLabs,
        attachments: unlinkedAttachments,
        title: "Records on file",
        date: generatedAt,
        referenceDate: generatedAt,
      }) as unknown as FhirResource,
    )
  }

  return {
    resourceType: "Bundle",
    id: derive(patient.id, "record"),
    type: "collection",
    timestamp: generatedAt,
    entry: resources.map((resource) => ({
      fullUrl: urn(resource.id),
      resource,
    })),
  }
}

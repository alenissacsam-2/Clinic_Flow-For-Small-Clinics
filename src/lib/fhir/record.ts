import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"
import type {
  FhirRecordInput,
  FhirVisitInput,
  FhirVitals,
  FhirLabOrderInput,
  FhirAttachmentInput,
} from "./bundle"

/**
 * Assemble the FHIR input for one patient from the DB. The caller supplies a
 * scoped client, so RLS decides what is visible — this function adds no
 * access control of its own.
 *
 * Returns null when the patient is not visible, which the route turns into a
 * 404 (never a 403, which would confirm the id exists to a caller who cannot
 * see it).
 */
export async function getFhirRecord(
  supabase: SupabaseClient<Database>,
  patientId: string,
  generatedAt: string,
): Promise<FhirRecordInput | null> {
  const { data: patient } = await supabase
    .from("patients")
    .select(
      "id, clinic_id, full_name, phone, gender, dob, age_years, address, abha_number, abha_address, allergies",
    )
    .eq("id", patientId)
    .is("deleted_at", null)
    .maybeSingle()

  if (!patient) return null

  const [{ data: clinic }, { data: visitRows }, { data: labRows }, { data: fileRows }] = await Promise.all([
    supabase
      .from("clinics")
      .select("id, name, address, phone, doctor_name, qualifications, registration_no, specialty")
      .eq("id", patient.clinic_id)
      .maybeSingle(),
    supabase
      .from("visits")
      .select(
        "id, visit_date, created_at, complaints, diagnosis, diagnosis_codes, advice, followup_date, vitals, prescriptions(prescription_items(medicine_name, dosage, duration_days, instructions, position))",
      )
      .eq("patient_id", patientId)
      .order("visit_date", { ascending: false }),
    supabase
      .from("lab_orders")
      .select(
        "id, visit_id, status, lab_name, ordered_at, resulted_at, items:lab_order_items(id, test_name, loinc_code, unit, value_text, value_number, reference_low, reference_high, reference_text, flag, note, position)",
      )
      .eq("patient_id", patientId)
      .order("ordered_at", { ascending: false }),
    supabase
      .from("visit_attachments")
      .select("id, visit_id, file_name, mime_type, kind, note, created_at")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false }),
  ])

  if (!clinic) return null

  const rows = visitRows ?? []

  // Resolve ICD-10 titles in one round trip rather than per visit.
  const codes = [...new Set(rows.flatMap((v) => v.diagnosis_codes ?? []))]
  const titles = new Map<string, string>()
  if (codes.length > 0) {
    const { data: icd } = await supabase.from("icd10_codes").select("code, title").in("code", codes)
    for (const row of icd ?? []) titles.set(row.code, row.title)
  }

  type RxRow = {
    prescription_items: {
      medicine_name: string
      dosage: string | null
      duration_days: number | null
      instructions: string | null
      position: number
    }[]
  }

  // Group labs and files by the visit they belong to. Anything with a NULL
  // visit_id goes to the "Records on file" bucket rather than being attributed
  // to a consultation that did not produce it.
  const labsByVisit = new Map<string, FhirLabOrderInput[]>()
  const unlinkedLabs: FhirLabOrderInput[] = []
  for (const o of labRows ?? []) {
    const order: FhirLabOrderInput = {
      id: o.id,
      status: o.status,
      labName: o.lab_name,
      orderedAt: o.ordered_at,
      resultedAt: o.resulted_at,
      results: [...(o.items ?? [])]
        .sort((a, b) => a.position - b.position)
        .map((i) => ({
          id: i.id,
          testName: i.test_name,
          loincCode: i.loinc_code,
          valueText: i.value_text,
          valueNumber: i.value_number,
          unit: i.unit,
          referenceLow: i.reference_low,
          referenceHigh: i.reference_high,
          referenceText: i.reference_text,
          flag: i.flag,
          note: i.note,
        })),
    }
    if (o.visit_id) {
      const list = labsByVisit.get(o.visit_id) ?? []
      list.push(order)
      labsByVisit.set(o.visit_id, list)
    } else {
      unlinkedLabs.push(order)
    }
  }

  const filesByVisit = new Map<string, FhirAttachmentInput[]>()
  const unlinkedAttachments: FhirAttachmentInput[] = []
  for (const f of fileRows ?? []) {
    const att: FhirAttachmentInput = {
      id: f.id,
      fileName: f.file_name,
      mimeType: f.mime_type,
      kind: f.kind,
      note: f.note,
      createdAt: f.created_at,
    }
    if (f.visit_id) {
      const list = filesByVisit.get(f.visit_id) ?? []
      list.push(att)
      filesByVisit.set(f.visit_id, list)
    } else {
      unlinkedAttachments.push(att)
    }
  }

  const visits: FhirVisitInput[] = rows.map((v) => {
    const items = ((v.prescriptions ?? []) as unknown as RxRow[])
      .flatMap((rx) => rx.prescription_items ?? [])
      .slice()
      .sort((a, b) => a.position - b.position)

    return {
      id: v.id,
      visitDate: v.visit_date,
      createdAt: v.created_at,
      complaints: v.complaints,
      diagnosis: v.diagnosis,
      diagnosisCodes: (v.diagnosis_codes ?? []).map((code) => ({
        code,
        // A code with no row in icd10_codes still exports — falling back to
        // the code itself beats dropping a recorded diagnosis.
        title: titles.get(code) ?? code,
      })),
      advice: v.advice,
      followupDate: v.followup_date,
      vitals: (v.vitals ?? {}) as FhirVitals,
      medications: items.map((i) => ({
        name: i.medicine_name,
        dosage: i.dosage,
        durationDays: i.duration_days,
        instructions: i.instructions,
      })),
      labs: labsByVisit.get(v.id) ?? [],
      attachments: filesByVisit.get(v.id) ?? [],
    }
  })

  return {
    clinic: {
      id: clinic.id,
      name: clinic.name,
      address: clinic.address,
      phone: clinic.phone,
      doctorName: clinic.doctor_name,
      qualifications: clinic.qualifications,
      registrationNo: clinic.registration_no,
      specialty: clinic.specialty,
    },
    patient: {
      id: patient.id,
      fullName: patient.full_name,
      phone: patient.phone,
      gender: patient.gender,
      dob: patient.dob,
      ageYears: patient.age_years,
      address: patient.address,
      abhaNumber: patient.abha_number,
      abhaAddress: patient.abha_address,
      allergies: patient.allergies,
    },
    visits,
    unlinkedLabs,
    unlinkedAttachments,
    generatedAt,
  }
}

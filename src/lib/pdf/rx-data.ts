import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"
import { formatISTDate, formatPhoneDisplay } from "@/lib/format"
import { logoUrlFromPath } from "@/lib/clinic"
import type { RxData } from "./rx-document"

type Vitals = Partial<{
  bp_sys: number
  bp_dia: number
  pulse: number
  temp_f: number
  weight_kg: number
  spo2: number
}>

function vitalsToList(v: Vitals): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = []
  if (v.bp_sys && v.bp_dia) out.push({ label: "BP", value: `${v.bp_sys}/${v.bp_dia}` })
  if (v.pulse) out.push({ label: "Pulse", value: `${v.pulse}/min` })
  if (v.temp_f) out.push({ label: "Temp", value: `${v.temp_f} °F` })
  if (v.weight_kg) out.push({ label: "Weight", value: `${v.weight_kg} kg` })
  if (v.spo2) out.push({ label: "SpO₂", value: `${v.spo2}%` })
  return out
}

/**
 * Assemble the full RxData for a prescription from the DB. The caller supplies
 * a scoped client (user session for the doctor route, service role for sending).
 */
export async function getRxData(
  supabase: SupabaseClient<Database>,
  prescriptionId: string,
): Promise<RxData | null> {
  const { data: rx } = await supabase
    .from("prescriptions")
    .select(
      "id, created_at, clinic:clinics(name, address, phone, doctor_name, qualifications, registration_no, specialty, logo_path), patient:patients(full_name, age_years, gender, phone), visit:visits(vitals, complaints, diagnosis, advice, followup_date), items:prescription_items(medicine_name, dosage, duration_days, instructions, position)",
    )
    .eq("id", prescriptionId)
    .maybeSingle()

  if (!rx || !rx.clinic || !rx.patient) return null

  const clinic = rx.clinic as unknown as {
    name: string
    address: string | null
    phone: string | null
    doctor_name: string
    qualifications: string | null
    registration_no: string | null
    specialty: string | null
    logo_path: string | null
  }
  const patient = rx.patient as unknown as {
    full_name: string
    age_years: number | null
    gender: string | null
    phone: string
  }
  const visit = (rx.visit ?? null) as unknown as {
    vitals: Vitals
    complaints: string | null
    diagnosis: string | null
    advice: string | null
    followup_date: string | null
  } | null

  type ItemRow = RxData["items"][number] & { position: number }
  const items = ((rx.items ?? []) as unknown as ItemRow[])
    .slice()
    .sort((a, b) => a.position - b.position)

  const ageSex = [patient.age_years ? `${patient.age_years}y` : null, patient.gender]
    .filter(Boolean)
    .join(" / ")

  return {
    clinic: {
      name: clinic.name,
      address: clinic.address,
      phone: clinic.phone,
      doctorName: clinic.doctor_name,
      qualifications: clinic.qualifications,
      registrationNo: clinic.registration_no,
      specialty: clinic.specialty,
      logoUrl: logoUrlFromPath(clinic.logo_path),
    },
    patient: {
      name: patient.full_name,
      ageSex: ageSex || undefined,
      phone: formatPhoneDisplay(patient.phone),
    },
    dateLabel: formatISTDate(rx.created_at),
    vitals: visit ? vitalsToList(visit.vitals ?? {}) : [],
    complaints: visit?.complaints ?? null,
    diagnosis: visit?.diagnosis ?? null,
    advice: visit?.advice ?? null,
    followupLabel: visit?.followup_date ? formatISTDate(visit.followup_date) : null,
    items,
  }
}

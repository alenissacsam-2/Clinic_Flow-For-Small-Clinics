import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { requireClinic } from "@/lib/clinic"
import { formatPhoneDisplay, formatISTDate } from "@/lib/format"
import { VisitEditor } from "@/components/visits/visit-editor"
import { IntakePanel, type IntakeAnswers } from "@/components/visits/intake-panel"
import { AttachmentPanel, type AttachmentRow } from "@/components/visits/attachment-panel"
import { LabPanel, type LabOrderRow } from "@/components/visits/lab-panel"
import { aiConfigured } from "@/lib/ai/scribe"
import { Badge } from "@/components/ui/badge"

export default async function VisitPage({
  params,
}: {
  params: Promise<{ appointmentId: string }>
}) {
  await requireClinic()
  const { appointmentId } = await params
  const supabase = await createClient()

  const { data: appt } = await supabase
    .from("appointments")
    .select("id, patient_id, reason, patient:patients(id, full_name, phone, age_years, gender, allergies, chronic_conditions)")
    .eq("id", appointmentId)
    .maybeSingle()

  if (!appt || !appt.patient) notFound()
  const patient = appt.patient as unknown as {
    id: string
    full_name: string
    phone: string
    age_years: number | null
    gender: string | null
    allergies: string | null
    chronic_conditions: string | null
  }

  // Existing visit for this appointment (draft) + its Rx items.
  const { data: existingVisit } = await supabase
    .from("visits")
    .select("id, vitals, complaints, diagnosis, diagnosis_codes, advice, followup_date")
    .eq("appointment_id", appointmentId)
    .maybeSingle()

  let items: {
    medicine_name: string
    dosage: string | null
    duration_days: number | null
    instructions: string | null
  }[] = []
  if (existingVisit) {
    const { data: rx } = await supabase
      .from("prescriptions")
      .select("id")
      .eq("visit_id", existingVisit.id)
      .maybeSingle()
    if (rx) {
      const { data: rows } = await supabase
        .from("prescription_items")
        .select("medicine_name, dosage, duration_days, instructions")
        .eq("prescription_id", rx.id)
        .order("position", { ascending: true })
      items = rows ?? []
    }
  }

  // Files and lab orders. Both are patient-scoped rather than visit-scoped so
  // a report brought in from elsewhere is visible during the consultation.
  const [{ data: attachments }, { data: labOrders }] = await Promise.all([
    supabase
      .from("visit_attachments")
      .select("id, file_name, mime_type, size_bytes, kind, note, created_at")
      .eq("patient_id", patient.id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("lab_orders")
      .select(
        "id, status, lab_name, ordered_at, resulted_at, items:lab_order_items(id, test_name, loinc_code, unit, value_text, reference_low, reference_high, reference_text, flag, note, position)",
      )
      .eq("patient_id", patient.id)
      .order("ordered_at", { ascending: false })
      .limit(10),
  ])

  const orders: LabOrderRow[] = (labOrders ?? []).map((o) => ({
    ...o,
    items: [...(o.items ?? [])].sort((a, b) => a.position - b.position),
  }))

  // Previous visits for context.
  const { data: prev } = await supabase
    .from("visits")
    .select("id, visit_date, diagnosis, complaints")
    .eq("patient_id", patient.id)
    .neq("appointment_id", appointmentId)
    .order("visit_date", { ascending: false })
    .limit(5)

  // Submitted pre-visit intake (if any) → panel + complaints prefill.
  const { data: intakeRow } = await supabase
    .from("intake_requests")
    .select("status, payload")
    .eq("appointment_id", appointmentId)
    .eq("status", "submitted")
    .maybeSingle()
  const intake = (intakeRow?.payload ?? null) as IntakeAnswers | null
  const complaintsInitial = existingVisit?.complaints || intake?.complaints || ""

  const meta = [patient.age_years ? `${patient.age_years}y` : null, patient.gender]
    .filter(Boolean)
    .join(" / ")

  return (
    <div>
      <Link
        href="/today"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to queue
      </Link>

      <div className="mb-6 rounded-xl border border-edge/20 bg-card shadow-nm-raised p-4">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold">{patient.full_name}</h1>
          {meta && <span className="text-sm text-muted-foreground">{meta}</span>}
        </div>
        <p className="text-sm text-muted-foreground">{formatPhoneDisplay(patient.phone)}</p>
        {(patient.allergies || patient.chronic_conditions) && (
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            {patient.allergies && (
              <span className="rounded bg-destructive/10 px-2 py-0.5 text-destructive">Allergies: {patient.allergies}</span>
            )}
            {patient.chronic_conditions && (
              <span className="rounded bg-warning/10 px-2 py-0.5 text-warning">{patient.chronic_conditions}</span>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
        <div className="space-y-6">
        <VisitEditor
          appointmentId={appointmentId}
          patientId={patient.id}
          visitId={existingVisit?.id ?? null}
          scribeAvailable={aiConfigured()}
          initial={{
            vitals: (existingVisit?.vitals as Record<string, number>) ?? {},
            complaints: complaintsInitial,
            diagnosis: existingVisit?.diagnosis ?? "",
            diagnosisCodes: existingVisit?.diagnosis_codes ?? [],
            advice: existingVisit?.advice ?? "",
            followupDate: existingVisit?.followup_date ?? "",
            items: items.map((i) => ({
              medicine_name: i.medicine_name,
              dosage: i.dosage ?? undefined,
              duration_days: i.duration_days,
              instructions: i.instructions ?? undefined,
            })),
          }}
        />

        <LabPanel
          patientId={patient.id}
          visitId={existingVisit?.id ?? null}
          orders={orders}
        />

        <AttachmentPanel
          patientId={patient.id}
          visitId={existingVisit?.id ?? null}
          attachments={(attachments ?? []) as AttachmentRow[]}
        />
        </div>

        <aside className="space-y-4">
          {intake && <IntakePanel answers={intake} />}
          <div className="space-y-2">
          <h2 className="text-sm font-semibold">Previous visits</h2>
          {!prev?.length ? (
            <p className="text-sm text-muted-foreground">No earlier visits.</p>
          ) : (
            <ul className="space-y-2">
              {prev.map((v) => (
                <li key={v.id} className="rounded-xl border border-edge/15 bg-background/45 shadow-nm-inset p-3 text-sm">
                  <div className="font-medium">{formatISTDate(v.visit_date)}</div>
                  {v.diagnosis && <p className="text-muted-foreground">{v.diagnosis}</p>}
                  {v.complaints && !v.diagnosis && (
                    <p className="text-muted-foreground">{v.complaints}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
          </div>
          {appt.reason && (
            <div className="rounded-xl border border-edge/20 bg-card shadow-nm-raised p-3 text-sm">
              <span className="text-xs text-muted-foreground">Reason for visit</span>
              <p>{appt.reason}</p>
            </div>
          )}
          <Badge variant="secondary" className="text-xs">Draft autosaves on Save</Badge>
        </aside>
      </div>
    </div>
  )
}

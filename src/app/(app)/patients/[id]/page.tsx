import Link from "next/link"
import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { requireClinic } from "@/lib/clinic"
import { formatPhoneDisplay, formatISTDate, formatISTDateTime } from "@/lib/format"
import { initials } from "@/lib/name"
import { cn } from "@/lib/utils"
import { TONE } from "@/lib/status"
import { formatAbhaNumber, checkAbhaNumber } from "@/lib/abdm/abha"
import { EditPatientDialog } from "@/components/patients/edit-patient-dialog"
import { PatientDanger } from "@/components/patients/patient-danger"
import { AbdmConsent, type ConsentRow } from "@/components/patients/abdm-consent"
import { AttachmentPanel, type AttachmentRow } from "@/components/visits/attachment-panel"
import { LabPanel, type LabOrderRow } from "@/components/visits/lab-panel"
import { hasAbdm } from "@/lib/env"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { ArrowLeft } from "lucide-react"

export default async function PatientProfile({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireClinic()
  const { id } = await params
  const supabase = await createClient()

  const { data: patient } = await supabase
    .from("patients")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle()

  if (!patient) notFound()

  const [
    { data: appts },
    { data: visits },
    { data: prescriptions },
    { data: invoices },
    { data: messages },
    { data: consents },
    { data: attachments },
    { data: labOrders },
  ] = await Promise.all([
      supabase
        .from("appointments")
        .select("id, starts_at, status, reason, token_number")
        .eq("patient_id", id)
        .order("starts_at", { ascending: false })
        .limit(20),
      supabase
        .from("visits")
        .select("id, visit_date, diagnosis, complaints, followup_date")
        .eq("patient_id", id)
        .order("visit_date", { ascending: false })
        .limit(20),
      supabase
        .from("prescriptions")
        .select("id, created_at, finalized_at, pdf_path")
        .eq("patient_id", id)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("invoices")
        .select("id, invoice_no, status, total_amount, created_at")
        .eq("patient_id", id)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("wa_messages")
        .select("id, direction, template_name, body, status, created_at")
        .eq("patient_id", id)
        .order("created_at", { ascending: false })
        .limit(30),
      supabase
        .from("consent_artefacts")
        .select("id, status, hi_types, created_at, expires_at, request_id")
        .eq("patient_id", id)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("visit_attachments")
        .select("id, file_name, mime_type, size_bytes, kind, note, created_at")
        .eq("patient_id", id)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("lab_orders")
        .select(
          "id, status, lab_name, ordered_at, resulted_at, items:lab_order_items(id, test_name, loinc_code, unit, value_text, reference_low, reference_high, reference_text, flag, note, position)",
        )
        .eq("patient_id", id)
        .order("ordered_at", { ascending: false })
        .limit(25),
    ])

  const orders: LabOrderRow[] = (labOrders ?? []).map((o) => ({
    ...o,
    items: [...(o.items ?? [])].sort((a, b) => a.position - b.position),
  }))

  const meta = [
    patient.age_years ? `${patient.age_years} yrs` : null,
    patient.gender,
    patient.blood_group,
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <div>
      <Link
        href="/patients"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Patients
      </Link>

      <div className="mb-6 flex flex-col gap-4 rounded-xl border border-edge/20 bg-card shadow-nm-raised p-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-4">
          <Avatar size="lg" className="mt-0.5 shrink-0">
            <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
              {initials(patient.full_name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-heading text-xl font-semibold">{patient.full_name}</h1>
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <span
                  className={cn(
                    "size-2 rounded-full",
                    patient.whatsapp_opt_in ? "bg-success" : "bg-border",
                  )}
                />
                {patient.whatsapp_opt_in ? "WhatsApp on" : "WhatsApp off"}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatPhoneDisplay(patient.phone)}
              {meta ? ` · ${meta}` : ""}
            </p>
            {(patient.abha_number || patient.abha_address) && (
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                {patient.abha_number && (
                  <span className="font-mono">ABHA {formatAbhaNumber(patient.abha_number)}</span>
                )}
                {patient.abha_address && <span className="font-mono">{patient.abha_address}</span>}
                {/* Advisory, never a blocker — the number is already saved.
                    Flagging it here lets the clinic re-check a likely typo. */}
                {patient.abha_number && !checkAbhaNumber(patient.abha_number).checksumValid && (
                  <span className={cn("rounded-md px-2 py-0.5 font-medium", TONE.warning.tint)}>
                    Check digit doesn&apos;t match — verify this number
                  </span>
                )}
              </p>
            )}
            {(patient.allergies || patient.chronic_conditions) && (
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                {patient.allergies && (
                  <span className="rounded-md bg-destructive/10 px-2 py-0.5 font-medium text-destructive">
                    Allergies: {patient.allergies}
                  </span>
                )}
                {patient.chronic_conditions && (
                  <span className="rounded-md bg-warning/10 px-2 py-0.5 font-medium text-warning">
                    {patient.chronic_conditions}
                  </span>
                )}
              </div>
            )}
            {patient.tags?.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {patient.tags.map((t) => (
                  <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <EditPatientDialog patient={patient} />
          <PatientDanger patientId={patient.id} />
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="visits">Visits</TabsTrigger>
          <TabsTrigger value="rx">Prescriptions</TabsTrigger>
          <TabsTrigger value="labs">Labs</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="wa">WhatsApp</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="pt-4">
          <Section title="Appointment history">
            {!appts?.length ? (
              <Empty>No appointments yet.</Empty>
            ) : (
              <ul className="divide-y divide-edge/12 rounded-xl border border-edge/15 bg-background/45 shadow-nm-inset">
                {appts.map((a) => (
                  <li key={a.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <span>{formatISTDateTime(a.starts_at)}</span>
                    <span className="text-muted-foreground">{a.reason ?? "—"}</span>
                    <Badge variant="outline">{a.status.replace("_", " ")}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Section>
          {patient.address && (
            <Section title="Address">
              <p className="text-sm text-muted-foreground">{patient.address}</p>
            </Section>
          )}
          {patient.notes && (
            <Section title="Notes">
              <p className="text-sm text-muted-foreground">{patient.notes}</p>
            </Section>
          )}
          <Section title="ABDM consent">
            <AbdmConsent
              patientId={patient.id}
              hasAbhaAddress={Boolean(patient.abha_address)}
              live={hasAbdm()}
              artefacts={(consents ?? []) as ConsentRow[]}
            />
          </Section>
        </TabsContent>

        <TabsContent value="visits" className="pt-4">
          {!visits?.length ? (
            <Empty>No visits recorded yet.</Empty>
          ) : (
            <ul className="divide-y divide-edge/12 rounded-xl border border-edge/15 bg-background/45 shadow-nm-inset">
              {visits.map((v) => (
                <li key={v.id} className="px-4 py-3 text-sm">
                  <div className="flex justify-between">
                    <span className="font-medium">{formatISTDate(v.visit_date)}</span>
                    {v.followup_date && (
                      <span className="text-xs text-muted-foreground">
                        Follow-up: {formatISTDate(v.followup_date)}
                      </span>
                    )}
                  </div>
                  {v.diagnosis && <p className="text-muted-foreground">{v.diagnosis}</p>}
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="rx" className="pt-4">
          {!prescriptions?.length ? (
            <Empty>No prescriptions yet.</Empty>
          ) : (
            <ul className="divide-y divide-edge/12 rounded-xl border border-edge/15 bg-background/45 shadow-nm-inset">
              {prescriptions.map((p) => (
                <li key={p.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span>{formatISTDate(p.created_at)}</span>
                  <Badge variant="outline">{p.finalized_at ? "Finalized" : "Draft"}</Badge>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="labs" className="pt-4">
          <LabPanel patientId={patient.id} orders={orders} />
        </TabsContent>

        <TabsContent value="files" className="pt-4">
          <AttachmentPanel
            patientId={patient.id}
            attachments={(attachments ?? []) as AttachmentRow[]}
          />
        </TabsContent>

        <TabsContent value="invoices" className="pt-4">
          {!invoices?.length ? (
            <Empty>No invoices yet.</Empty>
          ) : (
            <ul className="divide-y divide-edge/12 rounded-xl border border-edge/15 bg-background/45 shadow-nm-inset">
              {invoices.map((i) => (
                <li key={i.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="font-medium">{i.invoice_no}</span>
                  <span>₹{Number(i.total_amount).toFixed(2)}</span>
                  <Badge variant="outline">{i.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="wa" className="pt-4">
          {!messages?.length ? (
            <Empty>No WhatsApp messages yet.</Empty>
          ) : (
            <ul className="space-y-2">
              {messages.map((m) => (
                <li
                  key={m.id}
                  className={`max-w-md rounded-lg border p-3 text-sm ${
                    m.direction === "in" ? "bg-card" : "ml-auto bg-success/10"
                  }`}
                >
                  <div className="text-xs text-muted-foreground">
                    {m.direction === "in" ? "From patient" : m.template_name ?? "Message"} ·{" "}
                    {formatISTDateTime(m.created_at)} · {m.status}
                  </div>
                  {m.body && <p className="mt-1">{m.body}</p>}
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h2 className="mb-2 text-sm font-semibold">{title}</h2>
      {children}
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-edge/30 bg-background/40 shadow-nm-inset py-10 text-center text-sm text-muted-foreground">
      {children}
    </div>
  )
}

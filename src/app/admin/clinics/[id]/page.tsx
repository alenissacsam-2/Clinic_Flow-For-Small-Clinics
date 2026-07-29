import Link from "next/link"
import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { formatINR, formatISTDate } from "@/lib/format"
import { env } from "@/lib/env"
import { PageHeader } from "@/components/page-header"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { SuspendButton } from "@/components/admin/suspend-button"
import { ArrowLeft, ExternalLink } from "lucide-react"

type Detail = {
  clinic: {
    id: string
    name: string
    slug: string
    doctor_name: string
    specialty: string | null
    phone: string | null
    email: string | null
    address: string | null
    registration_no: string | null
    created_at: string
    suspended_at: string | null
    settings: Record<string, unknown>
  }
  members: { email: string; role: string }[]
  patient_count: number
  appt_count: number
  revenue: number
  last_appt: string | null
  wa_failed: number
}

export default async function AdminClinicDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase.rpc("admin_clinic_detail", { p_clinic: id })
  const d = data as unknown as Detail | null
  if (!d?.clinic) notFound()

  const c = d.clinic
  const bookingUrl = `${env.appUrl}/book/${c.slug}`

  return (
    <div>
      <Link
        href="/admin/clinics"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> All clinics
      </Link>

      <PageHeader title={c.name} description={`${c.doctor_name}${c.specialty ? ` · ${c.specialty}` : ""}`}>
        <div className="flex items-center gap-2">
          <a
            href={bookingUrl}
            target="_blank"
            rel="noreferrer"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            <ExternalLink className="size-4" /> Booking page
          </a>
          <SuspendButton clinicId={c.id} suspended={Boolean(c.suspended_at)} />
        </div>
      </PageHeader>

      {c.suspended_at && (
        <div className="mb-6 rounded-lg border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          This clinic is <strong>paused</strong> since {formatISTDate(c.suspended_at)} — its booking page
          is disabled and its staff can&apos;t sign in.
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Patients" value={String(d.patient_count)} />
        <Stat label="Appointments" value={String(d.appt_count)} />
        <Stat label="Revenue" value={formatINR(Number(d.revenue))} />
        <Stat label="WhatsApp failed" value={String(d.wa_failed)} accent={d.wa_failed > 0} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-edge/20 bg-card shadow-nm-raised p-4">
          <h2 className="mb-3 font-heading text-base font-semibold">Profile</h2>
          <dl className="space-y-2 text-sm">
            <Row label="Booking link" value={`/book/${c.slug}`} />
            <Row label="Phone" value={c.phone ?? "—"} />
            <Row label="Email" value={c.email ?? "—"} />
            <Row label="Reg. no" value={c.registration_no ?? "—"} />
            <Row label="Address" value={c.address ?? "—"} />
            <Row label="Created" value={formatISTDate(c.created_at)} />
            <Row label="Last appointment" value={d.last_appt ? formatISTDate(d.last_appt) : "—"} />
          </dl>
        </div>

        <div className="rounded-xl border border-edge/20 bg-card shadow-nm-raised p-4">
          <h2 className="mb-3 font-heading text-base font-semibold">Team</h2>
          <ul className="space-y-2 text-sm">
            {d.members.map((m) => (
              <li key={m.email} className="flex items-center justify-between">
                <span>{m.email}</span>
                <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium capitalize text-accent-foreground">
                  {m.role}
                </span>
              </li>
            ))}
            {!d.members.length && <li className="text-muted-foreground">No members.</li>}
          </ul>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-edge/20 bg-card shadow-nm-raised p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${accent ? "text-destructive" : ""}`}>
        {value}
      </p>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  )
}

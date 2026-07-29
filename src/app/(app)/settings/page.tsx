import Link from "next/link"
import { Pill, ChevronRight } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { requireDoctor, clinicSettings, logoUrl } from "@/lib/clinic"
import { env } from "@/lib/env"
import { PageHeader } from "@/components/page-header"
import { SettingsForms, type SettingsData } from "@/components/settings/settings-forms"
import {
  MembersSection,
  type MemberRow,
  type InviteRow,
} from "@/components/settings/members-section"

export default async function SettingsPage() {
  const clinic = await requireDoctor()
  const settings = clinicSettings(clinic)
  const supabase = await createClient()

  const [{ data: availability }, { data: memberData }, { data: inviteData }] = await Promise.all([
    supabase
      .from("availability")
      .select("weekday, start_time, end_time")
      .eq("clinic_id", clinic.id)
      .order("weekday", { ascending: true })
      .order("start_time", { ascending: true }),
    supabase.rpc("list_clinic_members", { p_clinic: clinic.id }),
    supabase
      .from("clinic_invites")
      .select("id, email, token, expires_at")
      .eq("clinic_id", clinic.id)
      .is("accepted_at", null)
      .order("created_at", { ascending: false }),
  ])

  // Derive the simple two-session editor model from availability rows.
  const workingDays = [...new Set((availability ?? []).map((a) => a.weekday))]
  const byDay = (availability ?? []).filter((a) => a.weekday === workingDays[0])
  const morning = byDay[0]
  const evening = byDay[1]
  const hhmm = (t?: string) => (t ? t.slice(0, 5) : "")

  const data: SettingsData = {
    profile: {
      name: clinic.name,
      doctor_name: clinic.doctor_name,
      qualifications: clinic.qualifications ?? "",
      registration_no: clinic.registration_no ?? "",
      specialty: clinic.specialty ?? "",
      phone: clinic.phone ?? "",
      address: clinic.address ?? "",
    },
    prefs: {
      consultation_fee: settings.consultation_fee,
      slot_minutes: settings.slot_minutes,
      template_lang: settings.template_lang,
      booking_mode: settings.booking_mode,
      reminder24: settings.reminder_offsets_hours.includes(24),
      reminder2: settings.reminder_offsets_hours.includes(2),
      booking_enabled: settings.booking_enabled,
    },
    hours: {
      workingDays,
      morningStart: hhmm(morning?.start_time) || "10:00",
      morningEnd: hhmm(morning?.end_time) || "13:00",
      eveningStart: hhmm(evening?.start_time),
      eveningEnd: hhmm(evening?.end_time),
    },
    payments: {
      upi_vpa: settings.upi_vpa,
      upi_name: settings.upi_name,
    },
  }

  const bookingUrl = `${env.appUrl}/book/${clinic.slug}`
  const displayUrl = `${env.appUrl}/display/${clinic.slug}`
  const members = (memberData ?? []) as MemberRow[]
  const invites = (inviteData ?? []) as InviteRow[]

  return (
    <div>
      <PageHeader title="Settings" description="Clinic profile, hours, fees, team and reminders." />
      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-edge/20 bg-card shadow-nm-raised p-4 text-sm">
          <p className="font-medium">Your public booking link</p>
          <a href={bookingUrl} className="break-all text-primary underline" target="_blank" rel="noreferrer">
            {bookingUrl}
          </a>
        </div>
        <div className="rounded-xl border border-edge/20 bg-card shadow-nm-raised p-4 text-sm">
          <p className="font-medium">Waiting-room display</p>
          <a href={displayUrl} className="break-all text-primary underline" target="_blank" rel="noreferrer">
            {displayUrl}
          </a>
          <p className="mt-1 text-xs text-muted-foreground">
            Open this on a screen in the waiting room. It shows token numbers only — never patient
            names.
          </p>
        </div>
      </div>
      <div className="space-y-6">
        <SettingsForms data={data} logo={logoUrl(clinic)} clinicName={clinic.name} />
        <MembersSection members={members} invites={invites} appUrl={env.appUrl} />
        <Link
          href="/settings/medicines"
          className="flex items-center justify-between rounded-xl border border-edge/20 bg-card shadow-nm-raised p-4 transition-colors hover:bg-accent/40"
        >
          <span>
            <span className="flex items-center gap-2 font-heading font-semibold">
              <Pill className="size-4 text-primary" /> Medicines
            </span>
            <span className="mt-1 block text-sm text-muted-foreground">
              Import a drug list to extend the built-in prescription autocomplete.
            </span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        </Link>
      </div>
    </div>
  )
}

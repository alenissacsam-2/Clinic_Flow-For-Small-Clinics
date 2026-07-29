"use client"

import { useActionState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  updateClinicProfile,
  updateClinicPrefs,
  updateHours,
  updatePaymentSettings,
  uploadClinicLogo,
  removeClinicLogo,
  type SettingsState,
} from "@/actions/settings"
import type { LucideIcon } from "lucide-react"
import { ImageIcon, Stethoscope, Clock, MessageCircle, IndianRupee } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

/** Card header with a small accent icon tile, shared by every settings section. */
function IconTitle({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
          <Icon className="size-4" />
        </span>
        {children}
      </CardTitle>
    </CardHeader>
  )
}

const DAYS = [
  { v: 1, l: "Mon" },
  { v: 2, l: "Tue" },
  { v: 3, l: "Wed" },
  { v: 4, l: "Thu" },
  { v: 5, l: "Fri" },
  { v: 6, l: "Sat" },
  { v: 0, l: "Sun" },
]

function useSaved(state: SettingsState) {
  const router = useRouter()
  useEffect(() => {
    if (state?.ok) {
      toast.success("Saved")
      router.refresh()
    } else if (state?.error) {
      toast.error(state.error)
    }
  }, [state, router])
}

export type SettingsData = {
  profile: {
    name: string
    doctor_name: string
    qualifications: string
    registration_no: string
    specialty: string
    phone: string
    address: string
  }
  prefs: {
    consultation_fee: number
    slot_minutes: number
    template_lang: "en" | "hi"
    booking_mode: "instant" | "approve"
    reminder24: boolean
    reminder2: boolean
    booking_enabled: boolean
  }
  hours: {
    workingDays: number[]
    morningStart: string
    morningEnd: string
    eveningStart: string
    eveningEnd: string
  }
  payments: {
    upi_vpa: string
    upi_name: string
  }
}

export function SettingsForms({
  data,
  logo,
  clinicName,
}: {
  data: SettingsData
  logo: string | null
  clinicName: string
}) {
  return (
    <div className="space-y-6">
      <LogoForm logo={logo} clinicName={clinicName} />
      <ProfileForm p={data.profile} />
      <HoursForm h={data.hours} />
      <PrefsForm p={data.prefs} />
      <PaymentsForm p={data.payments} />
    </div>
  )
}

function LogoForm({ logo, clinicName }: { logo: string | null; clinicName: string }) {
  const [upState, upload, uploading] = useActionState(uploadClinicLogo, undefined)
  const [rmState, remove, removing] = useActionState(removeClinicLogo, undefined)
  useSaved(upState)
  useSaved(rmState)
  return (
    <Card>
      <IconTitle icon={ImageIcon}>Clinic logo</IconTitle>
      <CardContent>
        <div className="flex flex-col gap-4 rounded-xl border border-dashed border-edge/30 border-border p-4 sm:flex-row sm:items-center">
          <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-card">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logo ?? "/brand/mark-tile.png"} alt={clinicName} className="size-full object-cover" />
          </div>
          <div className="flex-1 space-y-3">
            <p className="text-sm text-muted-foreground">
              Shown on your booking page, prescriptions and receipts. PNG or JPG, square works best,
              under 1&nbsp;MB.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <form action={upload} className="flex items-center gap-2">
                <input
                  type="file"
                  name="logo"
                  accept="image/png,image/jpeg,image/webp"
                  required
                  className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-secondary-foreground hover:file:bg-secondary/80"
                />
                <Button type="submit" size="sm" disabled={uploading}>
                  {uploading ? "Uploading…" : "Upload"}
                </Button>
              </form>
              {logo && (
                <form action={remove}>
                  <Button type="submit" size="sm" variant="outline" disabled={removing}>
                    {removing ? "Removing…" : "Remove"}
                  </Button>
                </form>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function PaymentsForm({ p }: { p: SettingsData["payments"] }) {
  const [state, action, pending] = useActionState(updatePaymentSettings, undefined)
  useSaved(state)
  return (
    <Card>
      <IconTitle icon={IndianRupee}>Payments (UPI)</IconTitle>
      <CardContent>
        <form action={action} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="upi_vpa">Your UPI ID</Label>
              <Input id="upi_vpa" name="upi_vpa" defaultValue={p.upi_vpa} placeholder="name@okhdfcbank" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="upi_name">Display name (optional)</Label>
              <Input id="upi_name" name="upi_name" defaultValue={p.upi_name} placeholder="Sunrise Clinic" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Patients pay via a QR / UPI link. There&apos;s no automatic confirmation for personal UPI —
            you mark a payment received once you see it in your UPI app.
          </p>
          <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
        </form>
      </CardContent>
    </Card>
  )
}

function ProfileForm({ p }: { p: SettingsData["profile"] }) {
  const [state, action, pending] = useActionState(updateClinicProfile, undefined)
  useSaved(state)
  return (
    <Card>
      <IconTitle icon={Stethoscope}>Clinic &amp; doctor</IconTitle>
      <CardContent>
        <form action={action} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="name" label="Clinic name" defaultValue={p.name} required />
            <Field name="doctor_name" label="Doctor name" defaultValue={p.doctor_name} required />
            <Field name="qualifications" label="Qualifications" defaultValue={p.qualifications} />
            <Field name="registration_no" label="Registration no." defaultValue={p.registration_no} />
            <Field name="specialty" label="Specialty" defaultValue={p.specialty} />
            <Field name="phone" label="Clinic phone" defaultValue={p.phone} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Textarea id="address" name="address" rows={2} defaultValue={p.address} />
          </div>
          <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
        </form>
      </CardContent>
    </Card>
  )
}

function HoursForm({ h }: { h: SettingsData["hours"] }) {
  const [state, action, pending] = useActionState(updateHours, undefined)
  useSaved(state)
  return (
    <Card>
      <IconTitle icon={Clock}>Clinic hours</IconTitle>
      <CardContent>
        <form action={action} className="space-y-4">
          <div className="flex flex-wrap gap-3">
            {DAYS.map((d) => (
              <label key={d.v} className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  name="working_days"
                  value={d.v}
                  defaultChecked={h.workingDays.includes(d.v)}
                  className="size-4 rounded border-input"
                />
                {d.l}
              </label>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Morning session</Label>
              <div className="flex items-center gap-2">
                <Input name="morning_start" type="time" defaultValue={h.morningStart} />
                <span className="text-muted-foreground">to</span>
                <Input name="morning_end" type="time" defaultValue={h.morningEnd} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Evening session (optional)</Label>
              <div className="flex items-center gap-2">
                <Input name="evening_start" type="time" defaultValue={h.eveningStart} />
                <span className="text-muted-foreground">to</span>
                <Input name="evening_end" type="time" defaultValue={h.eveningEnd} />
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Leave the evening session blank to run a single session per day.
          </p>
          <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save hours"}</Button>
        </form>
      </CardContent>
    </Card>
  )
}

function PrefsForm({ p }: { p: SettingsData["prefs"] }) {
  const [state, action, pending] = useActionState(updateClinicPrefs, undefined)
  useSaved(state)
  return (
    <Card>
      <IconTitle icon={MessageCircle}>Consultation &amp; reminders</IconTitle>
      <CardContent>
        <form action={action} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="consultation_fee">Default fee (₹)</Label>
              <Input id="consultation_fee" name="consultation_fee" type="number" min={0} defaultValue={p.consultation_fee} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slot_minutes">Slot length (min)</Label>
              <Input id="slot_minutes" name="slot_minutes" type="number" min={5} max={60} defaultValue={p.slot_minutes} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="template_lang">Message language</Label>
              <select
                id="template_lang"
                name="template_lang"
                defaultValue={p.template_lang}
                className="h-9 w-full rounded-lg border border-edge/50 bg-background/60 px-3 text-sm shadow-nm-inset"
              >
                <option value="en">English</option>
                <option value="hi">Hindi</option>
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>WhatsApp reminders</Label>
            <div className="flex flex-col gap-2 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" name="reminder_24h" defaultChecked={p.reminder24} className="size-4 rounded border-input" />
                24 hours before the appointment
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="reminder_2h" defaultChecked={p.reminder2} className="size-4 rounded border-input" />
                2 hours before the appointment
              </label>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="booking_mode">Online booking mode</Label>
            <select
              id="booking_mode"
              name="booking_mode"
              defaultValue={p.booking_mode}
              className="h-9 w-full rounded-lg border border-edge/50 bg-background/60 px-3 text-sm shadow-nm-inset sm:w-72"
            >
              <option value="instant">Instant — patient verifies phone, slot confirms automatically</option>
              <option value="approve">Approval — I accept each request myself</option>
            </select>
            <p className="text-xs text-muted-foreground">
              Instant mode sends a one-time code to the patient&apos;s phone and books the slot on
              successful verification.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="booking_enabled" defaultChecked={p.booking_enabled} className="size-4 rounded border-input" />
            Enable the public booking page
          </label>
          <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
        </form>
      </CardContent>
    </Card>
  )
}

function Field({
  name,
  label,
  defaultValue,
  required,
}: {
  name: string
  label: string
  defaultValue?: string
  required?: boolean
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} defaultValue={defaultValue} required={required} />
    </div>
  )
}

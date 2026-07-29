"use client"

import { useActionState, useRef, useState } from "react"
import Link from "next/link"
import { completeOnboarding } from "@/actions/onboarding"
import { SPECIALTIES, specialtyPreset } from "@/lib/specialties"
import { env } from "@/lib/env"
import { cn } from "@/lib/utils"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const DAYS = [
  { v: 1, l: "Mon" },
  { v: 2, l: "Tue" },
  { v: 3, l: "Wed" },
  { v: 4, l: "Thu" },
  { v: 5, l: "Fri" },
  { v: 6, l: "Sat" },
  { v: 0, l: "Sun" },
]

function Section({
  title,
  desc,
  children,
}: {
  title: string
  desc?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-heading text-base font-semibold">{title}</h3>
        {desc && <p className="text-xs text-muted-foreground">{desc}</p>}
      </div>
      {children}
    </div>
  )
}

export function OnboardingForm() {
  const [state, action, pending] = useActionState(completeOnboarding, undefined)
  const feeRef = useRef<HTMLInputElement>(null)
  const slotRef = useRef<HTMLInputElement>(null)

  // Picking a specialty seeds sensible defaults; everything stays editable.
  function onSpecialty(e: React.ChangeEvent<HTMLSelectElement>) {
    const preset = specialtyPreset(e.target.value)
    if (!preset) return
    if (feeRef.current) feeRef.current.value = String(preset.defaultFee)
    if (slotRef.current) slotRef.current.value = String(preset.defaultSlotMinutes)
  }

  if (state?.ok) {
    return <FinishStep slug={state.slug ?? ""} />
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle>Set up your clinic</CardTitle>
          <CardDescription>
            A few details to personalise your prescriptions, reminders and booking page.
          </CardDescription>
        </CardHeader>
        <form action={action}>
          <CardContent className="space-y-8">
            <Section title="Clinic">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Clinic name *</Label>
                  <Input id="name" name="name" required placeholder="Sunrise Clinic" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">Booking link (optional)</Label>
                  <div className="flex items-center gap-1 text-sm">
                    <span className="text-muted-foreground">/book/</span>
                    <Input id="slug" name="slug" placeholder="sunrise-clinic" />
                  </div>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="phone">Clinic phone</Label>
                  <Input id="phone" name="phone" placeholder="+91 98765 43210" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="specialty">Specialty</Label>
                  <select
                    id="specialty"
                    name="specialty"
                    defaultValue=""
                    onChange={onSpecialty}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="" disabled>
                      Select your specialty…
                    </option>
                    {SPECIALTIES.map((s) => (
                      <option key={s.label} value={s.label}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Textarea id="address" name="address" rows={2} />
              </div>
            </Section>

            <Section title="Doctor" desc="Printed on every prescription (required by law).">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="doctor_name">Doctor name *</Label>
                  <Input id="doctor_name" name="doctor_name" required placeholder="Dr. A. Sharma" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="qualifications">Qualifications</Label>
                  <Input id="qualifications" name="qualifications" placeholder="MBBS, MD" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="registration_no">Medical registration no.</Label>
                <Input id="registration_no" name="registration_no" placeholder="MCI / State council reg." />
              </div>
            </Section>

            <Section title="Consultation">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="consultation_fee">Default fee (₹)</Label>
                  <Input
                    ref={feeRef}
                    id="consultation_fee"
                    name="consultation_fee"
                    type="number"
                    defaultValue={300}
                    min={0}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slot_minutes">Slot length (min)</Label>
                  <Input
                    ref={slotRef}
                    id="slot_minutes"
                    name="slot_minutes"
                    type="number"
                    defaultValue={15}
                    min={5}
                    max={60}
                  />
                </div>
              </div>
            </Section>

            <Section title="Clinic hours" desc="You can fine-tune these later in Settings.">
              <div className="flex flex-wrap gap-3">
                {DAYS.map((d) => (
                  <label key={d.v} className="flex items-center gap-1.5 text-sm">
                    <input
                      type="checkbox"
                      name="working_days"
                      value={d.v}
                      defaultChecked={d.v !== 0}
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
                    <Input name="morning_start" type="time" defaultValue="10:00" />
                    <span className="text-muted-foreground">to</span>
                    <Input name="morning_end" type="time" defaultValue="13:00" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Evening session (optional)</Label>
                  <div className="flex items-center gap-2">
                    <Input name="evening_start" type="time" defaultValue="17:00" />
                    <span className="text-muted-foreground">to</span>
                    <Input name="evening_end" type="time" defaultValue="20:00" />
                  </div>
                </div>
              </div>
            </Section>

            {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Setting up…" : "Finish setup"}
            </Button>
          </CardContent>
        </form>
      </Card>
    </div>
  )
}

function FinishStep({ slug }: { slug: string }) {
  const bookingUrl = `${env.appUrl}/book/${slug}`
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(bookingUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard blocked — the link is still visible to copy manually */
    }
  }

  const waText = encodeURIComponent(`Book your appointment with us here: ${bookingUrl}`)

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-xl bg-primary text-xl font-bold text-primary-foreground">
            ✓
          </div>
          <CardTitle>Your clinic is live</CardTitle>
          <CardDescription>
            Share this link so patients can book with you. It&apos;s on WhatsApp, a poster, or your
            Google profile.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-lg border bg-muted/30 p-3 text-center">
            <p className="break-all font-medium text-primary">{bookingUrl}</p>
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            <Button type="button" onClick={copy} variant="outline" size="sm">
              {copied ? "Copied!" : "Copy link"}
            </Button>
            <a
              href={bookingUrl}
              target="_blank"
              rel="noreferrer"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Open link
            </a>
            <a
              href={`https://wa.me/?text=${waText}`}
              target="_blank"
              rel="noreferrer"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Share on WhatsApp
            </a>
          </div>

          <div className="rounded-xl border border-edge/20 bg-card shadow-nm-raised p-4">
            <p className="mb-2 text-sm font-medium">Next steps</p>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              <li>• Add your UPI ID in Settings to accept payments</li>
              <li>• Upload your clinic logo for branded prescriptions</li>
              <li>• Invite your receptionist to help run the front desk</li>
            </ul>
          </div>

          <Link href="/today" className={cn(buttonVariants(), "w-full")}>
            Go to dashboard
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}

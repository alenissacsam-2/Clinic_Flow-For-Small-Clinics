"use client"

import { useActionState, useEffect, useRef, useState, useTransition } from "react"
import {
  CheckCircle2,
  ArrowLeft,
  Check,
  CalendarClock,
  CalendarPlus,
  Download,
  MapPin,
  Phone,
  RefreshCw,
  Sunrise,
  Sun,
  Moon,
} from "lucide-react"
import {
  submitBooking,
  requestBookingOtp,
  verifyBookingOtp,
  confirmVerifiedBooking,
  refreshBookingDays,
  type BookingState,
} from "@/actions/booking"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { OtpInput } from "@/components/booking/otp-input"
import { TONE } from "@/lib/status"
import { cn } from "@/lib/utils"
import { groupSlots, relativeDay, type BookingDay, type BookableSlot } from "@/lib/booking-days"
import { icsDataUrl, googleCalendarUrl } from "@/lib/ics"

export type { BookingDay } from "@/lib/booking-days"

export type BookingClinic = {
  name: string
  doctorName: string
  address: string | null
  phone: string | null
}

type Slot = BookableSlot

const PART_ICON = { morning: Sunrise, afternoon: Sun, evening: Moon } as const

export function BookingWidget({
  slug,
  days: initialDays,
  clinic,
  mode,
}: {
  slug: string
  days: BookingDay[]
  clinic: BookingClinic
  mode: "instant" | "approve"
}) {
  const [days, setDays] = useState(initialDays)
  const firstWithSlots = days.find((d) => d.slots.length > 0)?.dateKey ?? days[0]?.dateKey
  const [activeDay, setActiveDay] = useState(firstWithSlots)
  const [slot, setSlot] = useState<Slot | null>(null)
  const [slotLost, setSlotLost] = useState(false)
  const [refreshing, startRefresh] = useTransition()

  const current = days.find((d) => d.dateKey === activeDay)
  const currentIndex = days.findIndex((d) => d.dateKey === activeDay)

  /**
   * Slots go stale while a patient decides.
   *
   * The page is server-rendered once. Someone who opens the WhatsApp link,
   * gets pulled away, and comes back twenty minutes later is looking at a
   * board that may no longer be true — and with the current flow they only
   * find out *after* entering a phone number and typing an OTP, which is the
   * most expensive possible moment to lose a slot. Re-reading when the tab
   * comes back to the foreground moves that failure to the one point where it
   * costs the patient nothing: while they are still choosing.
   */
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState !== "visible") return
      startRefresh(async () => {
        const fresh = await refreshBookingDays(slug)
        if (!fresh) return
        setDays(fresh)
        if (slot) {
          const stillThere = fresh.some((d) => d.slots.some((s) => s.startUtc === slot.startUtc))
          if (!stillThere) {
            setSlot(null)
            setSlotLost(true)
          }
        }
      })
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => document.removeEventListener("visibilitychange", onVisible)
  }, [slug, slot])

  /**
   * Keep the selected day chip on screen.
   *
   * Seven days do not fit the strip, and the day that opens selected is the
   * first one with any slots — which for a clinic that is shut for a long
   * weekend is chip five, entirely off to the right. Without this the page
   * loads showing a row of greyed-out "Closed" days and a slot grid that
   * appears to belong to none of them. `inline: "nearest"` is deliberate: it
   * is a no-op when the chip is already visible, so the normal case (today,
   * leftmost) is never nudged.
   */
  const stripRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    stripRef.current
      ?.querySelector<HTMLElement>("[data-active]")
      ?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" })
  }, [activeDay])

  function pick(next: Slot) {
    setSlot(next)
    setSlotLost(false)
  }

  const picker = (
    <div className="space-y-5">
      {/* ── Day strip ───────────────────────────────────────────────────────
          An unavailable day is genuinely `disabled`, not merely faded. The
          old strip dimmed empty days to 40% and still let you tap them, which
          reads as "this is broken" rather than "this day is shut". The chip
          also says *which* kind of unavailable it is: a closed day means come
          another day, a full day means try calling — completely different
          instructions that a slot count alone cannot distinguish. */}
      <div ref={stripRef} className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {days.map((d, i) => {
          const active = activeDay === d.dateKey
          const empty = d.slots.length === 0
          return (
            <button
              key={d.dateKey}
              type="button"
              data-active={active || undefined}
              disabled={empty}
              onClick={() => {
                setActiveDay(d.dateKey)
                setSlot(null)
              }}
              className={cn(
                "flex min-w-[5.25rem] flex-col items-center rounded-xl border px-3 py-2 text-sm transition-[box-shadow,background-color,color] duration-150",
                active
                  ? "border-primary/40 bg-accent text-accent-foreground shadow-nm-pressed"
                  : "border-edge/35 bg-card shadow-nm-raised enabled:hover:text-primary",
                empty && "cursor-not-allowed opacity-45 shadow-nm-none",
              )}
            >
              <span className="text-xs">{relativeDay(i, d.weekdayLabel)}</span>
              <span className="font-medium">{d.dateLabel}</span>
              <span
                className={cn(
                  "mt-0.5 text-[10px] leading-none",
                  empty ? "text-muted-foreground" : "text-primary",
                )}
              >
                {empty ? (d.closed ? "Closed" : "Full") : `${d.slots.length} free`}
              </span>
            </button>
          )
        })}
      </div>

      {/* ── Slots, split by part of day ─────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>Available times</Label>
          {refreshing && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <RefreshCw className="size-3 animate-spin" /> Checking…
            </span>
          )}
        </div>

        {slotLost && (
          <p className={cn("rounded-lg px-3 py-2 text-xs", TONE.warning.tint)}>
            That time was booked by someone else while this page was open. Please pick another.
          </p>
        )}

        {!current || current.slots.length === 0 ? (
          <p className="rounded-xl border border-dashed border-edge/30 bg-background/40 px-3 py-6 text-center text-sm text-muted-foreground shadow-nm-inset">
            {current?.closed
              ? "The clinic is closed on this day."
              : "Every slot on this day is taken."}
          </p>
        ) : (
          groupSlots(current.slots).map((group) => {
            const Icon = PART_ICON[group.part]
            return (
              <div key={group.part}>
                <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Icon className="size-3.5" />
                  <span>{group.label}</span>
                  <span className="text-muted-foreground/70">· {group.slots.length}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {group.slots.map((s) => (
                    <button
                      key={s.startUtc}
                      type="button"
                      onClick={() => pick(s)}
                      aria-pressed={slot?.startUtc === s.startUtc}
                      // The clearest tactile metaphor in the product: a free
                      // slot is a key standing proud, the chosen one is a key
                      // held down. Colour changes too — depth is never the
                      // only cue.
                      className={cn(
                        "rounded-lg border px-2 py-2 text-sm font-medium tabular-nums transition-[box-shadow,background-color,color] duration-150",
                        slot?.startUtc === s.startUtc
                          ? "border-primary/50 bg-primary text-primary-foreground shadow-[inset_3px_3px_7px_color-mix(in_oklab,black_30%,transparent),inset_-3px_-3px_7px_color-mix(in_oklab,white_16%,transparent)]"
                          : "border-edge/35 bg-card shadow-nm-raised hover:text-primary hover:shadow-nm-float",
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )
          })
        )}
      </div>

      {slot && current && (
        <div className="flex items-center gap-2 rounded-xl border border-primary/25 bg-accent/60 px-3 py-2.5 text-sm shadow-nm-inset">
          <CalendarClock className="size-4 shrink-0 text-primary" />
          <span>
            Selected{" "}
            <span className="font-medium">
              {relativeDay(currentIndex, current.weekdayLabel)}, {current.dateLabel} · {slot.label}
            </span>
          </span>
        </div>
      )}
    </div>
  )

  return mode === "instant" ? (
    <InstantFlow
      slug={slug}
      slot={slot}
      clinic={clinic}
      picker={picker}
      onReset={() => setSlot(null)}
    />
  ) : (
    <ApproveFlow slug={slug} slot={slot} picker={picker} />
  )
}

/**
 * The primary action for a step.
 *
 * On a phone the slot grid is taller than the viewport, so a button placed
 * after it is below the fold for the entire time it matters — the patient
 * picks a time and then has to scroll to act on it. `sticky bottom-*` keeps
 * the same single element in view while the grid scrolls under it, rather
 * than rendering a second duplicate button in a fixed bar. On `sm` and up
 * the grid fits and the button returns to normal flow.
 */
function StickyAction({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky bottom-0 z-20 -mx-6 mt-2 border-t border-border/60 bg-card/85 px-6 py-3 backdrop-blur-sm sm:static sm:m-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
      {children}
    </div>
  )
}

/* ── Step indicator (instant flow) ──────────────────────────────────────────── */
const INSTANT_STEPS = ["Time", "Verify", "Details"]

function Stepper({ current }: { current: number }) {
  return (
    <ol className="mb-6 flex items-center">
      {INSTANT_STEPS.map((label, i) => {
        const done = i < current
        const active = i === current
        const isLast = i === INSTANT_STEPS.length - 1
        return (
          <li key={label} className={cn("flex items-center", !isLast && "flex-1")}>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                  done && "bg-primary text-primary-foreground",
                  active && "bg-primary text-primary-foreground ring-4 ring-accent",
                  !done && !active && "bg-muted text-muted-foreground",
                )}
              >
                {done ? <Check className="size-3.5" /> : i + 1}
              </span>
              <span
                className={cn(
                  "hidden text-xs sm:inline",
                  active ? "font-medium text-foreground" : "text-muted-foreground",
                )}
              >
                {label}
              </span>
            </div>
            {!isLast && <span className="mx-2 h-px flex-1 bg-border" />}
          </li>
        )
      })}
    </ol>
  )
}

/* ── Phone field: a +91 that is furniture, not something to type ───────────── */
function PhoneField({
  id,
  value,
  onChange,
  onEnter,
}: {
  id: string
  value: string
  onChange: (v: string) => void
  onEnter?: () => void
}) {
  return (
    <div className="flex items-stretch rounded-lg border border-input bg-card shadow-nm-inset focus-within:ring-2 focus-within:ring-ring/40">
      <span className="flex select-none items-center border-r border-input px-3 text-sm font-medium text-muted-foreground">
        +91
      </span>
      <input
        id={id}
        // `tel`, not `numeric` alone: it is the keypad Android and iOS both
        // show for a phone number, and it lets the browser offer the number
        // it already has saved.
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        maxLength={10}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 10))}
        onKeyDown={(e) => {
          if (e.key === "Enter" && onEnter) {
            e.preventDefault()
            onEnter()
          }
        }}
        placeholder="98765 43210"
        className="w-full bg-transparent px-3 py-2 text-base tabular-nums outline-none placeholder:text-muted-foreground/60 md:text-sm"
      />
    </div>
  )
}

/* ── Approve mode: request → doctor confirms later ──────────────────────────── */
function ApproveFlow({
  slug,
  slot,
  picker,
}: {
  slug: string
  slot: Slot | null
  picker: React.ReactNode
}) {
  const action = submitBooking.bind(null, slug)
  const [state, formAction, pending] = useActionState<BookingState, FormData>(action, undefined)

  if (state?.ok)
    return (
      <Success
        heading="Request received"
        body="The clinic will confirm your appointment shortly. You'll get a WhatsApp message once it's confirmed."
      />
    )

  return (
    <form action={formAction} className="space-y-6">
      {picker}
      <input type="hidden" name="starts_at" value={slot?.startUtc ?? ""} />
      <Details />
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <StickyAction>
        <Button type="submit" className="w-full" disabled={pending || !slot}>
          {pending ? "Requesting…" : slot ? `Request appointment at ${slot.label}` : "Select a time slot"}
        </Button>
      </StickyAction>
    </form>
  )
}

/* ── Instant mode: pick → phone → OTP → details → confirmed ─────────────────── */
type Step = "pick" | "otp" | "details" | "done"

function InstantFlow({
  slug,
  slot,
  clinic,
  picker,
  onReset,
}: {
  slug: string
  slot: Slot | null
  clinic: BookingClinic
  picker: React.ReactNode
  onReset: () => void
}) {
  const [step, setStep] = useState<Step>("pick")
  const [phone, setPhone] = useState("")
  const [otpId, setOtpId] = useState("")
  const [code, setCode] = useState("")
  const [devCode, setDevCode] = useState<string | undefined>()
  const [verifyToken, setVerifyToken] = useState("")
  const [knownName, setKnownName] = useState("")
  const [name, setName] = useState("")
  const [reason, setReason] = useState("")
  const [consent, setConsent] = useState(true)
  const [resendIn, setResendIn] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<BookedResult | null>(null)
  const [pending, start] = useTransition()

  useEffect(() => {
    if (resendIn <= 0) return
    const t = setTimeout(() => setResendIn((n) => n - 1), 1000)
    return () => clearTimeout(t)
  }, [resendIn])

  function sendCode() {
    setError(null)
    start(async () => {
      const res = await requestBookingOtp(slug, phone)
      if (!res.ok) {
        setError(res.error ?? "Couldn't send the code.")
        return
      }
      setOtpId(res.otpId!)
      setDevCode(res.devCode)
      setResendIn(res.resendAfter ?? 45)
      setStep("otp")
    })
  }

  function verify(codeOverride?: string) {
    const submitted = codeOverride ?? code
    if (submitted.length !== 6) return
    setError(null)
    start(async () => {
      const res = await verifyBookingOtp(slug, phone, otpId, submitted)
      if (!res.ok) {
        setError(res.error ?? "Verification failed.")
        setCode("")
        return
      }
      setVerifyToken(res.verifyToken!)
      if (res.knownName) {
        setKnownName(res.knownName)
        setName(res.knownName)
      }
      setStep("details")
    })
  }

  function confirm() {
    setError(null)
    start(async () => {
      const res = await confirmVerifiedBooking(slug, verifyToken, {
        name,
        startsAt: slot?.startUtc ?? "",
        reason,
        consent,
      })
      if (res.slotTaken) {
        setError("That slot was just taken. Please pick another time.")
        setStep("pick")
        onReset()
        return
      }
      if (!res.ok) {
        setError(res.error ?? "Could not confirm.")
        return
      }
      setResult({
        token: res.tokenNumber,
        timeLabel: res.timeLabel,
        dateLabel: res.dateLabel,
        startUtc: res.startsAtUtc ?? slot?.startUtc,
        endUtc: slot?.endUtc,
        appointmentId: res.appointmentId,
      })
      setStep("done")
    })
  }

  if (step === "done") {
    return <Booked result={result} clinic={clinic} />
  }

  // Phone entry shares the "otp" step but shows before a code is issued.
  const stepIndex = step === "pick" ? 0 : step === "otp" ? 1 : 2

  return (
    <div className="space-y-6">
      <Stepper current={stepIndex} />

      {step === "pick" && (
        <>
          {picker}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <StickyAction>
            <Button
              type="button"
              className="w-full"
              disabled={!slot}
              onClick={() => {
                setError(null)
                setOtpId("") // otp step renders phone entry until a code is issued
                setStep("otp")
              }}
            >
              {slot ? `Continue with ${slot.label}` : "Select a time slot"}
            </Button>
          </StickyAction>
        </>
      )}

      {step === "otp" && !otpId && (
        <div className="space-y-4">
          <BackButton onClick={() => setStep("pick")} />
          <p className="text-sm text-muted-foreground">
            We&apos;ll send a verification code to your WhatsApp/SMS to confirm{" "}
            <span className="font-medium text-foreground">{slot?.label}</span>.
          </p>
          <div className="space-y-2">
            <Label htmlFor="otp_phone">Mobile number</Label>
            <PhoneField id="otp_phone" value={phone} onChange={setPhone} onEnter={sendCode} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button
            type="button"
            className="w-full"
            disabled={pending || phone.length !== 10}
            onClick={sendCode}
          >
            {pending ? "Sending…" : "Send code"}
          </Button>
        </div>
      )}

      {step === "otp" && otpId && (
        <div className="space-y-4">
          <BackButton onClick={() => { setOtpId(""); setCode(""); setError(null) }} />
          <p className="text-sm text-muted-foreground">
            Enter the 6-digit code sent to <span className="font-medium text-foreground">+91 {phone}</span>.
          </p>
          {devCode && (
            <p className={cn("rounded-md px-3 py-2 text-xs", TONE.warning.tint)}>
              Dev mode: your code is <span className="font-mono font-semibold">{devCode}</span>
            </p>
          )}
          <OtpInput
            value={code}
            onChange={setCode}
            // Six digits in means there is nothing left to decide. Making the
            // patient reach for a button after the last keystroke — or after
            // an autofill that filled all six at once — is a step that exists
            // only because the form was built around a submit button.
            onComplete={(full) => verify(full)}
            disabled={pending}
            invalid={!!error}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button
            type="button"
            className="w-full"
            disabled={pending || code.length !== 6}
            onClick={() => verify()}
          >
            {pending ? "Verifying…" : "Verify & continue"}
          </Button>
          <button
            type="button"
            disabled={resendIn > 0 || pending}
            onClick={sendCode}
            className="w-full text-center text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
          >
            {resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
          </button>
        </div>
      )}

      {step === "details" && (
        <div className="space-y-4">
          <p className={cn("flex items-center gap-1.5 text-sm font-medium", TONE.success.text)}>
            <Check className="size-4" /> Phone verified
          </p>
          <p className="text-sm text-muted-foreground">
            Confirm your details for{" "}
            <span className="font-medium text-foreground">{slot?.label}</span>.
          </p>
          <div className="space-y-2">
            <Label htmlFor="patient_name">Your name</Label>
            <Input
              id="patient_name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              required
            />
            {knownName && <p className="text-xs text-muted-foreground">Welcome back, {knownName}.</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="patient_reason">Reason (optional)</Label>
            <Input
              id="patient_reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Fever, checkup…"
            />
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 size-4 rounded border-input"
            />
            <span className="text-muted-foreground">
              I agree to receive appointment updates from the clinic on WhatsApp.
            </span>
          </label>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="button" className="w-full" disabled={pending || name.trim().length < 2} onClick={confirm}>
            {pending ? "Confirming…" : "Confirm booking"}
          </Button>
        </div>
      )}
    </div>
  )
}

function Details() {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Your name</Label>
          <Input id="name" name="name" autoComplete="name" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Mobile number</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="98765 43210"
            required
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="reason">Reason (optional)</Label>
        <Input id="reason" name="reason" placeholder="Fever, checkup…" />
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="consent" defaultChecked className="mt-0.5 size-4 rounded border-input" />
        <span className="text-muted-foreground">
          I agree to receive appointment updates from the clinic on WhatsApp.
        </span>
      </label>
    </>
  )
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="size-3.5" /> Back
    </button>
  )
}

/* ── Confirmed ──────────────────────────────────────────────────────────────── */

type BookedResult = {
  token?: number
  timeLabel?: string
  dateLabel?: string
  startUtc?: string
  endUtc?: string
  appointmentId?: string
}

/** Default consultation length when the slot's own end time is unavailable. */
const FALLBACK_SLOT_MINUTES = 15

/**
 * The confirmation screen.
 *
 * The old one said "you're all set" and stopped. But the moment right after
 * booking is the only moment a patient is holding both the appointment and
 * their phone, and it is where the no-show is either prevented or not: an
 * appointment that reaches their calendar gets an alarm, a route and a place
 * in their day, while one that only exists in a WhatsApp message gets scrolled
 * past. Everything here is a link they can act on with one tap and never
 * return to this page.
 */
function Booked({ result, clinic }: { result: BookedResult | null; clinic: BookingClinic }) {
  const start = result?.startUtc
  const end =
    result?.endUtc ??
    (start ? new Date(new Date(start).getTime() + FALLBACK_SLOT_MINUTES * 60_000).toISOString() : undefined)

  const calendarEvent =
    start && end
      ? {
          title: `Appointment — ${clinic.name}`,
          description: [
            `With ${clinic.doctorName}.`,
            result?.token != null ? `Token #${result.token}.` : null,
            clinic.phone ? `Clinic: ${clinic.phone}` : null,
          ]
            .filter(Boolean)
            .join(" "),
          location: clinic.address ?? clinic.name,
          startUtc: start,
          endUtc: end,
          // Stable per appointment, so re-adding replaces rather than
          // duplicates. Falls back to the instant, which is unique per
          // patient per clinic anyway.
          uid: `${result?.appointmentId ?? start}@clinicflow`,
        }
      : null

  const mapsHref = clinic.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        `${clinic.name} ${clinic.address}`,
      )}`
    : null

  return (
    <div className="animate-rise rounded-xl border bg-card p-6 text-center sm:p-8">
      <div className="animate-pop mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-success/12 ring-8 ring-success/5">
        <CheckCircle2 className="size-9 text-success" />
      </div>
      <h2 className="font-heading text-xl font-semibold">You&apos;re all set</h2>

      {(result?.dateLabel || result?.timeLabel) && (
        <p className="mt-1 font-heading text-lg font-semibold text-primary">
          {[result.dateLabel, result.timeLabel].filter(Boolean).join(" · ")}
        </p>
      )}
      <p className="mt-1 text-sm text-muted-foreground">
        {clinic.name} · {clinic.doctorName}
      </p>

      {result?.token != null && (
        <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-accent px-4 py-1.5 font-heading text-lg font-semibold text-accent-foreground shadow-nm-inset">
          Token #{result.token}
        </p>
      )}

      <p className="mx-auto mt-3 max-w-xs text-sm text-muted-foreground">
        We&apos;ve sent the details to your WhatsApp. Please arrive about 10 minutes early.
      </p>

      {calendarEvent && (
        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          <a
            href={googleCalendarUrl(calendarEvent)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-edge/35 bg-card px-3 py-2.5 text-sm font-medium shadow-nm-raised transition-[box-shadow,color] hover:text-primary active:shadow-nm-pressed"
          >
            <CalendarPlus className="size-4" /> Google Calendar
          </a>
          <a
            href={icsDataUrl(calendarEvent)}
            download={`appointment-${clinic.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.ics`}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-edge/35 bg-card px-3 py-2.5 text-sm font-medium shadow-nm-raised transition-[box-shadow,color] hover:text-primary active:shadow-nm-pressed"
          >
            <Download className="size-4" /> Apple / Outlook
          </a>
        </div>
      )}

      {(mapsHref || clinic.phone) && (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {mapsHref && (
            <a
              href={mapsHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-edge/35 bg-card px-3 py-2.5 text-sm font-medium shadow-nm-raised transition-[box-shadow,color] hover:text-primary active:shadow-nm-pressed"
            >
              <MapPin className="size-4" /> Directions
            </a>
          )}
          {clinic.phone && (
            <a
              href={`tel:${clinic.phone}`}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-edge/35 bg-card px-3 py-2.5 text-sm font-medium shadow-nm-raised transition-[box-shadow,color] hover:text-primary active:shadow-nm-pressed"
            >
              <Phone className="size-4" /> Call clinic
            </a>
          )}
        </div>
      )}
    </div>
  )
}

function Success({ heading, body, token }: { heading: string; body: string; token?: number }) {
  return (
    <div className="animate-rise rounded-xl border bg-card p-8 text-center">
      <div className="animate-pop mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-success/12 ring-8 ring-success/5">
        <CheckCircle2 className="size-9 text-success" />
      </div>
      <h2 className="font-heading text-xl font-semibold">{heading}</h2>
      {token != null && (
        <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-accent px-4 py-1.5 font-heading text-lg font-semibold text-accent-foreground">
          Token #{token}
        </p>
      )}
      <p className="mx-auto mt-3 max-w-xs text-sm text-muted-foreground">{body}</p>
    </div>
  )
}

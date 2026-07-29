import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getBookingContext } from "@/lib/booking-context"
import { istDateKey, istWeekday } from "@/lib/format"
import { buildBookingDays, relativeDay } from "@/lib/booking-days"
import { BookingWidget, type BookingClinic } from "@/components/booking/booking-widget"
import { PublicShell, PublicCard } from "@/components/public-shell"
import { logoUrlFromPath } from "@/lib/clinic"
import { cn } from "@/lib/utils"
import { TONE } from "@/lib/status"
import { MapPin, Phone, Clock, CalendarX2 } from "lucide-react"

/**
 * Per-clinic title, description and OG card. This link is the one doctors
 * share on WhatsApp, so it must preview as the clinic — not as ClinicFlow.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const ctx = await getBookingContext(slug)
  const clinic = ctx?.clinic
  if (!ctx?.found || !clinic) {
    return { title: "Clinic not found", robots: { index: false } }
  }

  const title = `Book an appointment — ${clinic.name}`
  const description = [
    `Book online with ${clinic.doctor_name}`,
    clinic.specialty,
    clinic.address,
  ]
    .filter(Boolean)
    .join(" · ")

  return {
    title,
    description,
    alternates: { canonical: `/book/${clinic.slug}` },
    openGraph: { type: "website", title, description, url: `/book/${clinic.slug}` },
    twitter: { card: "summary_large_image", title, description },
  }
}

/** "09:00:00" → "9:00 AM" without dragging a timezone through it. */
function prettyTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number)
  const suffix = h < 12 ? "AM" : "PM"
  const hour = h % 12 === 0 ? 12 : h % 12
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`
}

export default async function BookingPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const ctx = await getBookingContext(slug)

  if (!ctx?.found) notFound()

  if (ctx.enabled === false || !ctx.clinic) {
    return (
      <PublicShell>
        <PublicCard className="p-8 text-center">
          <h1 className="font-heading text-lg font-semibold">{ctx.clinic?.name ?? "This clinic"}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Online booking is currently unavailable. Please call the clinic to book.
          </p>
        </PublicCard>
      </PublicShell>
    )
  }

  const clinic = ctx.clinic
  const clinicLogo = logoUrlFromPath(clinic.logo_path)

  const days = buildBookingDays({
    availability: ctx.availability,
    overrides: ctx.overrides,
    blocks: ctx.blocks,
    booked: ctx.booked,
    slotMinutes: clinic.settings.slot_minutes,
    leadMinutes: clinic.settings.lead_time_minutes,
  })

  const firstOpenIndex = days.findIndex((d) => d.slots.length > 0)
  const firstOpen = firstOpenIndex >= 0 ? days[firstOpenIndex] : null

  // Today's advertised hours, straight from the availability rows. A patient
  // deciding whether to walk in instead reads this line before anything else,
  // and it answers a question the slot grid cannot: the grid hides past slots,
  // so a clinic that is open until 9pm looks shut at 8:55.
  const todayKey = istDateKey()
  const todayOverride = (ctx.overrides ?? []).find((o) => o.date === todayKey)
  const todayWindows = todayOverride?.closed
    ? []
    : todayOverride?.start_time && todayOverride.end_time
      ? [{ start_time: todayOverride.start_time, end_time: todayOverride.end_time }]
      : (ctx.availability ?? []).filter((s) => s.weekday === istWeekday(todayKey))
  const todayHours = todayWindows
    .map((w) => `${prettyTime(w.start_time)} – ${prettyTime(w.end_time)}`)
    .join(", ")

  const clinicForWidget: BookingClinic = {
    name: clinic.name,
    doctorName: clinic.doctor_name,
    address: clinic.address,
    phone: clinic.phone,
  }

  const mapsHref = clinic.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        `${clinic.name} ${clinic.address}`,
      )}`
    : null

  return (
    <PublicShell logo={clinicLogo} brandName={clinic.name}>
      <PublicCard className="animate-rise mb-6">
        <h1 className="font-heading text-2xl font-semibold">{clinic.name}</h1>
        <p className="text-sm text-muted-foreground">
          {clinic.doctor_name}
          {clinic.specialty ? ` · ${clinic.specialty}` : ""}
        </p>

        <div className="mt-3 flex flex-col gap-1.5 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            {todayHours ? (
              <>
                <Clock className="size-3.5 shrink-0" />
                <span>
                  Open today <span className="font-medium text-foreground">{todayHours}</span>
                </span>
              </>
            ) : (
              <>
                <CalendarX2 className="size-3.5 shrink-0" />
                <span>Closed today</span>
              </>
            )}
          </span>
          {clinic.address && (
            <span className="flex items-center gap-1.5">
              <MapPin className="size-3.5 shrink-0" /> {clinic.address}
            </span>
          )}
          {clinic.phone && (
            <span className="flex items-center gap-1.5">
              <Phone className="size-3.5 shrink-0" /> {clinic.phone}
            </span>
          )}
        </div>

        {/* Call and directions are the two things a patient reaches for when
            the slot grid does not have what they want. They sit here, above
            the widget, so nobody has to scroll past 30 slot chips to find
            them — and they are real `tel:`/maps links, not buttons that open
            a dialog asking the patient to copy a number. */}
        {(clinic.phone || mapsHref) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {clinic.phone && (
              <a
                href={`tel:${clinic.phone}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-edge/35 bg-card px-3 py-1.5 text-xs font-medium shadow-nm-raised transition-[box-shadow,color] hover:text-primary active:shadow-nm-pressed"
              >
                <Phone className="size-3.5" /> Call clinic
              </a>
            )}
            {mapsHref && (
              <a
                href={mapsHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-edge/35 bg-card px-3 py-1.5 text-xs font-medium shadow-nm-raised transition-[box-shadow,color] hover:text-primary active:shadow-nm-pressed"
              >
                <MapPin className="size-3.5" /> Directions
              </a>
            )}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-3 text-xs">
          <span className={cn("inline-flex items-center gap-1.5 font-medium", TONE.success.text)}>
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-live-dot rounded-full bg-success" />
            </span>
            Accepting online bookings
          </span>
          {firstOpen && (
            <span className="text-muted-foreground">
              Next available{" "}
              <span className="font-medium text-foreground">
                {relativeDay(firstOpenIndex, firstOpen.weekdayLabel).toLowerCase()} ·{" "}
                {firstOpen.slots[0].label}
              </span>
            </span>
          )}
        </div>
      </PublicCard>

      <PublicCard className="animate-rise [animation-delay:80ms]">
        <h2 className="mb-4 font-heading text-base font-semibold">Book an appointment</h2>
        <BookingWidget
          slug={slug}
          days={days}
          clinic={clinicForWidget}
          mode={clinic.settings.booking_mode ?? "instant"}
        />
      </PublicCard>
    </PublicShell>
  )
}

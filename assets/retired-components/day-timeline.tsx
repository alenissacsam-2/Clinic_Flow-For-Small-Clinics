"use client"

import { useRef } from "react"
import {
  motion,
  useMotionValueEvent,
  useScroll,
  useTransform,
  type MotionValue,
} from "motion/react"
import {
  BellRing,
  FileSignature,
  IndianRupee,
  Moon,
  MoonStar,
  UserCheck,
  type LucideIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * The manifesto's sentence, actually happening.
 *
 * The band above this one *claims* a day runs itself. This one runs it: a
 * 24-hour dial whose hand, arc and clock readout are all bound to scroll
 * position, and six real events that light as the playhead reaches them. The
 * visitor is not watching a loop play at them — they are driving it, at their
 * own speed, and can scrub back. That is the whole reason it earns its screen
 * space over another row of feature cards.
 *
 * ── One MotionValue, four consumers ──────────────────────────────────────
 * `scrollYProgress` over the grid drives the hand's rotation, the arc's
 * `pathLength`, the rail's `scaleY` and the clock text. Nothing here is in
 * React state and nothing re-renders on scroll; every consumer is either a
 * compositor-bound transform or, for the clock, one `textContent` write per
 * frame on a ref.
 *
 * The event times are NOT evenly spaced, and that is deliberate — three of the
 * six land inside twenty minutes of one consultation, so the hand crawls
 * through late morning and then sweeps to close. A clinic day is lumpy; a dial
 * that ticked evenly would be a progress bar wearing a clock face.
 *
 * ── Why the hand is HTML and the dial is SVG ─────────────────────────────
 * The ring, ticks and arc want crisp vector geometry, so they are SVG. The hand
 * wants a rotation that is unambiguously the CSS `transform` property, so it is
 * a plain absolutely-positioned div over the top: SVG elements accept
 * transforms from two different systems (the `transform` attribute and the CSS
 * property) and mixing a library's transform writes with a viewBox coordinate
 * origin is a well-known source of "why is it orbiting" bugs. A div rotating
 * about its own centre has exactly one interpretation.
 *
 * `data-band="dark"` is load-bearing, not decorative — `site-header.tsx`
 * measures every element carrying it and inverts the glass nav across it.
 * `nm-dark-surface` is mandatory for the same reason it is on the manifesto:
 * without it every raised element on this band paints a light-theme highlight
 * onto near-black.
 */

type DayEvent = {
  /** Clock time, and the same value in decimal hours for the dial. */
  label: string
  hour: number
  icon: LucideIcon
  title: string
  body: string
  chip: string
}

const EVENTS: DayEvent[] = [
  {
    label: "00:12",
    hour: 0.2,
    icon: MoonStar,
    title: "Riya books. You are asleep.",
    body: "She taps your link, takes 11:30 tomorrow, and has her confirmation before she puts the phone down.",
    chip: "Confirmed · Token #4",
  },
  {
    label: "09:30",
    hour: 9.5,
    icon: BellRing,
    title: "The reminder goes on its own",
    body: "Two hours out, WhatsApp nudges her. Nobody at your desk dialled a number, and she does not become a no-show.",
    chip: "Reminder delivered",
  },
  {
    label: "11:26",
    hour: 11.43,
    icon: UserCheck,
    title: "She checks in",
    body: "The queue re-orders itself and the waiting-room screen updates. No one has to stand up and call a name.",
    chip: "Now serving #3",
  },
  {
    label: "11:41",
    hour: 11.68,
    icon: FileSignature,
    title: "You prescribe",
    body: "Medicine autocomplete, dosage chips, an allergy check against her record. You sign, and the PDF leaves before she reaches the door.",
    chip: "Prescription.pdf sent",
  },
  {
    label: "11:44",
    hour: 11.73,
    icon: IndianRupee,
    title: "She pays at the desk",
    body: "Your own UPI QR, receipt straight to WhatsApp, invoice closed. Nothing to reconcile from a cash box tonight.",
    chip: "₹450 received · UPI",
  },
  {
    label: "19:00",
    hour: 19,
    icon: Moon,
    title: "You close",
    body: "The day's takings are totalled and tomorrow's list is already ordered. There is nothing to write up. The register stays shut.",
    chip: "Day closed",
  },
]

/** Even scroll stops, one per event — the *times* are uneven, the scrubbing isn't. */
const STOPS = EVENTS.map((_, i) => i / (EVENTS.length - 1))

export function DayTimeline() {
  const ref = useRef<HTMLDivElement>(null)
  const clock = useRef<HTMLSpanElement>(null)
  const tally = useRef<HTMLSpanElement>(null)

  const { scrollYProgress } = useScroll({
    target: ref,
    // Starts scrubbing while the first card is still low on screen and finishes
    // just above centre, so the last event lights before the band scrolls out.
    offset: ["start 75%", "end 60%"],
  })

  // Every input range below stays inside [0, 1]. Motion hands scroll-linked
  // values to the browser's native ScrollTimeline where the input range becomes
  // WAAPI keyframe *offsets*, and those throw outside [0, 1].
  const rotate = useTransform(
    scrollYProgress,
    STOPS,
    EVENTS.map((e) => (e.hour / 24) * 360),
  )
  const arc = useTransform(
    scrollYProgress,
    STOPS,
    // Never exactly 0: a zero-length round-capped stroke disappears entirely,
    // and the dial reads as broken rather than as "the day hasn't started".
    EVENTS.map((e) => Math.max(e.hour / 24, 0.008)),
  )
  const hour = useTransform(
    scrollYProgress,
    STOPS,
    EVENTS.map((e) => e.hour),
  )

  useMotionValueEvent(hour, "change", (h) => {
    const el = clock.current
    if (!el) return
    // Whole minutes, carried properly — rounding hours and minutes separately
    // produces 11:60.
    const total = Math.round(h * 60)
    const hh = String(Math.floor(total / 60) % 24).padStart(2, "0")
    const mm = String(total % 60).padStart(2, "0")
    el.textContent = `${hh}:${mm}`
  })

  useMotionValueEvent(scrollYProgress, "change", (v) => {
    const el = tally.current
    if (!el) return
    // How many events the playhead has reached, floored at one — the first
    // event is already lit when the section arrives.
    const done = Math.min(EVENTS.length, Math.max(1, Math.round(v * (EVENTS.length - 1)) + 1))
    el.textContent = String(done)
  })

  return (
    <section
      data-band="dark"
      className="nm-dark-surface bg-grain relative isolate bg-sidebar text-sidebar-foreground"
    >
      {/* The clipping lives on this layer, NOT on the section.
          `overflow: hidden` anywhere above a `position: sticky` element makes
          that box the sticky element's scrollport — and since this box does not
          itself scroll, the dial below would simply never stick and would scroll
          away with the rest of the band. It looks like the sticky "not working";
          it is actually working perfectly against the wrong container. So the
          glow gets its own clipped layer and the section stays `visible`. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="glow-primary animate-glow-drift absolute top-1/3 -right-40 size-[38rem] rounded-full opacity-60 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 pb-28 sm:pb-36">
        <div className="max-w-xl">
          <p className="font-mono text-xs tracking-[0.22em] text-sidebar-primary">00:12 → 19:00</p>
          <h2 className="mt-4 font-heading text-4xl font-extrabold tracking-[-0.04em] text-balance sm:text-5xl">
            One day, running itself
          </h2>
          <p className="mt-4 text-lg text-sidebar-foreground/70">
            The same Tuesday your clinic already has, with nobody typing anything twice. Scroll it.
          </p>
        </div>

        <div
          ref={ref}
          data-day-grid
          className={cn(
            // The dial column is wider than the dial on purpose: the tick marks
            // are drawn outside the SVG's nominal box, and at an exact fit they
            // ran into the page gutter on a 390px screen.
            "mt-14 grid grid-cols-[5.5rem_1fr] gap-x-3",
            "sm:grid-cols-[7rem_1fr] sm:gap-x-8",
            "lg:grid-cols-[15rem_1fr] lg:gap-x-16",
          )}
        >
          {/* The grid cell stretches to the row's full height, which is what
              gives `sticky` somewhere to travel.

              `data-day-dial` removes the whole column under reduced motion — a
              hand sweeping a clock face is the single most vestibular thing on
              this page. Nothing is lost by dropping it: every event card states
              its own time, so the dial was always the ornament and never the
              record. */}
          <div data-day-dial>
            <div className="sticky top-24 lg:top-32">
              <Dial rotate={rotate} arc={arc} />
              <Clock clockRef={clock} />
              <Tally tallyRef={tally} />
            </div>
          </div>

          <ol className="relative">
            {/* Rail: an unlit hairline with a lit copy scaling down it. Two
                elements rather than one animated gradient, because scaleY on a
                solid bar is a compositor transform and a gradient stop is not. */}
            <span
              aria-hidden
              className="pointer-events-none absolute top-3 bottom-8 left-[7px] w-px bg-white/12"
            />
            <motion.span
              aria-hidden
              data-day-rail
              style={{ scaleY: scrollYProgress }}
              className="pointer-events-none absolute top-3 bottom-8 left-[7px] w-px origin-top bg-sidebar-primary"
            />

            {EVENTS.map((e, i) => (
              <Event key={e.label} event={e} progress={scrollYProgress} index={i} />
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}

/* ── The dial ─────────────────────────────────────────────────────────────
   200×200 viewBox, midnight at twelve o'clock. Sized in three steps so it
   survives a 390px phone as a legible ornament and becomes the section's
   centrepiece on a laptop. */
function Dial({ rotate, arc }: { rotate: MotionValue<number>; arc: MotionValue<number> }) {
  return (
    <div className="relative mx-auto size-[4.5rem] sm:size-24 lg:size-56">
      <svg viewBox="0 0 200 200" className="size-full overflow-visible" aria-hidden>
        {/* Hour ticks. Every sixth (00, 06, 12, 18) is longer and brighter, so
            the dial can still be read at 72px where the minor ticks blur into
            a texture. */}
        {Array.from({ length: 24 }, (_, i) => {
          const major = i % 6 === 0
          return (
            <line
              key={i}
              x1="100"
              y1={major ? 8 : 12}
              x2="100"
              y2={major ? 20 : 17}
              stroke="currentColor"
              strokeWidth={major ? 3 : 1.5}
              strokeLinecap="round"
              className={major ? "text-white/45" : "text-white/15"}
              transform={`rotate(${i * 15} 100 100)`}
            />
          )
        })}

        {/* Track and the elapsed arc, both starting at midnight. */}
        <circle cx="100" cy="100" r="76" fill="none" strokeWidth="7" className="stroke-white/10" />
        <motion.circle
          cx="100"
          cy="100"
          r="76"
          fill="none"
          strokeWidth="7"
          strokeLinecap="round"
          className="stroke-sidebar-primary"
          transform="rotate(-90 100 100)"
          style={{ pathLength: arc }}
        />
      </svg>

      {/* Hand, over the top as plain HTML — see the note at the head of the
          file for why this is not an SVG <g>. */}
      <motion.div
        aria-hidden
        style={{ rotate }}
        className="pointer-events-none absolute inset-0"
      >
        <span className="absolute top-[12%] left-1/2 h-[38%] w-[3px] origin-bottom -translate-x-1/2 rounded-full bg-gradient-to-t from-sidebar-primary to-white" />
        <span className="absolute top-[9%] left-1/2 size-2 -translate-x-1/2 rounded-full bg-white shadow-[0_0_12px_2px_var(--sidebar-primary)] lg:size-2.5" />
      </motion.div>

      <span
        aria-hidden
        className="absolute top-1/2 left-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white lg:size-3"
      />
    </div>
  )
}

/**
 * The clock, under the dial rather than inside it — the hand pivots through the
 * middle of the face, and a readout there gets crossed by it twice a day.
 *
 * Its text is written imperatively by the scroll subscription, so the value
 * rendered here is the first event's real time rather than a placeholder that
 * would visibly correct itself on the first scroll event.
 */
function Clock({ clockRef }: { clockRef: React.RefObject<HTMLSpanElement | null> }) {
  return (
    <div className="mt-4 hidden text-center sm:block">
      <span
        ref={clockRef}
        className="font-mono text-lg font-semibold tracking-tight tabular-nums lg:text-2xl"
      >
        00:12
      </span>
      <p className="mt-1 font-mono text-[0.625rem] tracking-[0.18em] text-sidebar-foreground/40">
        CLINIC TIME
      </p>
    </div>
  )
}

/**
 * The running total under the clock, and the punchline of the whole section.
 *
 * The dial column is sticky and tall, so on a wide screen it had a metre of
 * empty indigo below it. What fills it is the only number that matters: however
 * many events have gone by, the doctor's share of them is still zero minutes.
 * It reads as a live counter because it is one — same MotionValue as the dial,
 * same one-`textContent`-write-per-frame discipline as the clock.
 */
function Tally({ tallyRef }: { tallyRef: React.RefObject<HTMLSpanElement | null> }) {
  return (
    <div className="mt-8 hidden rounded-2xl border border-white/10 bg-white/[0.04] p-4 lg:block">
      <p className="font-mono text-[0.625rem] tracking-[0.18em] text-sidebar-foreground/40">
        HANDLED SO FAR
      </p>
      <p className="mt-2 font-heading text-3xl font-extrabold tracking-[-0.03em] tabular-nums">
        <span ref={tallyRef}>1</span>
        <span className="text-lg text-sidebar-foreground/35"> / {EVENTS.length}</span>
      </p>
      <p className="mt-3 border-t border-white/10 pt-3 text-xs leading-relaxed text-sidebar-foreground/55">
        Your share of them:{" "}
        <span className="font-semibold text-sidebar-primary">nought minutes</span>.
      </p>
    </div>
  )
}

function Event({
  event,
  progress,
  index,
}: {
  event: DayEvent
  progress: MotionValue<number>
  index: number
}) {
  const span = EVENTS.length - 1
  const at = index / span
  // Each event lights over the half-step before its own stop, so it is fully lit
  // exactly as the dial's hand arrives on its time. The first event has no
  // half-step before it, hence the clamp — and `to` is nudged past `from` because
  // a zero-width input range is not a valid interpolation.
  const from = Math.max(at - 0.55 / span, 0)
  const to = Math.max(at, from + 0.0001)

  const opacity = useTransform(progress, [from, to], [0.3, 1])
  const x = useTransform(progress, [from, to], [16, 0])

  const Icon = event.icon

  return (
    <motion.li
      data-day-event
      style={{ opacity, x }}
      className="relative pl-8 pb-4 sm:pl-10 last:pb-0"
    >
      {/* The dot sits ON the rail, so its left offset is the rail's minus half
          its own width. */}
      <span
        aria-hidden
        className="absolute top-6 left-0 size-[15px] rounded-full border-2 border-sidebar-primary bg-sidebar shadow-[0_0_14px_2px_color-mix(in_oklab,var(--sidebar-primary)_55%,transparent)]"
      />

      <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4 sm:p-5">
        <div className="flex items-center gap-2.5">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary/20 text-sidebar-primary">
            <Icon className="size-3.5" />
          </span>
          <span className="font-mono text-xs tracking-[0.14em] text-sidebar-foreground/55 tabular-nums">
            {event.label}
          </span>
        </div>

        <h3 className="mt-3 font-heading text-lg font-bold tracking-[-0.025em] text-balance sm:text-xl">
          {event.title}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-sidebar-foreground/70">{event.body}</p>

        <span className="mt-4 inline-flex items-center gap-2 rounded-full bg-sidebar-primary/15 px-3 py-1.5 text-xs font-medium text-sidebar-primary">
          <span className="animate-live-dot size-1.5 rounded-full bg-current" />
          {event.chip}
        </span>
      </div>
    </motion.li>
  )
}

"use client"

import { useRef } from "react"
import { motion, useMotionValueEvent, useScroll, useTransform, type MotionValue } from "motion/react"
import {
  BellRing,
  FileSignature,
  IndianRupee,
  Moon,
  MoonStar,
  UserCheck,
  type LucideIcon,
} from "lucide-react"

import { ScrollSkew } from "./motion-primitives"

/**
 * The clinic day: one sentence, told on the clock.
 *
 * ── The bug this section keeps trying to have ─────────────────────────────
 * This began as two adjacent dark bands. `Manifesto` set a sentence that lit
 * word by word; `DayTimeline` then ran a 24-hour dial past six event cards. They
 * were the same six beats twice — the sentence *listed* the day and the timeline
 * *showed* it — so reading straight through, the second half felt like the page
 * repeating itself, because it was.
 *
 * The first attempt at a fix pinned the sentence above the cards so each clause
 * lit as its own card arrived. That synchronised the duplication; it did not
 * remove it. Every beat was still written out twice, once as a clause and once
 * as a card title plus body, and pinning them together only guaranteed you saw
 * both. It was more reading for the same information.
 *
 * ── What actually fixes it ────────────────────────────────────────────────
 * Delete one of the two copies. The clause *is* the beat's headline now; there
 * are no card titles, because a card title next to its own clause is a
 * paraphrase of it. Read only the large type, top to bottom, and you have read
 * the original manifesto sentence in full:
 *
 *   "A patient books at midnight, and WhatsApp confirms her while you sleep. It
 *    reminds her two hours before, she checks herself in, the prescription is
 *    gone before she reaches the door, and the receipt sends itself when she
 *    pays. You just see patients."
 *
 * The timeline no longer illustrates the sentence — it *is* the sentence, with
 * clock times in the gutter. That is why nothing needs pinning any more: there
 * is no second thing to hold on screen alongside the first.
 *
 * Each clause carries one line of `proof` beneath it, and that line is held to a
 * hard rule: **it may not restate the clause.** The clause says what happened;
 * the proof says what nobody had to do, or which surface did it. It is set small
 * and dim on purpose — skip every one of them and the pitch still lands intact.
 *
 * ── Why the section is an instrument, not a list ──────────────────────────
 * Correct and dull is still dull, and for a while this was exactly that: one
 * column of type on a flat indigo field, with six small icons as the only thing
 * to look at. Three additions fix it, and each one is the *same* idea — that the
 * section is a day — expressed in a medium other than words:
 *
 *   · **The light changes.** Three blurred fields cross-fade against scroll:
 *     indigo at 00:12, warm through the middle of the day, indigo again by
 *     19:00. Only their `opacity` is animated, never their colour or position,
 *     so the whole effect is composited and costs no paint. Read fast and you
 *     will not consciously notice it; you will notice the section got warmer.
 *   · **A clock runs.** `DayMeter` interpolates the real beat times against
 *     scroll, so the readout races through nine hours between the first two
 *     beats and crawls three minutes between 11:41 and 11:44 — which is exactly
 *     what the day does, and is a thing the copy cannot say without labouring it.
 *   · **The rail has a head.** The lit segment is a gradient ending near-white
 *     rather than a flat bar, so the leading edge reads as light travelling down
 *     the timeline. It costs one extra colour stop and no extra element.
 *
 * ── Why every beat scrubs against itself ──────────────────────────────────
 * One page-level progress value driving all six would tie a clause's timing to
 * how tall the beats above it happen to be, so an edit to one line's copy would
 * silently shift when a later clause lights. Each `Beat` owns its own
 * `useScroll`, keyed to its own box, so a clause lights as *it* enters the
 * viewport and stays right through any amount of copy editing. The list-level
 * scroll is kept for the three things that genuinely span the whole day: the
 * ambient light, the clock, and the count.
 *
 * `data-band="dark"` is load-bearing — `site-header.tsx` measures elements
 * carrying it and inverts the glass nav across them. `nm-dark-surface` is
 * mandatory: every neumorphic shadow here is lit from the top-left by `--nm-hi`,
 * which in the light theme is 95% white, so a dark surface without it paints a
 * near-white highlight onto near-black.
 */

type Beat = {
  /** Clock time, shown in the gutter. Also parsed by `DayMeter` — `HH:MM`. */
  label: string
  icon: LucideIcon
  /**
   * This beat's stretch of the manifesto sentence. The six of these, read in
   * order, must form one grammatical sentence — that is the whole conceit of the
   * section, and it is worth re-reading them end to end after any copy edit.
   */
  clause: string
  /** Supporting detail. Must NOT paraphrase `clause` — see the header note. */
  proof: string
  /** A product surface, not prose: what the software emitted at that moment. */
  chip: string
}

const BEATS: Beat[] = [
  {
    label: "00:12",
    icon: MoonStar,
    clause: "A patient books at midnight, and WhatsApp confirms her while you sleep.",
    proof: "She takes 11:30 tomorrow off your link. No missed call waiting on your desk in the morning.",
    chip: "Confirmed · Token #4",
  },
  {
    label: "09:30",
    icon: BellRing,
    clause: "It reminds her two hours before,",
    proof: "Nobody at your desk dialled a number, and she does not become a no-show.",
    chip: "Reminder delivered",
  },
  {
    label: "11:26",
    icon: UserCheck,
    clause: "she checks herself in,",
    proof: "The queue re-orders itself and the waiting-room screen follows. No one stands up to call a name.",
    chip: "Now serving #3",
  },
  {
    label: "11:41",
    icon: FileSignature,
    clause: "the prescription is gone before she reaches the door,",
    proof: "Medicine autocomplete, dosage chips, and an allergy check against her own record.",
    chip: "Prescription.pdf sent",
  },
  {
    label: "11:44",
    icon: IndianRupee,
    clause: "and the receipt sends itself when she pays.",
    proof: "Your own UPI QR, invoice closed. Nothing to reconcile from a cash box tonight.",
    chip: "₹450 received · UPI",
  },
  {
    label: "19:00",
    icon: Moon,
    clause: "You just see patients.",
    proof: "The takings are totalled and tomorrow's list is already ordered. There is nothing to write up.",
    chip: "Day closed",
  },
]

/** How much of a beat's scroll a single word's own fade occupies. */
const WORD_FADE = 0.16

export function DayChapter() {
  const list = useRef<HTMLOListElement>(null)

  const { scrollYProgress } = useScroll({
    target: list,
    // Starts as the first beat clears the fold and finishes while the last is
    // still on screen, so the day is complete at the moment 19:00 lights.
    offset: ["start 75%", "end 80%"],
  })

  /* The room's light, over the day.
     Two fields, cross-faded — never moved and never recoloured, because on a
     40rem box carrying a 64px blur, `opacity` is the one property that can
     change per frame without asking for the blur to be computed again.

     Two rather than the three this started with, and the copy is better for it:
     a day is cool, then warm, then cool, so the indigo field simply comes *back*
     on a V curve instead of a third layer being lit to do it. One fewer large
     blurred layer on a page that already carries about ten, for an audience
     largely on hardware where each one is a real cost.

     (Measured first, in case the reverse was true: a controlled run with every
     blur removed took this section from 22fps to a flat 60 in a software
     rasteriser, while removing the *animation* on those blurs changed nothing.
     The layers are the cost, not what is done to them — so the fix is to have
     one fewer, not to animate it more cheaply.) */
  const night = useTransform(scrollYProgress, [0, 0.42, 1], [0.75, 0.16, 0.62])
  const noon = useTransform(scrollYProgress, [0.08, 0.45, 0.9], [0, 0.55, 0.1])

  return (
    <section
      data-band="dark"
      className="nm-dark-surface bg-grain relative isolate bg-sidebar text-sidebar-foreground"
    >
      {/* The clipping lives on this layer, NOT on the section. `overflow: hidden`
          anywhere above a `position: sticky` element makes that box the sticky
          element's scrollport — the site header sits above this band, and the
          day meter below is itself sticky, so a clipped section here would break
          both. The fields get their own clipped layer and the section stays
          `visible`. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <motion.div
          data-day-light
          style={{ opacity: night }}
          className="glow-primary animate-glow-drift absolute -top-40 left-1/4 size-[40rem] rounded-full blur-3xl"
        />
        <motion.div
          data-day-light
          style={{ opacity: noon }}
          className="glow-clay animate-glow-drift absolute top-1/4 -right-40 size-[44rem] rounded-full blur-3xl [animation-delay:-7s]"
        />
      </div>

      <div className="relative mx-auto max-w-5xl px-4 pt-24 pb-28 sm:pt-28 sm:pb-36">
        <div className="max-w-xl">
          <p className="font-mono text-xs tracking-[0.22em] text-sidebar-primary">00:12 → 19:00</p>
          <ScrollSkew>
            <h2 className="mt-4 font-heading text-4xl font-extrabold tracking-[-0.04em] text-balance sm:text-5xl">
              One day, running itself
            </h2>
          </ScrollSkew>
          <p className="mt-4 text-lg text-sidebar-foreground/70">
            The same Tuesday your clinic already has, with nobody typing anything twice.
          </p>
        </div>

        {/* Two columns from `lg`, stacked below it. The meter is the first grid
            item so it stacks *above* the beats on a phone, where it reads as a
            title card for the day rather than as a sidebar. */}
        <div className="mt-14 grid gap-12 lg:grid-cols-[13.5rem_1fr] lg:gap-14">
          <DayMeter progress={scrollYProgress} />

          <ol ref={list} className="relative">
            {BEATS.map((beat, i) => (
              <BeatRow key={beat.label} beat={beat} isLast={i === BEATS.length - 1} />
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}

/* ── The meter ─────────────────────────────────────────────────────────────
   An arc of the day with a marker on it, the running clock, and the count.

   ── Why the clock is not linear in time ──────────────────────────────────
   It interpolates between the beats' real times against *scroll*, not against
   the clock, so the readout covers 00:12 → 09:30 in one beat's worth of travel
   and 11:41 → 11:44 in another beat's worth. That is deliberate and it is the
   whole reason the thing is interesting: the day genuinely is nine idle hours
   and then three minutes where everything happens, and the meter says so
   without a word of copy spent on it.

   ── No React state on the scroll path ────────────────────────────────────
   The clock and the count are `textContent` writes from a `useMotionValueEvent`
   subscription; the arc is a `pathLength` and a transform. Nothing here can
   re-render the six beats beside it, which is the failure mode this whole
   section is written to avoid. */

/** Minutes since midnight for each beat, parsed once from the labels above. */
const MINUTES = BEATS.map((b) => {
  const [h, m] = b.label.split(":").map(Number)
  return h * 60 + m
})

/** Arc geometry. One semicircle, drawn left (midnight) to right (evening). */
const CX = 90
const CY = 88
const R = 74

function clockAt(v: number) {
  const spans = MINUTES.length - 1
  const pos = Math.min(spans, Math.max(0, v * spans))
  const i = Math.min(spans - 1, Math.floor(pos))
  const mins = MINUTES[i] + (MINUTES[i + 1] - MINUTES[i]) * (pos - i)
  const h = Math.floor(mins / 60)
  const m = Math.floor(mins % 60)
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

function DayMeter({ progress }: { progress: MotionValue<number> }) {
  const clock = useRef<HTMLSpanElement>(null)
  const count = useRef<HTMLSpanElement>(null)

  useMotionValueEvent(progress, "change", (v) => {
    if (clock.current) clock.current.textContent = clockAt(v)
    if (count.current) {
      // Floored at one: the first beat is already lit when the chapter arrives.
      count.current.textContent = String(
        Math.min(BEATS.length, Math.max(1, Math.ceil(v * BEATS.length))),
      )
    }
  })

  // Polar, so the marker sits *on* the arc at every progress value rather than
  // on a straight line between its ends. π → 0 sweeps left to right over the top.
  const theta = useTransform(progress, [0, 1], [Math.PI, 0])
  const x = useTransform(theta, (t) => CX + R * Math.cos(t))
  const y = useTransform(theta, (t) => CY - R * Math.sin(t))

  return (
    <div className="lg:sticky lg:top-28 lg:self-start">
      <div
        data-day-meter
        className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 backdrop-blur-sm"
      >
        <svg viewBox="0 0 180 104" className="w-full max-w-[13rem] lg:max-w-none" aria-hidden>
          {/* Unlit track. */}
          <path
            d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`}
            fill="none"
            strokeWidth="2"
            strokeLinecap="round"
            className="stroke-white/12"
          />
          {/* Lit arc. `pathLength` is a first-class animatable in motion: it
              normalises the path to 1 and drives dash offset internally, so this
              is one value and no measurement. */}
          <motion.path
            data-day-arc
            d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`}
            fill="none"
            strokeWidth="2"
            strokeLinecap="round"
            className="stroke-sidebar-primary"
            style={{ pathLength: progress }}
          />
          {/* The marker, and its halo. Two circles rather than a filter: a real
              blur here would be re-rasterised on every frame of the scroll. */}
          <motion.circle
            data-day-marker
            cx="0"
            cy="0"
            r="9"
            className="fill-sidebar-primary/25"
            style={{ x, y }}
          />
          <motion.circle
            data-day-marker
            cx="0"
            cy="0"
            r="4"
            className="fill-sidebar-primary"
            style={{ x, y }}
          />
        </svg>

        <div className="-mt-2 flex justify-between font-mono text-[0.6rem] tracking-[0.16em] text-sidebar-foreground/35">
          <span>MIDNIGHT</span>
          <span>EVENING</span>
        </div>

        {/* `tabular-nums` is not decoration here — without it the clock's own
            digits change width as it runs and the readout jitters. */}
        <p className="mt-5 font-heading text-4xl font-extrabold tracking-[-0.04em] tabular-nums">
          <span ref={clock}>00:12</span>
        </p>
        <p className="mt-1 font-mono text-[0.625rem] tracking-[0.18em] text-sidebar-foreground/40">
          CLINIC TIME
        </p>

        <div className="mt-5 flex items-baseline gap-2 border-t border-white/10 pt-4">
          <span className="font-heading text-xl font-bold tabular-nums">
            <span ref={count}>1</span>
            <span className="text-sidebar-foreground/35"> / {BEATS.length}</span>
          </span>
          <span className="text-xs text-sidebar-foreground/50">handled for you</span>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-sidebar-foreground/55">
          Your share of them:{" "}
          <span className="font-semibold text-sidebar-primary">nought minutes</span>.
        </p>
      </div>
    </div>
  )
}

/**
 * One beat: a node on the rail, a time, a clause, its proof and its receipt.
 *
 * The clause scrubs word by word; everything else waits for it. The proof and
 * the chip only arrive in the last quarter of the beat's travel, so the eye
 * finishes the sentence fragment before the evidence for it turns up rather than
 * choosing between the two.
 *
 * `data-day-event` is the reduced-motion hook — the rule in globals.css lights
 * this whole subtree unconditionally, so it must stay on the element that
 * contains every animated child.
 */
function BeatRow({ beat, isLast }: { beat: Beat; isLast: boolean }) {
  const row = useRef<HTMLLIElement>(null)

  const { scrollYProgress: p } = useScroll({
    target: row,
    // Anchored to the beat's own top edge: it starts lighting just below the
    // fold and is fully lit by the time it sits in the upper-middle of the
    // viewport, which is where it will be read.
    offset: ["start 88%", "start 34%"],
  })

  const nodeOpacity = useTransform(p, [0, 0.14], [0.3, 1])
  const nodeScale = useTransform(p, [0, 0.14], [0.85, 1])
  // A ring that expands and fades once as the node lights — the beat announcing
  // itself. Two values on one element, both composited.
  const haloScale = useTransform(p, [0, 0.34], [0.7, 2.1])
  const haloOpacity = useTransform(p, [0, 0.1, 0.34], [0, 0.5, 0])
  const timeOpacity = useTransform(p, [0, 0.12], [0.2, 1])
  const tailOpacity = useTransform(p, [0.72, 0.98], [0, 1])
  const tailY = useTransform(p, [0.72, 0.98], [10, 0])
  // The segment reaches the next node exactly as this beat finishes lighting,
  // so the line arrives a beat ahead of the clause it is about to introduce.
  const railFill = useTransform(p, [0.08, 1], [0, 1])

  const words = beat.clause.split(" ")
  // Room left for the per-word stagger once each word's own fade is accounted
  // for, so the last word finishes exactly at the end of the beat's travel.
  const stagger = Math.max(0.92 - WORD_FADE, 0)

  const Icon = beat.icon

  return (
    <motion.li
      ref={row}
      data-day-event
      className="relative pb-12 pl-11 last:pb-0 sm:pb-16 sm:pl-14"
    >
      {/* Rail segment, owned by the beat it leaves rather than drawn once down
          the whole list. A single list-level rail has to guess where to stop —
          any fixed `bottom-*` is wrong the moment the last beat's copy changes
          length, and in testing it died in the gap two beats early. Anchoring
          each segment between its own node (`top-4`, the node's centre) and the
          next one (`-bottom-4`, sixteen pixels into the following beat) makes it
          self-adjusting, and lets the lit copy track the beat's own progress.

          Two elements rather than one animated gradient, because scaleY on a
          solid bar is a compositor transform and a gradient stop is not.

          The lit copy IS a gradient, but a static one that is merely being
          stretched: near-white at the bottom, so the leading edge reads as light
          arriving rather than as a bar getting longer. Free — one extra colour
          stop, no extra element, no per-frame paint. */}
      {!isLast && (
        <>
          <span
            aria-hidden
            className="pointer-events-none absolute top-4 -bottom-4 left-[15.5px] w-px bg-white/12"
          />
          <motion.span
            aria-hidden
            data-day-rail
            style={{ scaleY: railFill }}
            className="pointer-events-none absolute top-4 -bottom-4 left-[15.5px] w-px origin-top bg-gradient-to-b from-sidebar-primary/35 via-sidebar-primary to-[color-mix(in_oklab,var(--sidebar-primary),white_55%)]"
          />
        </>
      )}

      <span className="absolute top-0 left-0 size-8">
        {/* Needs its own hook, and this is why: the reduced-motion rule for
            `[data-day-event] *` pins every descendant to `opacity: 1` and
            `transform: none`, which for a ring whose entire existence is a
            scale-and-fade means a solid ring parked at full opacity exactly on
            the node's own border — a permanent double outline on all six nodes.
            A pulse has no still frame worth keeping, so it is removed rather
            than frozen. */}
        <motion.span
          aria-hidden
          data-day-halo
          style={{ scale: haloScale, opacity: haloOpacity }}
          className="absolute inset-0 rounded-full border border-sidebar-primary"
        />
        <motion.span
          aria-hidden
          style={{ opacity: nodeOpacity, scale: nodeScale }}
          className="absolute inset-0 flex items-center justify-center rounded-full border border-sidebar-primary/50 bg-sidebar text-sidebar-primary shadow-[0_0_18px_2px_color-mix(in_oklab,var(--sidebar-primary)_35%,transparent)]"
        >
          <Icon className="size-3.5" />
        </motion.span>
      </span>

      <motion.p
        style={{ opacity: timeOpacity }}
        className="pt-1.5 font-mono text-xs tracking-[0.18em] text-sidebar-foreground/50 tabular-nums"
      >
        {beat.label}
      </motion.p>

      <p className="mt-3 font-heading text-xl leading-[1.35] font-semibold tracking-[-0.025em] text-balance sm:text-2xl sm:leading-[1.35] lg:text-[1.75rem]">
        {words.map((w, i) => (
          <ClauseWord
            key={i}
            progress={p}
            start={words.length > 1 ? (i / (words.length - 1)) * stagger : 0}
          >
            {w}
          </ClauseWord>
        ))}
      </p>

      <motion.div style={{ opacity: tailOpacity, y: tailY }}>
        <p className="mt-3 max-w-lg text-sm leading-relaxed text-sidebar-foreground/55">
          {beat.proof}
        </p>
        <span className="mt-4 inline-flex items-center gap-2 rounded-full bg-sidebar-primary/15 px-3 py-1.5 text-xs font-medium text-sidebar-primary">
          <span className="animate-live-dot size-1.5 rounded-full bg-current" />
          {beat.chip}
        </span>
      </motion.div>
    </motion.li>
  )
}

/**
 * One word of a clause.
 *
 * A hook cannot be called inside a `.map()`, so the beat owns the single
 * `useScroll` and each word calls exactly one `useTransform` per animated
 * property — the same shape `aurora.tsx` uses for its parallax fields. The wave
 * therefore costs zero React re-renders; every frame is a direct style write.
 *
 * ── The word lifts as well as lights ─────────────────────────────────────
 * Opacity alone was legible and inert. A few pixels of travel is what turns it
 * from a dimmer switch into words *arriving*, and it is free — both properties
 * are composited, and `y` on a compositor layer costs the same as no `y`.
 *
 * That requires `inline-block`, because `transform` does nothing on an inline
 * box. Which in turn moves the trailing space *out* of the span: a space at the
 * end of an inline-block is trimmed by the box, so leaving it there would close
 * every gap in the sentence. As a plain sibling text node it renders normally,
 * gives the line its break opportunities back, and still copies as prose.
 *
 * `data-scrub-word` is the hook the reduced-motion block in globals.css uses to
 * pin every word lit and level — deliberately not a JSX branch, because the
 * server cannot know a visitor's motion preference and a component that renders
 * a different tree for it hydration-mismatches for exactly those visitors.
 */
function ClauseWord({
  children,
  progress,
  start,
}: {
  children: string
  progress: MotionValue<number>
  start: number
}) {
  // `useTransform` clamps at the range ends, so a word is fully dim before its
  // slice and fully lit after it.
  const opacity = useTransform(progress, [start, start + WORD_FADE], [0.16, 1])
  // In `em`, not px, so the lift stays proportional to the clause's own type —
  // which steps up twice across the breakpoints. motion interpolates unit
  // strings directly, so this is still one value and one style write.
  const y = useTransform(progress, [start, start + WORD_FADE], ["0.32em", "0em"])
  return (
    <>
      <motion.span data-scrub-word style={{ opacity, y }} className="inline-block">
        {children}
      </motion.span>{" "}
    </>
  )
}

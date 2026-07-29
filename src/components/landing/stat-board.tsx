"use client"

import { useRef } from "react"
import { motion, useMotionValue, useSpring } from "motion/react"
import { CalendarClock, Rocket, Signature, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Three timings, on cards that read as instruments.
 *
 * ── What was here before, and why it went ────────────────────────────────
 * The numerals were *extruded*: a front face plus seven absolutely-positioned
 * copies pushed backwards in Z, so that as the board turned under the pointer
 * the number visibly had a back. On paper it was the most interesting thing on
 * the page. On screen the seven copies read as a smeared grey echo behind every
 * figure — a shadow nobody asked for, at its worst on "15 sec" where two digits
 * each threw their own. It was not a subtle effect that needed tuning down; the
 * ghosting *was* the effect, so there was nothing to tune.
 *
 * ── What replaced it ─────────────────────────────────────────────────────
 * An odometer. Each digit is a column of the ten numerals in a one-line window,
 * and the column rolls through a full revolution before settling on its value —
 * so "15" lands as 1 then 5, a beat apart, the way a mechanical counter does.
 *
 * It is a better answer than the extrusion for three reasons and not only
 * because it is cleaner. It *means* something here: this is the section about
 * how long things take, and a counter is the instrument you measure that with.
 * It is legible at every frame, because there is only ever one numeral in the
 * window. And it costs one transform per digit against the extrusion's eight
 * stacked copies per numeral, all of which were re-composited on every degree
 * the board turned.
 *
 * ── Why the tilt stayed ──────────────────────────────────────────────────
 * The 3D board was built to serve the extrusion, and with the extrusion gone it
 * could have gone too. It is kept because it is the section's only pointer
 * reactivity and it now costs almost nothing: one rotation on one container,
 * with no `preserve-3d` subtree and no per-card Z translation underneath it.
 * What it does *not* do any more is imply depth the content has to honour —
 * it is a plane catching a light, which is all it ever needed to be.
 */

type Stat = {
  value: number
  suffix: string
  /** Mono kicker in the card's top-right. Names the measurement. */
  kind: string
  label: string
  note: string
  icon: LucideIcon
  /** Vertical offset on wide screens, so the trio reads as a descending stair. */
  offset: string
}

/**
 * Product claims — what the software does — never fabricated customer metrics.
 * ClinicFlow has no users to cite yet, and "10,000 doctors trust us" is the one
 * thing a landing page must not invent. When real numbers exist they replace
 * these; until then these are checkable against the product.
 */
const STATS: Stat[] = [
  {
    value: 2,
    suffix: "min",
    kind: "SETUP",
    label: "to set up your clinic",
    note: "Name, hours, fee. Your booking link exists before you finish the form.",
    icon: Rocket,
    offset: "lg:mt-0",
  },
  {
    value: 15,
    suffix: "sec",
    kind: "PER VISIT",
    label: "to send a prescription",
    note: "Autocomplete, dosage chips, sign. The PDF is on WhatsApp on its own.",
    icon: Signature,
    offset: "lg:mt-10",
  },
  {
    value: 24,
    suffix: "×7",
    kind: "ALWAYS ON",
    label: "booking, without phone tag",
    note: "One link. Patients pick a slot at midnight and get a token number.",
    // The stair was mt-0/16/32 and left a wedge of empty band under the first
    // card that read as a layout accident rather than as a descending trio.
    // Half the rise reads the same and costs a third of the hole.
    icon: CalendarClock,
    offset: "lg:mt-20",
  },
]

const SPRING = { stiffness: 150, damping: 18, mass: 0.7 } as const
/** Degrees the board rests at with no pointer on it. */
const REST_X = 5
const SWING = 8

export function StatBoard() {
  const ref = useRef<HTMLDivElement>(null)
  const rx = useSpring(useMotionValue(REST_X), SPRING)
  const ry = useSpring(useMotionValue(0), SPRING)

  function track(e: React.PointerEvent<HTMLDivElement>) {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const nx = (e.clientX - r.left) / r.width - 0.5
    const ny = (e.clientY - r.top) / r.height - 0.5
    rx.set(REST_X - ny * SWING)
    ry.set(nx * SWING)
  }

  function release() {
    rx.set(REST_X)
    ry.set(0)
  }

  return (
    <div
      ref={ref}
      onPointerMove={track}
      onPointerLeave={release}
      className="mt-16 [perspective:1600px]"
    >
      <motion.div
        data-parallax
        style={{ rotateX: rx, rotateY: ry }}
        // `items-start`, so each slab hugs its own copy instead of being
        // stretched to the tallest. Stretched, the shortest card carried ~200px
        // of dead space under its text and the stair read as a layout accident.
        className="grid items-start gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8 lg:pb-10"
      >
        {STATS.map((s, i) => (
          <Slab key={s.label} stat={s} delay={i * 0.14} />
        ))}
      </motion.div>
    </div>
  )
}

function Slab({ stat, delay }: { stat: Stat; delay: number }) {
  const Icon = stat.icon

  return (
    <div
      className={cn(
        "group/slab relative rounded-3xl border border-edge/20 bg-card p-8 shadow-nm-raised",
        "transition-shadow duration-300 hover:shadow-nm-float",
        stat.offset,
      )}
    >
      {/* Coat of gloss along the top edge, so the slab reads as a surface
          catching light rather than a rectangle of colour. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-1/3 rounded-t-3xl bg-gradient-to-b from-white/50 to-transparent"
      />

      <div className="relative">
        <div className="flex items-start justify-between">
          <span className="flex size-10 items-center justify-center rounded-xl bg-background/70 text-primary shadow-nm-inset">
            <Icon className="size-4.5" />
          </span>
          <span className="font-mono text-[0.6rem] tracking-[0.18em] text-muted-foreground/70">
            {stat.kind}
          </span>
        </div>

        <div className="mt-6">
          <Odometer value={stat.value} suffix={stat.suffix} delay={delay} />
        </div>

        {/* A measure rule. It is a ruler because this is the section about how
            long things take — texture that agrees with the content instead of
            merely filling the gap under it. Drawn from the left as the card
            arrives, and the ticks are a repeating gradient, so the whole thing
            is one element and one `scaleX`. */}
        <motion.span
          aria-hidden
          data-parallax
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.9, delay: delay + 0.25, ease: [0.16, 1, 0.3, 1] }}
          // 2px ticks, not 1px. A one-pixel repeating gradient lands on
          // fractional device pixels at most widths and aliases into visibly
          // uneven clumps — it read as a rendering fault rather than as a scale.
          className="mt-5 block h-2.5 origin-left bg-[repeating-linear-gradient(to_right,var(--color-primary)_0_2px,transparent_2px_11px)] opacity-25"
        />

        <p className="mt-4 font-heading text-base font-bold tracking-[-0.02em] text-card-foreground">
          {stat.label}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{stat.note}</p>

        <span className="sr-only">
          {stat.value} {stat.suffix}
        </span>
      </div>
    </div>
  )
}

/**
 * The counter.
 *
 * ── The window and the step must be the same height ──────────────────────
 * Every reel is a column of `CYCLE * 2` numerals in a box exactly one numeral
 * tall, so the translation that lands digit *n* is simply `n` steps up. Both are
 * expressed in `em` against the same font size, which is what keeps them locked
 * together across the three type sizes this renders at — a window in `rem` and a
 * step in `em` would drift apart at every breakpoint and land the reel between
 * two numerals.
 *
 * `1.1em` rather than `1em` for both: digits in Plus Jakarta Sans very nearly
 * fill the em box, and a window cut to exactly that shaves the tops of 2 and 4.
 * The extra tenth is clearance, and because window and step move together it
 * changes nothing about where the reel stops.
 */
const CYCLE = 10

/**
 * ── The trigger is on the row, not on the reels ──────────────────────────
 * Each reel put its own `whileInView` on the moving strip first, and every
 * counter on the page stayed frozen at **0**.
 *
 * The strip is twenty numerals tall inside a window one numeral tall, and
 * `IntersectionObserver` intersects against the *clipped* rect — so the strip's
 * visible fraction is 1/20th, or 5%, and it is 5% no matter where the page is
 * scrolled to. A `viewport.amount` of 0.6 was asking for a condition the element
 * could never satisfy. (Any threshold above 0.05 would have done the same thing,
 * so this was not a matter of tuning the number down.)
 *
 * Variants fix it properly rather than by lowering a threshold: the row watches
 * the viewport — it is unclipped and full-width, so it observes honestly — and
 * propagates `show` to the strips regardless of their own visibility. The
 * stagger that made the digits land left-to-right comes along for free, and is
 * now declared in one place instead of being computed into each reel's delay.
 */
function Odometer({ value, suffix, delay }: { value: number; suffix: string; delay: number }) {
  const digits = String(value).split("")

  return (
    <motion.span
      aria-hidden
      className="flex items-end font-heading text-6xl leading-none font-extrabold tracking-[-0.05em] tabular-nums text-primary select-none sm:text-7xl"
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.6 }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.09, delayChildren: delay } } }}
    >
      {digits.map((d, i) => (
        <Reel key={i} digit={Number(d)} />
      ))}
      <span className="pb-[0.14em] pl-[0.12em] text-[0.4em] font-bold tracking-tight text-muted-foreground">
        {suffix}
      </span>
    </motion.span>
  )
}

function Reel({ digit }: { digit: number }) {
  // One full revolution before the landing, so the reel is seen to *turn*
  // rather than to slide a short distance. The travel is expressed as a
  // fraction of the strip's own height, which is why the strip carries two
  // cycles: the target sits in the second one.
  const stop = -((CYCLE + digit) / (CYCLE * 2)) * 100

  return (
    <span className="inline-block h-[1.1em] overflow-hidden">
      {/* Deliberately NOT `data-parallax`, unlike every other transform in this
          file. That hook's reduced-motion rule is `transform: none`, which for a
          reel means `y: 0%` — and `y: 0%` is the numeral **zero**. It would
          silently replace every figure in the section with 0 for exactly the
          visitors who cannot see it animate and have no way to know.
          Reduced motion is handled correctly one level up instead: the page's
          `MotionConfig reducedMotion="user"` drops the tween and applies the
          target value immediately, so the reel is simply already landed. */}
      <motion.span
        className="flex flex-col"
        variants={{
          hidden: { y: "0%" },
          show: { y: `${stop}%`, transition: { duration: 1.05, ease: [0.16, 1, 0.3, 1] } },
        }}
      >
        {Array.from({ length: CYCLE * 2 }, (_, n) => (
          <span key={n} className="flex h-[1.1em] items-center justify-center">
            {n % CYCLE}
          </span>
        ))}
      </motion.span>
    </span>
  )
}

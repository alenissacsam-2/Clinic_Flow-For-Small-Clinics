"use client"

import { useRef } from "react"
import {
  motion,
  useAnimationFrame,
  useInView,
  useMotionValue,
  useScroll,
  useTransform,
  useVelocity,
} from "motion/react"
import { MessageCircle, ShieldCheck, Stethoscope, type LucideIcon } from "lucide-react"

type Item = { icon: LucideIcon; label: string; note: string }

const TRUST: Item[] = [
  { icon: ShieldCheck, label: "DPDP Act 2023", note: "consent & data-residency ready" },
  { icon: Stethoscope, label: "Telemedicine Guidelines 2020", note: "compliant prescriptions" },
  { icon: MessageCircle, label: "Official WhatsApp API", note: "no unofficial workarounds" },
]

/** Percent of the track travelled per second when the page is perfectly still. */
const IDLE = 1.6
/** How hard scrolling shoves the belt on top of that. Measured, not guessed:
    at 9 a normal wheel flick moved the track ~2,200px/s and the labels smeared
    into an unreadable blur, which is the opposite of the point. */
const KICK = 5

function Cell({ icon: Icon, label, note }: Item) {
  return (
    <div className="flex shrink-0 items-center gap-3 px-8">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium whitespace-nowrap">{label}</p>
        <p className="text-xs whitespace-nowrap text-muted-foreground">{note}</p>
      </div>
      <span aria-hidden className="ml-8 text-destructive/30">
        ◆
      </span>
    </div>
  )
}

/**
 * The compliance strip as a ledger belt that **reacts to your scrolling**.
 *
 * It drifts on its own when the page is still, speeds up when you scroll down,
 * and runs backwards when you scroll up. That coupling is the whole idea: the
 * one strip a visitor would otherwise scroll straight past instead answers to
 * the scroll itself, which is the cheapest way to make a page feel like it is
 * made of something rather than printed.
 *
 * ── Why this can no longer be the CSS marquee it was ─────────────────────
 * A `@keyframes` translate has exactly one speed and one direction. Reacting to
 * velocity means integrating position every frame, so the belt runs on
 * `useAnimationFrame`: offset accumulates by `(idle + kick) × delta`, with
 * `kick` read from `useVelocity(scrollYProgress)`.
 *
 * ── The wrap is modulo, and the modulo has a trap ────────────────────────
 * The track holds its items twice, so the seam is invisible whenever the offset
 * is inside `[-50%, 0]`. The wrap is `(((n % 50) - 50) % 50)` and not a plain
 * `n % 50` because JavaScript's remainder keeps the sign of the *dividend* —
 * scrolling upward pushes the offset positive, and a naive modulo would fling
 * the track off to the right instead of wrapping it.
 *
 * ── Two things that keep it cheap ────────────────────────────────────────
 * The loop is gated on `useInView`, so a belt that has scrolled out of sight
 * costs nothing; and it writes to a MotionValue, so React never re-renders.
 *
 * Reduced motion parks it via `[data-belt]` in globals.css, leaving a static and
 * fully legible row. The tree is identical either way — no branch on
 * `useReducedMotion`, so there is nothing to hydration-mismatch.
 */
export function TrustMarquee() {
  const ref = useRef<HTMLDivElement>(null)
  const onScreen = useInView(ref, { amount: 0.1 })

  const offset = useMotionValue(0)
  const translate = useTransform(offset, (v) => `${v}%`)
  /** Last non-zero scroll direction, so the belt keeps its heading when you stop. */
  const heading = useRef(1)

  const { scrollYProgress } = useScroll()
  const velocity = useVelocity(scrollYProgress)

  useAnimationFrame((_, delta) => {
    if (!onScreen) return
    const seconds = delta / 1000

    // scrollYProgress spans 0→1 across the whole document, so its velocity is a
    // very small number; scaling brings it into the same units as IDLE.
    const v = velocity.get() * 100
    if (v !== 0) heading.current = v < 0 ? -1 : 1

    const step = heading.current * (IDLE + Math.abs(v) * KICK) * seconds
    const next = offset.get() - step
    offset.set(((next % 50) - 50) % 50)
  })

  return (
    <section ref={ref} className="border-y border-border bg-background py-6">
      <div className="mask-fade-x overflow-hidden">
        <motion.div data-belt style={{ x: translate }} className="flex w-max">
          <div className="flex">
            {TRUST.map((t) => (
              <Cell key={t.label} {...t} />
            ))}
            {TRUST.map((t) => (
              <Cell key={`${t.label}-b`} {...t} />
            ))}
          </div>
          <div className="flex" aria-hidden>
            {TRUST.map((t) => (
              <Cell key={`${t.label}-c`} {...t} />
            ))}
            {TRUST.map((t) => (
              <Cell key={`${t.label}-d`} {...t} />
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}

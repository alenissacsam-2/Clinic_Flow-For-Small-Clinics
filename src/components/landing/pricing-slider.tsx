"use client"

import { useState } from "react"
import { motion } from "motion/react"

/**
 * The one genuinely interactive thing on the page: the visitor's own patient
 * count, turned into what the subscription costs per patient.
 *
 * ── Why this and not a "savings" calculator ──────────────────────────────
 * The usual version of this widget multiplies invented rates by invented hourly
 * wages and prints a five-figure number the visitor knows is fiction. Both
 * outputs here are arithmetic the visitor can check in their head, and the one
 * assumption in the second output — roughly two minutes of booking, reminder
 * and receipt handling per patient — is printed underneath in plain sight
 * rather than buried. A doctor who thinks two minutes is wrong can halve the
 * number themselves, and the widget survives their scepticism instead of
 * collapsing under it.
 *
 * The per-patient figure is the one that converts, and it needs no assumption
 * at all: it is the price divided by their own visit count.
 *
 * ── State is fine here ───────────────────────────────────────────────────
 * Everywhere else on this page pointer and scroll values are kept out of React
 * because they change 60–120 times a second. A slider changes a handful of
 * times per drag, and re-rendering three numbers on each of those is cheaper
 * and far clearer than threading MotionValues through the arithmetic. The one
 * thing that IS animated — the fill bar — is a spring on a transform, so the
 * bar keeps flowing between the discrete steps the numbers jump through.
 */

const MIN = 5
const MAX = 60
const START = 24

/** Six clinic days a week, averaged over a month. */
const DAYS_PER_MONTH = 26
/** Booking, reminder chasing and receipt handling, per patient. Stated in the UI. */
const ADMIN_MINUTES = 2

/** Half the thumb, in px — the fill has to stop under the thumb's centre, not its edge. */
const THUMB = 10

function money(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function PricingSlider({ price }: { price: number }) {
  const [perDay, setPerDay] = useState(START)

  const visits = perDay * DAYS_PER_MONTH
  const perPatient = price / visits
  const hours = (visits * ADMIN_MINUTES) / 60
  const fill = (perDay - MIN) / (MAX - MIN)

  return (
    <div className="rounded-3xl border border-white/12 bg-white/[0.04] p-6 sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label htmlFor="per-day" className="text-sm font-medium text-sidebar-foreground/70">
          Patients on a typical day
        </label>
        {/* Deliberately not an `<output>`. That element carries an implicit
            live-region role, so every step of a drag would be announced —
            and the range input already announces its own value. This is the
            sighted-only echo of it. */}
        <span
          aria-hidden
          className="font-heading text-3xl font-extrabold tracking-[-0.03em] tabular-nums"
        >
          {perDay}
        </span>
      </div>

      <div className="relative mt-5 flex h-5 items-center">
        <span aria-hidden className="absolute inset-x-0 h-2 rounded-full bg-white/12" />
        <motion.span
          aria-hidden
          className="absolute left-0 h-2 rounded-full bg-sidebar-primary"
          animate={{ width: `calc(${THUMB}px + ${fill} * (100% - ${THUMB * 2}px))` }}
          transition={{ type: "spring", stiffness: 320, damping: 30 }}
        />
        {/* The native input keeps its own keyboard handling, its own ARIA and
            its own touch target. Only the paint is replaced — the track is made
            transparent in `range-glass` so the two bars above show through. */}
        <input
          id="per-day"
          type="range"
          min={MIN}
          max={MAX}
          step={1}
          value={perDay}
          onChange={(e) => setPerDay(Number(e.target.value))}
          className="range-glass absolute inset-x-0"
        />
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Figure
          value={`₹${money(perPatient)}`}
          unit="per patient"
          note={`At ${visits.toLocaleString("en-IN")} visits a month.`}
        />
        <Figure
          value={hours < 10 ? hours.toFixed(1) : String(Math.round(hours))}
          unit="hours a month"
          note="Of front-desk work this does instead of you."
        />
      </div>

      <p className="mt-6 text-xs leading-relaxed text-sidebar-foreground/50">
        Assuming six clinic days a week, and about {ADMIN_MINUTES} minutes of booking, reminder
        chasing and receipt handling per patient — the parts ClinicFlow takes over. If your desk is
        faster than that, halve it; the first number does not depend on the assumption at all.
      </p>
    </div>
  )
}

function Figure({ value, unit, note }: { value: string; unit: string; note: string }) {
  return (
    // The unit sits on its own line rather than beside the number: these cards
    // are narrow by design and "per patient" was wrapping mid-phrase next to a
    // four-character figure.
    <div className="rounded-2xl border border-white/10 bg-sidebar/40 p-5">
      <p className="font-heading text-4xl leading-none font-extrabold tracking-[-0.04em] text-sidebar-primary tabular-nums">
        {value}
      </p>
      <p className="mt-1.5 text-sm text-sidebar-foreground/60">{unit}</p>
      <p className="mt-3 text-xs leading-relaxed text-sidebar-foreground/55">{note}</p>
    </div>
  )
}

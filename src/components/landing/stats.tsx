import { X } from "lucide-react"

import { Reveal, ScrollSkew, SplitReveal, Stagger, StaggerItem } from "./motion-primitives"
import { PointerGlow } from "./pointer-glow"
import { StatBoard } from "./stat-board"

/**
 * The first bone band after the page's long dark chapter.
 *
 * It has to do two things at once: change the room, and not read as "three
 * cards" — which is what the rest of the page below is already made of. So the
 * numbers are the artwork rather than a caption on it: three odometers that roll
 * to their value as the board turns under the pointer. See `stat-board.tsx`.
 *
 * ── The right column answers, it does not list ───────────────────────────
 * These three are the objections a solo doctor brings to any software page —
 * that there will be a call, a migration, and a contract. Setting them as
 * *struck-off* items rather than as feature bullets is the point: each one is
 * something that is not going to happen, and a tick would say the opposite of
 * what is meant. The mark is the content.
 */
const ANSWERED = [
  ["No sales call", "You sign up and it works. Nobody phones you."],
  ["No migration project", "Start empty or import a CSV. Either takes minutes."],
  ["No minimum term", "Month to month, and your records export in one click."],
]

export function Stats() {
  return (
    // `isolate` is load-bearing with `PointerGlow`, which sits at `-z-10`: a
    // negative z-index only stays inside an element that establishes a stacking
    // context, and without one the glow escapes upward and paints behind this
    // section's own background, which is to say nowhere.
    <section className="relative isolate overflow-hidden bg-background py-24 sm:py-32">
      <PointerGlow size={620} />

      <div className="relative mx-auto max-w-6xl px-4">
        {/* Two columns, because a left-aligned heading on a full-width band
            leaves a hole to its right. */}
        <div className="grid gap-10 lg:grid-cols-[1.15fr_1fr] lg:items-end lg:gap-16">
          <Reveal>
            <p className="font-mono text-xs tracking-[0.22em] text-primary">SPEED</p>
            <ScrollSkew>
              <h2 className="mt-4 font-heading text-4xl font-extrabold tracking-[-0.04em] text-balance sm:text-5xl">
                <SplitReveal text="Fast enough to use between patients" />
              </h2>
            </ScrollSkew>
            <p className="mt-4 text-lg text-muted-foreground">
              These are the product&apos;s own timings — how long the software takes, measured on
              the software. Not customer averages, because there are no customers to average yet.
            </p>
          </Reveal>

          <Stagger stagger={0.09} className="grid gap-3">
            {ANSWERED.map(([head, body]) => (
              <StaggerItem key={head}>
                <div className="group/no flex items-start gap-3.5 rounded-2xl border border-edge/20 bg-card px-5 py-4 text-card-foreground shadow-nm-raised transition-shadow duration-300 hover:shadow-nm-float">
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-background/70 text-muted-foreground shadow-nm-inset transition-colors duration-300 group-hover/no:text-primary">
                    <X className="size-3.5" strokeWidth={3} />
                  </span>
                  <span>
                    <span className="block font-heading text-sm font-bold tracking-[-0.02em]">
                      {head}
                    </span>
                    <span className="mt-1 block text-sm text-muted-foreground">{body}</span>
                  </span>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>

        <StatBoard />
      </div>
    </section>
  )
}

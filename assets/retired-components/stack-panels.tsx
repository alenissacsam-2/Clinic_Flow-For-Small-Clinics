"use client"

import { useRef } from "react"
import { motion, useScroll, useTransform, type MotionValue } from "motion/react"

import { cn } from "@/lib/utils"

/**
 * Panels that pin in place while the next one slides up over them.
 *
 * ── Why CSS sticky and not a pinning library ─────────────────────────────
 * The GSAP-style approach clones the pinned element and re-parents it into a
 * spacer, which breaks React's ownership of the DOM and is a known source of
 * hydration and cleanup bugs. Here the stack is just `position: sticky`: each
 * panel is one viewport tall and sticks to the top, so the next panel — which
 * is simply the next block in normal flow — rides up and covers it for free.
 * No measurement, no cloning, no scroll listener needed to make it work.
 *
 * The scroll-driven part is only the *depth* cue: an outgoing panel dims,
 * shrinks and tilts away at the top, so it reads as receding behind the
 * incoming one rather than being guillotined by it.
 *
 * The tilt is a real perspective rotation, declared with motion's
 * `transformPerspective` so the `perspective()` function rides in the panel's
 * own transform. Putting `perspective` on the container instead would work
 * visually but would make that container the containing block for every fixed
 * and absolute descendant in the stack — a large, silent change to how the
 * step visuals inside lay out, in exchange for nothing.
 *
 * Requires the document to actually scroll natively — see `smooth-scroll.tsx`
 * for why Lenis is safe here and a transform-based smooth-scroller would not be.
 *
 * Reduced motion collapses the stack into ordinary sections — no sticky, no
 * transforms — via `[data-stack-panel]` in globals.css rather than a branch in
 * the JSX. Branching would render a different tree on the client than the
 * server sent, and hydration-mismatch the whole page for precisely the people
 * who asked for less movement.
 */
export function StackPanels({
  panels,
  className,
}: {
  panels: React.ReactNode[]
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  })

  return (
    <div ref={ref} className={cn("relative", className)}>
      {panels.map((panel, i) => (
        <Panel key={i} progress={scrollYProgress} index={i} total={panels.length}>
          {panel}
        </Panel>
      ))}
    </div>
  )
}

/**
 * The step counter, drawn once per panel.
 *
 * It looks like one element pinned across the whole stack, and it is cheaper
 * than that: each panel carries its own copy with its own index marked, and
 * because every panel occupies the same sticky box the copies land on top of
 * each other. Swapping panels swaps the counter with no shared state, no
 * measurement and nothing to keep in sync.
 *
 * It renders *after* the veil so the counter stays crisp while the panel behind
 * it washes out — the one thing on a receding panel that should not recede is
 * the marker telling you where you are.
 */
function StepRail({ index, total }: { index: number; total: number }) {
  return (
    <div className="pointer-events-none absolute inset-y-0 right-4 hidden flex-col items-center justify-center gap-3 md:flex">
      {Array.from({ length: total }, (_, i) => {
        const active = i === index
        return (
          <div key={i} className="flex items-center gap-2.5">
            <span
              className={cn(
                "font-mono text-[0.625rem] tabular-nums transition-colors duration-500",
                active ? "text-primary" : "text-muted-foreground/40",
              )}
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <span
              className={cn(
                "w-px rounded-full transition-all duration-500",
                active ? "h-10 bg-primary" : "h-4 bg-edge/40",
              )}
            />
          </div>
        )
      })}
    </div>
  )
}

function Panel({
  children,
  progress,
  index,
  total,
}: {
  children: React.ReactNode
  progress: MotionValue<number>
  index: number
  total: number
}) {
  // Scroll distance across the whole stack is (total - 1) viewports, because
  // the last panel is already on screen when the container's end meets the
  // viewport's end. So panel i is fully covered once progress passes
  // (i + 1) / (total - 1).
  //
  // The last panel is never covered by anything, so it must never dim. It is
  // tempting to let its range run past 1 and rely on `useTransform` clamping —
  // don't. Motion hands scroll-linked values to the browser's native
  // ScrollTimeline, where the input range becomes WAAPI keyframe *offsets*,
  // and those throw outside [0, 1]. So the final panel gets a full-width range
  // with a constant output instead: same result, legal offsets.
  const span = Math.max(total - 1, 1)
  const isLast = index === total - 1
  const from = isLast ? 0 : index / span
  const to = isLast ? 1 : (index + 1) / span

  const scale = useTransform(progress, [from, to], isLast ? [1, 1] : [1, 0.92])
  // Positive rotateX sends the panel's top edge away from the viewer, so it
  // lies back like a card being slid under the next one. Kept small: past about
  // 10° the text on the outgoing panel starts to smear before the veil has
  // covered it.
  const rotateX = useTransform(progress, [from, to], isLast ? [0, 0] : [0, 8])
  // Dimming is a veil *over* the panel, never the panel's own opacity. Fading
  // the element itself would make it translucent, and since every panel
  // occupies the same sticky box you would read the previous panel's text
  // straight through the one currently going out. A background-coloured
  // overlay washes it toward the page instead, and the panel stays opaque.
  const veil = useTransform(progress, [from, to], isLast ? [0, 0] : [0, 0.72])

  return (
    // `bg-background` is load-bearing, not styling. Sticky panels all occupy
    // the same box, so a transparent panel does not *cover* the one before it —
    // it overlaps it, and you read both at once through each other. The opaque
    // fill is what turns "three overlapping panels" into "a stack".
    //
    // It also hides a quirk worth knowing about: once a panel's scroll range is
    // exhausted, the browser stops applying its scroll-linked opacity and the
    // element snaps back to full. That would ghost the first panel through the
    // second — but only if the second were see-through. It isn't.
    <motion.div
      data-stack-panel
      style={{ scale, rotateX, transformPerspective: 1400, transformOrigin: "50% 40%" }}
      className="sticky top-0 flex h-svh items-center overflow-hidden bg-background"
    >
      <div className="mx-auto w-full max-w-6xl px-4">{children}</div>
      <motion.div
        aria-hidden
        data-stack-veil
        style={{ opacity: veil }}
        className="pointer-events-none absolute inset-0 bg-background"
      />
      <StepRail index={index} total={total} />
    </motion.div>
  )
}

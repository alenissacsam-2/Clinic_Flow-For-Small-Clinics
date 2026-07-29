"use client"

/**
 * Landing-only motion primitives. `motion` (framer-motion successor) is imported
 * ONLY in files under `src/components/landing/*` — the clinical app stays
 * CSS-only. Every effect here animates opacity/transform exclusively and honours
 * prefers-reduced-motion (globally via `LandingMotionProvider`, per-behaviour via
 * `useReducedMotion` in the leaf components).
 */

import { useRef } from "react"
import {
  motion,
  MotionConfig,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
  useVelocity,
  type Variants,
} from "motion/react"
import { cn } from "@/lib/utils"

/** The register's entrance curve — same easing as the CSS `rise-in` keyframe. */
const EASE = [0.22, 1, 0.36, 1] as const

/**
 * Wraps the landing tree so every motion component below respects the user's
 * reduced-motion preference. Children are passed through untouched, so the
 * server page can render its content inside this client boundary.
 */
export function LandingMotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>
}

/** Fade + rise a block into view once it scrolls in. */
export function Reveal({
  children,
  className,
  delay = 0,
  y = 24,
}: {
  children: React.ReactNode
  className?: string
  delay?: number
  y?: number
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.7, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  )
}

const staggerParent = (stagger: number, delay: number): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: stagger, delayChildren: delay } },
})

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
}

const popVariants: Variants = {
  hidden: { opacity: 0, scale: 0.6 },
  show: {
    opacity: 1,
    scale: 1,
    transition: { type: "spring", stiffness: 260, damping: 20 },
  },
}

/** Parent that reveals its `StaggerItem` children one after another on scroll. */
export function Stagger({
  children,
  className,
  stagger = 0.08,
  delay = 0,
}: {
  children: React.ReactNode
  className?: string
  stagger?: number
  delay?: number
}) {
  return (
    <motion.div
      className={className}
      variants={staggerParent(stagger, delay)}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.2 }}
    >
      {children}
    </motion.div>
  )
}

/** A single member of a `Stagger`. `pop` swaps rise for a scale-spring. */
export function StaggerItem({
  children,
  className,
  pop = false,
}: {
  children: React.ReactNode
  className?: string
  pop?: boolean
}) {
  return (
    <motion.div className={className} variants={pop ? popVariants : itemVariants}>
      {children}
    </motion.div>
  )
}

/* ── SplitReveal ──────────────────────────────────────────────────────────
   A heading whose words rise out from behind a line, one after another.

   The mask is the whole trick: each word sits in an `overflow-hidden` box and
   starts translated a full line-height down, so it is not *faded* in, it is
   *uncovered* — the difference between a heading that appears and one that
   arrives. `Reveal` already does the fade; this is for the two or three
   headings that should carry the section.

   Two things it must not break:
   -  Screen readers. A heading split into N spans is read as N fragments by
      some combinations, so the split copy is `aria-hidden` and an `sr-only`
      copy of the original string sits beside it — the same shape `StatCounter`
      uses for its animated numeral.
   -  Descenders. `overflow-hidden` on a text box crops the tails of g/y/p, so
      the clip box is padded a fraction of an em and pulled back up by the same
      amount. Without the pull the baseline drifts and the heading no longer
      sits on the grid.

      **The pad has to be measured, not guessed.** It was 0.14em, which looked
      about right and was not: measuring `actualBoundingBoxDescent` for the real
      strings in the real font found Plus Jakarta Sans ExtraBold puts ink up to
      **0.233em** below the baseline, so every descender on the page was being
      shaved — "Fast enough to use between patients", "Up and running today",
      "Ready to ditch the paper register?" and eleven more, by 3 to 5.6px each.
      Subtle enough that nobody spots it as clipping; it just makes the type
      look slightly wrong. 0.26em clears the measured worst case with room for
      a `j` or a deeper glyph in future copy. Re-measure before reducing it.

   NOT for the hero `h1`: that is the LCP element and the e2e anchor, and it
   stays static server HTML. */
const splitParent = (stagger: number, delay: number): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: stagger, delayChildren: delay } },
})

const wordVariants: Variants = {
  hidden: { y: "110%" },
  show: { y: "0%", transition: { duration: 0.75, ease: EASE } },
}

export function SplitReveal({
  text,
  className,
  delay = 0,
  stagger = 0.045,
}: {
  text: string
  className?: string
  delay?: number
  stagger?: number
}) {
  return (
    <span className={cn("inline", className)}>
      <motion.span
        aria-hidden
        className="inline"
        variants={splitParent(stagger, delay)}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.5 }}
      >
        {text.split(" ").map((word, i) => (
          <span
            key={`${word}-${i}`}
            className="inline-flex overflow-hidden pb-[0.26em] align-bottom -mb-[0.26em]"
          >
            <motion.span data-split-word variants={wordVariants} className="inline-block">
              {word}
              {/* A real space, inside the moving span — a gap between the clip
                  boxes would be collapsed by the inline formatting context. */}
              {" "}
            </motion.span>
          </span>
        ))}
      </motion.span>
      <span className="sr-only">{text}</span>
    </span>
  )
}

/* ── Magnetic ─────────────────────────────────────────────────────────────
   Pulls its child a few pixels toward the pointer while the pointer is near.

   Reserved for the page's two real commitments (the closing CTA, the pricing
   button). It works because it is rare: a page where everything leans toward
   the cursor reads as jelly, but a button that leans when nothing else does
   reads as the one thing that wants to be pressed.

   `data-parallax` opts it into the existing reduced-motion kill switch rather
   than inventing a second one. */
const MAGNET = { stiffness: 260, damping: 18, mass: 0.5 } as const

export function Magnetic({
  children,
  className,
  strength = 14,
}: {
  children: React.ReactNode
  className?: string
  /** Maximum travel in px at the far edge of the element. */
  strength?: number
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const x = useSpring(useMotionValue(0), MAGNET)
  const y = useSpring(useMotionValue(0), MAGNET)

  function track(e: React.PointerEvent<HTMLSpanElement>) {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    x.set(((e.clientX - (r.left + r.width / 2)) / r.width) * strength * 2)
    y.set(((e.clientY - (r.top + r.height / 2)) / r.height) * strength * 2)
  }

  function release() {
    x.set(0)
    y.set(0)
  }

  return (
    <motion.span
      ref={ref}
      data-parallax
      onPointerMove={track}
      onPointerLeave={release}
      style={{ x, y }}
      className={cn("inline-block", className)}
    >
      {children}
    </motion.span>
  )
}

/* ── ScrollSkew ────────────────────────────────────────────────────────────
   A heading that leans in the direction the page is being thrown.

   Every other scroll effect on this page is driven by scroll *position*: a
   thing is lit because you have reached it. This one is driven by scroll
   *velocity*, which makes it the only element that responds to how the visitor
   is reading rather than to where they are. Flick the wheel and the headings
   lean and settle; read slowly and it never appears at all. That asymmetry is
   the point — it rewards the input without ever being a thing you have to
   wait through.

   ── Kept deliberately small ──────────────────────────────────────────────
   Three and a half degrees. Type is the one thing on a page whose shape people
   read rather than look at, and skew is a distortion of exactly that shape;
   past roughly five degrees the letterforms stop being Plus Jakarta Sans and
   start being a wobble. The clamp matters for the same reason — a trackpad
   fling can report tens of thousands of px/s, and without it a single gesture
   would fold the heading flat.

   ── Why the spring, and why it is stiff ──────────────────────────────────
   Raw velocity is a step function: it spikes the instant the wheel moves and
   drops to zero the instant it stops, so bound directly to a transform it reads
   as a twitch rather than as weight. The spring gives it mass. It is stiff and
   heavily damped so the heading is already settling while the page is still
   moving — a loose spring here keeps oscillating after the scroll has stopped,
   which reads as a bug in a way that leaning does not.

   `data-parallax` opts it into the existing reduced-motion kill switch. That
   rule sets `transform: none`, which for this component is exactly the resting
   state, so nothing is lost but the lean. */
const SKEW_SPRING = { stiffness: 400, damping: 60, mass: 0.4 } as const

export function ScrollSkew({
  children,
  className,
  /** Degrees of lean at the clamp. */
  max = 3.5,
}: {
  children: React.ReactNode
  className?: string
  max?: number
}) {
  const { scrollY } = useScroll()
  const velocity = useVelocity(scrollY)
  const smooth = useSpring(velocity, SKEW_SPRING)
  // Negated: scrolling *down* is a positive velocity, and the heading should
  // trail the movement — leaning back the way a body does when a train pulls
  // away, not forward into it.
  const skewY = useTransform(smooth, [-2500, 0, 2500], [max, 0, -max], { clamp: true })

  return (
    <motion.div data-parallax style={{ skewY }} className={className}>
      {children}
    </motion.div>
  )
}

/** A ruler line drawn across the header's foot as you read down the page. */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 30,
    restDelta: 0.001,
  })
  return (
    <motion.div
      aria-hidden
      className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-primary/60"
      style={{ scaleX }}
    />
  )
}

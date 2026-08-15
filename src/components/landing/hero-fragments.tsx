"use client"

import { useEffect, useRef } from "react"
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react"
import { BellRing, CalendarCheck, FileText, IndianRupee, MessageCircle } from "lucide-react"

/**
 * The hero centrepiece: the Today queue, with fragments of the rest of the
 * product orbiting it at different depths.
 *
 * ── Why fragments of the real UI and not abstract shapes ─────────────────
 * The two previous attempts here were a WebGL object and a hexagon lattice.
 * Both failed the same way: a doctor evaluating clinic software has no use for
 * an abstract object, and a background that is *more* interesting than the
 * product is a background that is competing with it. These float instead —
 * a WhatsApp confirmation, a token, a paid receipt — so the decoration is also
 * the argument: this is what the software actually sends on your behalf.
 *
 * ── Two parallax sources on one element, without a fight ─────────────────
 * Each fragment needs to drift with the pointer *and* with scroll. Composing
 * both into a single `transform` means reconciling two independent MotionValue
 * streams by hand. Instead they are nested: the outer element carries the
 * scroll offset, the inner one carries the pointer offset, and the browser
 * composes them. Two elements, two sources, nothing to reconcile.
 *
 * ── The pop-in cascade ────────────────────────────────────────────────────
 * Six fragments arrive one after another, top to bottom, over their own slice
 * of the section's scroll pass, rather than all six fading in together the
 * instant the section crosses some visibility threshold. Each fragment's
 * window is offset from the last by `POP_STEP`, computed from its `order` —
 * the same scroll value that already drives the drift, so nothing new is
 * measured or subscribed to.
 *
 * The scale range is three points, not two — `[0.5, 1.08, 1]` rather than
 * `[0, 1]`. A straight two-point tween looks like a fade; overshooting
 * slightly past 1 at the midpoint before settling back is what makes it read
 * as an actual *pop*, closer to a notification landing than a chip fading in.
 *
 * Nothing here re-renders React — pointer position and the pop-in progress
 * both land in MotionValues, which write to style directly. Reduced motion
 * drops the drift, the pointer offset, the idle bob AND the pop-in transform
 * in one rule (`[data-parallax] { transform: none; opacity: 1; }` in
 * globals.css), leaving every fragment exactly where it is laid out, fully
 * visible, from the first frame.
 */

/** Width of each fragment's own pop-in window, in scroll-progress units. */
const POP_WINDOW = 0.22
/** Gap between one fragment's start and the next's — this is the stagger. */
const POP_STEP = 0.09

const SPRING = { stiffness: 70, damping: 20, mass: 0.9 } as const

export function HeroFragments({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()

  // -0.5 … 0.5 relative to the viewport centre.
  const px = useMotionValue(0)
  const py = useMotionValue(0)
  const sx = useSpring(px, SPRING)
  const sy = useSpring(py, SPRING)

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  })

  useEffect(() => {
    if (reduced) return
    function onMove(e: PointerEvent) {
      px.set(e.clientX / window.innerWidth - 0.5)
      py.set(e.clientY / window.innerHeight - 0.5)
    }
    // On the window, because this layer must never intercept a click meant for
    // the CTAs above it.
    window.addEventListener("pointermove", onMove, { passive: true })
    return () => window.removeEventListener("pointermove", onMove)
  }, [reduced, px, py])

  return (
    // The six fragments are laid out top → bottom, alternating left/right, and
    // `order` below is assigned in exactly that visual sequence — 0 and 1 at
    // the top, 4 and 5 at the bottom — so the pop-in cascade arrives in the
    // same order the eye would naturally scan the composition.
    <div ref={ref} className="relative mx-auto mt-16 max-w-5xl sm:mt-20">
      <FloatingFragment
        pointerX={sx}
        pointerY={sy}
        scroll={scrollYProgress}
        depth={38}
        drift={-70}
        order={0}
        className="absolute -left-2 top-4 hidden w-56 lg:block"
        delay="-1.5s"
      >
        <WhatsAppBubble />
      </FloatingFragment>

      <FloatingFragment
        pointerX={sx}
        pointerY={sy}
        scroll={scrollYProgress}
        depth={-26}
        drift={54}
        order={1}
        className="absolute -right-4 top-0 hidden lg:block"
        delay="-4s"
      >
        <TokenChip />
      </FloatingFragment>

      <FloatingFragment
        pointerX={sx}
        pointerY={sy}
        scroll={scrollYProgress}
        depth={22}
        drift={-30}
        order={2}
        className="absolute left-0 top-[42%] hidden w-52 lg:block"
        delay="-3.4s"
      >
        <BookedChip />
      </FloatingFragment>

      <FloatingFragment
        pointerX={sx}
        pointerY={sy}
        scroll={scrollYProgress}
        depth={-20}
        drift={32}
        order={3}
        className="absolute right-0 top-[46%] hidden w-52 lg:block"
        delay="-5.2s"
      >
        <ReminderChip />
      </FloatingFragment>

      <FloatingFragment
        pointerX={sx}
        pointerY={sy}
        scroll={scrollYProgress}
        depth={30}
        drift={44}
        order={4}
        className="absolute -right-2 bottom-16 hidden lg:block"
        delay="-2.5s"
      >
        <PaidChip />
      </FloatingFragment>

      <FloatingFragment
        pointerX={sx}
        pointerY={sy}
        scroll={scrollYProgress}
        depth={-18}
        drift={-38}
        order={5}
        className="absolute bottom-6 -left-6 hidden lg:block"
        delay="-6s"
      >
        <NotesChip />
      </FloatingFragment>

      <div className="relative mx-auto max-w-md">{children}</div>
    </div>
  )
}

function FloatingFragment({
  children,
  className,
  pointerX,
  pointerY,
  scroll,
  order,
  depth,
  drift,
  delay,
}: {
  children: React.ReactNode
  className?: string
  pointerX: MotionValue<number>
  pointerY: MotionValue<number>
  scroll: MotionValue<number>
  /** 0-based position in the top-to-bottom pop-in cascade — see the module doc. */
  order: number
  /** Pointer travel in px at the extremes. Negative = moves against the cursor. */
  depth: number
  /** Scroll travel in px across the hero's pass through the viewport. */
  drift: number
  delay: string
}) {
  const x = useTransform(pointerX, (v) => v * depth)
  const y = useTransform(pointerY, (v) => v * depth * 0.6)
  const scrollY = useTransform(scroll, [0, 1], [drift, -drift])

  // Each fragment's own slice of the pass, offset by `order` — see the
  // "pop-in cascade" note at the top of the file for why three points and not
  // two. `start` is clamped so a large `order` can never push the window past
  // the point where `useTransform`'s input range would stop being ascending.
  const start = Math.min(0.04 + order * POP_STEP, 0.9)
  const end = Math.min(start + POP_WINDOW, 1)
  const mid = (start + end) / 2
  const popOpacity = useTransform(scroll, [start, mid, end], [0, 1, 1])
  const popScale = useTransform(scroll, [start, mid, end], [0.5, 1.08, 1])

  return (
    // Outer: scroll drift + the pop-in itself. Inner: pointer. Innermost: the
    // idle bob, so a still cursor doesn't leave the composition frozen.
    //
    // The tree is the same shape whatever the motion preference — `data-parallax`
    // lets globals.css freeze the transforms (and, for the pop-in, the opacity
    // too) under `prefers-reduced-motion`. Returning a different tree here
    // instead would hydration-mismatch.
    <motion.div
      data-parallax
      style={{ y: scrollY, opacity: popOpacity, scale: popScale }}
      className={className}
      suppressHydrationWarning
    >
      <motion.div data-parallax style={{ x, y }} suppressHydrationWarning>
        <div className="animate-float-slow" style={{ animationDelay: delay }} suppressHydrationWarning>
          {children}
        </div>
      </motion.div>
    </motion.div>
  )
}

/* ── the fragments themselves ─────────────────────────────────────────────
   Deliberately small and legible at a glance — each is one sentence of proof,
   not a screenshot to be studied.

   `text-card-foreground` on every root is NOT redundant with `bg-card`. These
   are light cards sitting on the DARK hero band, so any text inside that does
   not name its own colour inherits the band's light foreground and vanishes
   into the card. Pairing the two on the root fixes the whole subtree and keeps
   these safe to drop on a band of either polarity. */

function WhatsAppBubble() {
  return (
    <div className="rounded-2xl rounded-bl-sm border border-edge/25 bg-card text-card-foreground p-3 shadow-nm-float">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-success">
        <MessageCircle className="size-3.5" />
        WhatsApp
      </div>
      <p className="mt-1.5 text-xs leading-snug font-medium">Appointment confirmed</p>
      <p className="text-xs leading-snug text-muted-foreground">Today 6:30 PM · Token #4</p>
    </div>
  )
}

function TokenChip() {
  return (
    <div className="flex items-center gap-2.5 rounded-2xl border border-edge/25 bg-card text-card-foreground px-3.5 py-3 shadow-nm-float">
      <span className="flex size-10 items-center justify-center rounded-xl bg-primary font-heading text-lg font-bold text-primary-foreground">
        4
      </span>
      <div>
        <p className="text-xs font-semibold">Now serving</p>
        <p className="text-[11px] text-muted-foreground">3 waiting</p>
      </div>
    </div>
  )
}

function BookedChip() {
  return (
    <div className="flex items-center gap-2.5 rounded-2xl border border-edge/25 bg-card text-card-foreground px-3.5 py-2.5 shadow-nm-float">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
        <CalendarCheck className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold">New booking</p>
        <p className="truncate text-[11px] text-muted-foreground">Meera Iyer · online</p>
      </div>
    </div>
  )
}

function ReminderChip() {
  return (
    <div className="flex items-center gap-2 rounded-full border border-edge/25 bg-card text-card-foreground px-3.5 py-2 shadow-nm-float">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-warning/15 text-warning">
        <BellRing className="size-3.5" />
      </span>
      <p className="text-xs font-medium">
        Reminder sent <span className="text-muted-foreground">· 2h before</span>
      </p>
    </div>
  )
}

function PaidChip() {
  return (
    <div className="flex items-center gap-2 rounded-full border border-edge/25 bg-card text-card-foreground px-3.5 py-2 shadow-nm-float">
      <span className="flex size-6 items-center justify-center rounded-full bg-success/15 text-success">
        <IndianRupee className="size-3.5" />
      </span>
      <p className="text-xs font-medium">
        450 received <span className="text-muted-foreground">· UPI</span>
      </p>
    </div>
  )
}

/* This slot used to be a second "Prescription sent" chip. `AnimatedMockup` — a
   few hundred pixels away, in the middle of the same composition — already
   raises exactly that chip on three of its five scenes, and two identical
   notifications on screen at once reads as a bug rather than as a busy clinic.
   Visit notes are the one part of the paperless claim nothing else here says. */
function NotesChip() {
  return (
    <div className="flex items-center gap-2 rounded-full border border-edge/25 bg-card text-card-foreground px-3.5 py-2 shadow-nm-float">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <FileText className="size-3.5" />
      </span>
      <p className="text-xs font-medium">
        Visit note filed <span className="text-muted-foreground">· no paper</span>
      </p>
    </div>
  )
}

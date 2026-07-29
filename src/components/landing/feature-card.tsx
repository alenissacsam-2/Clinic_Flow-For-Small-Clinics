"use client"

import { useRef } from "react"
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react"
import { cn } from "@/lib/utils"

/**
 * Neumorphic feature card with pointer-tracked lighting.
 *
 * Four stacked layers build the depth:
 *   0. ambient glow   — indigo bloom that bleeds out past the card on hover
 *   1. the plane      — `shadow-nm-raised`, the extruded body
 *   2. specular       — a radial highlight that follows the cursor, as if the
 *                       card had a gloss coat catching a moving lamp
 *   3. glass sheen    — a fixed top-edge gradient, so the surface reads as
 *                       coated rather than matte
 *
 * ── Why motion values and not state ──────────────────────────────────────
 * Pointer tracking at 60–120Hz through `useState` would re-render this
 * subtree on every mousemove. Everything here is driven by MotionValues and
 * CSS custom properties instead, which write straight to the compositor and
 * never re-render React at all. That also keeps it clear of the React
 * Compiler rule this codebase has tripped before — no synchronous setState
 * in an effect body, because there is no effect and no setState.
 *
 * Tilt and specular are both suppressed under `prefers-reduced-motion`: the
 * card keeps its neumorphic depth and hover glow, but stops moving.
 */

const SPRING = { stiffness: 180, damping: 20, mass: 0.6 } as const

/** Degrees of rotation at the card's edge. Past ~10 the text starts to smear. */
const MAX_TILT = 7

export function FeatureCard({
  icon,
  title,
  description,
  footer,
  className,
}: {
  /**
   * Rendered element, not a component type — e.g. `icon={<Stethoscope />}`.
   * This is a Client Component and nearly every page here is a Server
   * Component; a function prop cannot cross that boundary, but an element can.
   */
  icon?: React.ReactNode
  title: string
  description: string
  footer?: React.ReactNode
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()

  // Pointer position within the card, normalised to -0.5 … 0.5.
  const px = useMotionValue(0)
  const py = useMotionValue(0)
  // Separate 0–100% pair for the specular gradient's centre.
  const gx = useMotionValue(50)
  const gy = useMotionValue(50)

  const rotateX = useSpring(useTransform(py, [-0.5, 0.5], [MAX_TILT, -MAX_TILT]), SPRING)
  const rotateY = useSpring(useTransform(px, [-0.5, 0.5], [-MAX_TILT, MAX_TILT]), SPRING)

  const mx = useMotionTemplate`${gx}%`
  const my = useMotionTemplate`${gy}%`

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (reduced) return
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const nx = (e.clientX - r.left) / r.width
    const ny = (e.clientY - r.top) / r.height
    px.set(nx - 0.5)
    py.set(ny - 0.5)
    gx.set(nx * 100)
    gy.set(ny * 100)
  }

  function handlePointerLeave() {
    px.set(0)
    py.set(0)
    gx.set(50)
    gy.set(50)
  }

  return (
    // Perspective lives on the wrapper so the child rotates in real 3D rather
    // than being flattened into a 2D skew.
    <div className={cn("group/fc [perspective:1200px]", className)}>
      <motion.div
        ref={ref}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        data-parallax
        style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
        className={cn(
          "relative isolate h-full rounded-2xl border border-edge/25 bg-card p-6",
          "shadow-nm-raised transition-shadow duration-300 ease-out",
          "group-hover/fc:shadow-nm-float"
        )}
      >
        {/* 0 · ambient glow — sits behind, bleeds past the edge */}
        <div
          aria-hidden
          className="glow-primary pointer-events-none absolute -inset-6 -z-10 rounded-[2rem] opacity-0 blur-2xl transition-opacity duration-500 group-hover/fc:opacity-100"
        />

        {/* 2 · specular highlight tracking the pointer. Always rendered — the
            pointer handler simply stops feeding it under reduced motion, and
            `data-spotlight` hides it in CSS. Rendering it conditionally would
            hydration-mismatch, because the server cannot know the preference. */}
        <motion.div
          aria-hidden
          data-spotlight
          style={{ "--mx": mx, "--my": my } as React.CSSProperties}
          className="spotlight pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover/fc:opacity-100"
        />

        {/* 3 · fixed glass sheen along the top edge */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-2/5 rounded-t-2xl bg-gradient-to-b from-white/45 to-transparent dark:from-white/[0.06]"
        />

        {/* content — lifted toward the viewer so it parallaxes against the plane */}
        <div
          data-parallax
          className="relative flex h-full flex-col gap-3"
          style={{ transform: "translateZ(38px)" }}
        >
          {icon && (
            // The icon chip is pressed INTO the card — a counterpoint to the
            // card's own extrusion, which is what sells both as physical.
            <span className="mb-1 inline-flex size-11 items-center justify-center rounded-xl bg-background/70 text-primary shadow-nm-inset [&_svg]:size-5">
              {icon}
            </span>
          )}
          <h3 className="font-heading text-lg leading-snug font-bold tracking-[-0.03em] text-card-foreground">
            {title}
          </h3>
          <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
          {footer && <div className="mt-auto pt-2">{footer}</div>}
        </div>
      </motion.div>
    </div>
  )
}

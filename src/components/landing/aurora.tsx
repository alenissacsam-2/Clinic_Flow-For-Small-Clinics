"use client"

import { useEffect, useRef } from "react"
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react"

import { cn } from "@/lib/utils"

/**
 * Aurora — the landing page's living background.
 *
 * Four soft colour fields drift behind the content and lean toward the
 * pointer at different parallax depths.
 *
 * Colour only. It gives the hero air and a sense of light; the structure comes
 * from the type and the product mockup in front of it.
 *
 * ── Why this and not WebGL ───────────────────────────────────────────────
 * This replaced an R3F scene. The 3D object competed with the product mockup
 * in front of it — two card-like things at different depths, one of them
 * abstract, which reads as debris rather than depth — and cost ~200KB gz to
 * do it. A background's job is to give the page air and a sense of light, not
 * to be looked at. Everything here is four blurred divs and two gradients:
 * no canvas, no shader, no dependency, and it composites on the GPU.
 *
 * ── Why no state ─────────────────────────────────────────────────────────
 * Pointer moves at 60–120Hz. Every value below is a MotionValue written into
 * a CSS custom property, so nothing here re-renders React — and there is no
 * setState in an effect for the compiler to object to.
 *
 * Each field has its own parallax depth, so they separate as the cursor moves
 * instead of sliding as one sheet. Reduced motion drops the drift AND the lean
 * (via `[data-parallax]` and `.animate-glow-drift` in globals.css), leaving a
 * still gradient — the colour is the point, the movement is the flourish.
 */

const SPRING = { stiffness: 60, damping: 22, mass: 1.1 } as const

/** x/y drift in px at the pointer's extremes. Bigger = nearer the viewer. */
const DEPTHS = [46, -30, 22, -14]

export function Aurora({ className }: { className?: string }) {
  const reduced = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)

  // -0.5 … 0.5 relative to the viewport centre.
  const px = useMotionValue(0)
  const py = useMotionValue(0)

  const sx = useSpring(px, SPRING)
  const sy = useSpring(py, SPRING)

  useEffect(() => {
    if (reduced) return
    function onMove(e: PointerEvent) {
      px.set(e.clientX / window.innerWidth - 0.5)
      py.set(e.clientY / window.innerHeight - 0.5)
    }
    // Listens on the window because the layer itself is pointer-events-none —
    // it must never intercept a click meant for the CTA in front of it.
    window.addEventListener("pointermove", onMove, { passive: true })
    return () => window.removeEventListener("pointermove", onMove)
  }, [reduced, px, py])

  // Declared flat and unconditionally — hooks can't live in a loop or a
  // callback, and `reduced` must not gate whether they run.
  const x0 = useTransform(sx, (v) => v * DEPTHS[0])
  const y0 = useTransform(sy, (v) => v * DEPTHS[0] * 0.7)
  const x1 = useTransform(sx, (v) => v * DEPTHS[1])
  const y1 = useTransform(sy, (v) => v * DEPTHS[1] * 0.7)
  const x2 = useTransform(sx, (v) => v * DEPTHS[2])
  const y2 = useTransform(sy, (v) => v * DEPTHS[2] * 0.7)
  const x3 = useTransform(sx, (v) => v * DEPTHS[3])
  const y3 = useTransform(sy, (v) => v * DEPTHS[3] * 0.7)
  // Always the same style object regardless of motion preference. Returning
  // `undefined` under reduced motion (as this used to) drops the style
  // attribute on the client but not on the server, which hydration-mismatches
  // for exactly the visitors who set the preference. `data-parallax` lets
  // globals.css freeze the transform instead.
  const fields = [
    { x: x0, y: y0 },
    { x: x1, y: y1 },
    { x: x2, y: y2 },
    { x: x3, y: y3 },
  ]
  const field = (i: number) => fields[i]

  return (
    <div
      ref={ref}
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
    >
      {/* ── colour fields ─────────────────────────────────────────────────── */}
      <motion.div
        data-parallax
        style={field(0)}
        className="glow-primary animate-glow-drift absolute -top-[22rem] -left-[14rem] size-[46rem] rounded-full blur-[90px]"
      />
      <motion.div
        data-parallax
        style={field(1)}
        className="glow-clay animate-glow-drift absolute -top-[10rem] right-[-16rem] size-[38rem] rounded-full blur-[100px] [animation-delay:-7s]"
      />
      <motion.div
        data-parallax
        style={field(2)}
        className="glow-primary animate-glow-drift absolute right-[8%] bottom-[-20rem] size-[34rem] rounded-full opacity-70 blur-[110px] [animation-delay:-13s]"
      />
      <motion.div
        data-parallax
        style={field(3)}
        className="glow-clay animate-glow-drift absolute bottom-[-14rem] left-[6%] size-[28rem] rounded-full opacity-60 blur-[90px] [animation-delay:-4s]"
      />

      {/* Soft vignette so the fields never hard-edge against the section end. */}
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-background" />
    </div>
  )
}

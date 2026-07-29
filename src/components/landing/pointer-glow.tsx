"use client"

import { useEffect, useRef } from "react"
import { motion, useMotionValue, useSpring, useTransform } from "motion/react"

import { cn } from "@/lib/utils"

/**
 * A soft light that follows the pointer across whichever section it is dropped
 * into. Turns a flat band into a lit room without asking that band to become a
 * Client Component.
 *
 * ── The listener goes on the parent, deliberately ────────────────────────
 * The obvious build — an absolutely-positioned overlay with its own
 * `onPointerMove` — has to choose between swallowing clicks on the content
 * underneath (`pointer-events: auto`) or receiving no events at all
 * (`pointer-events: none`). Neither is acceptable on a band with buttons in it.
 * So this component renders a `pointer-events: none` layer and reaches one node
 * up to listen, which is what lets a *server-rendered* section stay a server
 * component and still be interactive: drop `<PointerGlow />` inside it and the
 * whole section is the hit area.
 *
 * Nothing here re-renders. The pointer writes to MotionValues, the springs
 * write to the compositor, and React runs once.
 *
 * The half-size offsets are folded into the transform rather than done with
 * `-translate-x-1/2`, because motion writes the `transform` property itself and
 * a Tailwind translate on the same element would simply be overwritten.
 */

const SPRING = { stiffness: 90, damping: 22, mass: 0.9 } as const

export function PointerGlow({
  className,
  /** Diameter in px. Also the amount each axis is offset to centre the blob. */
  size = 520,
  tone = "primary",
}: {
  className?: string
  size?: number
  tone?: "primary" | "clay"
}) {
  const ref = useRef<HTMLDivElement>(null)
  const mx = useMotionValue(-9999)
  const my = useMotionValue(-9999)
  const lit = useMotionValue(0)

  const x = useSpring(useTransform(mx, (v) => v - size / 2), SPRING)
  const y = useSpring(useTransform(my, (v) => v - size / 2), SPRING)
  const opacity = useSpring(lit, { stiffness: 60, damping: 20 })

  useEffect(() => {
    const host = ref.current?.parentElement
    if (!host) return

    const move = (e: PointerEvent) => {
      const r = host.getBoundingClientRect()
      mx.set(e.clientX - r.left)
      my.set(e.clientY - r.top)
      lit.set(1)
    }
    const leave = () => lit.set(0)

    host.addEventListener("pointermove", move)
    host.addEventListener("pointerleave", leave)
    return () => {
      host.removeEventListener("pointermove", move)
      host.removeEventListener("pointerleave", leave)
    }
  }, [mx, my, lit])

  return (
    <div ref={ref} aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <motion.div
        style={{ x, y, opacity, width: size, height: size }}
        className={cn(
          "absolute top-0 left-0 rounded-full blur-3xl",
          tone === "clay" ? "glow-clay" : "glow-primary",
          className,
        )}
      />
    </div>
  )
}

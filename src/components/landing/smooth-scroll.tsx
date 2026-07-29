"use client"

import { useEffect } from "react"
import Lenis from "lenis"

import { registerLenis } from "./scroll-to"

/**
 * Inertia scrolling for the marketing page.
 *
 * This is the layer that makes every scroll-driven effect on this page read as
 * deliberate rather than stepped — the wheel decelerates instead of jumping in
 * OS-sized notches, so the word-by-word reveal and the stacking panels are
 * *watched* rather than flicked past.
 *
 * ── Why it's safe to put this over `useScroll` ───────────────────────────
 * Lenis wraps the browser's own scroll rather than faking it with a transform
 * on a wrapper element, so `window.scrollY` stays truthful. That means motion's
 * `useScroll` needs no bridge, and `position: sticky` (which `StackPanels`
 * depends on) and anchor links keep working. A transform-based smooth-scroll
 * library would break all three.
 *
 * ── Two deliberate settings ──────────────────────────────────────────────
 * `syncTouch: false` (the default, kept explicit) leaves touch devices on
 * native scrolling. The audience here is solo doctors in India, largely on
 * low-end Android — smoothing a finger drag on that hardware feels like lag,
 * not polish, and it is the one place scroll-hijacking is genuinely resented.
 * So this is a desktop-pointer enhancement only.
 *
 * `autoRaf: true` lets Lenis own its own frame loop; there is no hand-rolled
 * `requestAnimationFrame` to leak.
 *
 * Mounted inside `LandingMotionProvider`, so it never reaches the clinical app.
 */
export function SmoothScroll() {
  useEffect(() => {
    // Not `useReducedMotion()` — that's a hook returning null on first render,
    // and by the time it settled Lenis would already have taken over the scroll.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    const lenis = new Lenis({ autoRaf: true, smoothWheel: true, syncTouch: false })
    // Published so the nav can drive it — see `scroll-to.ts` for why that is a
    // module binding rather than context.
    registerLenis(lenis)
    return () => {
      registerLenis(null)
      lenis.destroy()
    }
  }, [])

  return null
}

"use client"

import { useRef } from "react"
import { motion, useScroll, useTransform, type MotionValue } from "motion/react"

import { cn } from "@/lib/utils"

/**
 * Text that lights up word by word as it passes through the viewport.
 *
 * The words sit dim and brighten in a wave that is *scrubbed* to scroll
 * position — scroll back up and it un-lights. That scrub is the whole point:
 * a one-shot `whileInView` fade is a thing that happens *at* you, whereas this
 * is tied to your hand on the wheel, so the sentence reads at the pace you
 * choose to read it.
 *
 * ── Accessibility: why the words aren't just spans ───────────────────────
 * Splitting a sentence into N elements is normally how you wreck it for screen
 * readers — some announce each fragment as its own phrase. The trailing space
 * is kept *inside* each span (`{word} `) rather than between them, so the
 * accessible text stays a normal sentence, text selection spans words
 * naturally, and copy-paste produces prose rather than a word list.
 *
 * ── Why a child component per word ───────────────────────────────────────
 * Each word needs its own `useTransform`, and hooks cannot be called inside a
 * `.map()`. So the parent owns the single `useScroll` and passes the resulting
 * MotionValue down; each `Word` calls exactly one hook. This is the same shape
 * `aurora.tsx` uses for its parallax fields, and it means the wave costs zero
 * React re-renders — every frame is a direct style write.
 *
 * Reduced motion pins every word at full opacity — handled in globals.css via
 * `[data-scrub-word]`, deliberately NOT by branching the JSX. The server has no
 * idea what a visitor's motion preference is, so a component that renders a
 * different tree for it hydration-mismatches for exactly those visitors.
 */

/** How much of the scroll each word's own fade occupies. Wider = softer wave. */
const WORD_FADE = 0.14

export function ScrubText({
  children,
  className,
}: {
  children: string
  className?: string
}) {
  const ref = useRef<HTMLParagraphElement>(null)

  // Starts as the block enters the lower third and completes before it leaves
  // the upper third, so the wave finishes while the sentence is still centred
  // and readable rather than resolving on its way off the top.
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 0.85", "end 0.45"],
  })

  const words = children.split(" ")

  return (
    <p ref={ref} className={cn("text-balance", className)}>
      {words.map((word, i) => {
        // Words overlap heavily (WORD_FADE ≫ the gap between starts), which is
        // what makes it a travelling wave instead of a row of switches.
        const start = (i / words.length) * (1 - WORD_FADE)
        return (
          <Word key={i} progress={scrollYProgress} start={start}>
            {word}
          </Word>
        )
      })}
    </p>
  )
}

function Word({
  children,
  progress,
  start,
}: {
  children: string
  progress: MotionValue<number>
  start: number
}) {
  // `useTransform` clamps at the range ends by default, so a word is fully dim
  // before its slice and fully lit after it.
  const opacity = useTransform(progress, [start, start + WORD_FADE], [0.16, 1])
  // `data-scrub-word` is the hook the reduced-motion block in globals.css uses
  // to pin every word at full opacity.
  return (
    <motion.span data-scrub-word style={{ opacity }}>
      {children}{" "}
    </motion.span>
  )
}

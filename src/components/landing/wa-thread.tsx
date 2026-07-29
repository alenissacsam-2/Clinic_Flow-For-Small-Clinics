"use client"

import { useEffect, useRef, useState } from "react"
import { motion, useInView } from "motion/react"
import { Check, FileText, IndianRupee } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * The focal card's WhatsApp thread — a clinic day's messages, on a loop.
 *
 * It used to play once on scroll-in and then sit there as a screenshot. The
 * claim the card makes is that these messages keep going out without anyone
 * touching them, so a thread that stops is arguing the opposite: the section is
 * about a thing that never stops, and the illustration stopped.
 *
 * ── The loop is a state machine, not a timeline ──────────────────────────
 * One `setTimeout` at a time, scheduled from the current phase. Each transition
 * re-runs the effect, which schedules the next one — so there is no interval to
 * drift, no array of timers to clean up, and the `setState` happens inside a
 * timer callback rather than in an effect body (the React Compiler rule this
 * codebase has tripped three times).
 *
 * ── Two details that keep it from being annoying ─────────────────────────
 * It only runs while it is on screen (`useInView` without `once`), so a phone
 * that has scrolled past is not burning a timer and a repaint every second for
 * a card nobody is looking at. And every bubble is in the DOM from the first
 * render at full height — only opacity changes — so the card never reflows and
 * the section below it never jumps while you are reading it.
 *
 * Reduced motion is handled in CSS (`[data-wa-bubble]`, `[data-wa-typing]` in
 * globals.css), not by branching this tree. The server cannot know the
 * preference, so a branch here would hydration-mismatch the page for exactly
 * the people who asked for less movement.
 */

const MESSAGES: { text: string; kind?: "doc" | "money" }[] = [
  { text: "Your appointment with Dr. Sharma is confirmed for tomorrow, 11:30 AM. Token #4." },
  { text: "Reminder: your visit is in 2 hours. Reply STOP to opt out." },
  { text: "Prescription.pdf", kind: "doc" },
  { text: "Receipt · ₹450 received", kind: "money" },
]

/** Milliseconds spent in each phase. */
const TYPING = 950
const GAP = 700
const HOLD = 3200

type Phase = { shown: number; typing: boolean }

export function WaThread() {
  const ref = useRef<HTMLDivElement>(null)
  const onScreen = useInView(ref, { amount: 0.3 })
  const [phase, setPhase] = useState<Phase>({ shown: 0, typing: true })

  useEffect(() => {
    if (!onScreen) return

    const { shown, typing } = phase
    const [ms, next]: [number, Phase] = typing
      ? [TYPING, { shown: shown + 1, typing: false }]
      : shown >= MESSAGES.length
        ? [HOLD, { shown: 0, typing: true }]
        : [GAP, { shown, typing: true }]

    const t = setTimeout(() => setPhase(next), ms)
    return () => clearTimeout(t)
  }, [phase, onScreen])

  return (
    <div ref={ref} className="mt-6 space-y-2">
      {MESSAGES.map((m, i) => (
        <motion.div
          key={m.text}
          data-wa-bubble
          // Messages that have not arrived yet are ghosted, not hidden. At
          // opacity 0 the card spent a third of every loop looking like an
          // empty box — which is a bad still frame for a section arguing that
          // this conversation never stops. Ghosting keeps the card composed at
          // every moment of the cycle and still makes arrival obvious.
          animate={{ opacity: i < phase.shown ? 1 : 0.22 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className={cn(
            "flex max-w-[85%] items-center gap-2 rounded-2xl rounded-tl-sm border border-border",
            "bg-background px-3 py-2 text-xs",
            m.kind && "w-fit font-medium text-primary",
          )}
        >
          {m.kind === "doc" && <FileText className="size-3.5 shrink-0" />}
          {m.kind === "money" && <IndianRupee className="size-3.5 shrink-0" />}
          <span>{m.text}</span>
          {/* The double tick is the detail that makes a mock thread read as a
              real one. Delivered, not read — we know it left, not that she
              looked at it, and claiming otherwise in a screenshot is a small
              lie that costs nothing to avoid. */}
          <span aria-hidden className="ml-auto inline-flex shrink-0 text-info">
            <Check className="size-3" strokeWidth={3} />
            <Check className="-ml-1.5 size-3" strokeWidth={3} />
          </span>
        </motion.div>
      ))}

      {/* Height is reserved whether or not it is showing, so the card is a
          fixed box from first paint. */}
      <motion.div
        aria-hidden
        data-wa-typing
        animate={{ opacity: phase.typing && onScreen ? 1 : 0 }}
        transition={{ duration: 0.25 }}
        className="flex w-fit items-center gap-1 rounded-2xl rounded-tl-sm border border-border bg-background px-3 py-2.5"
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="animate-typing-dot size-1.5 rounded-full bg-muted-foreground"
            style={{ animationDelay: `${i * 160}ms` }}
          />
        ))}
      </motion.div>
    </div>
  )
}

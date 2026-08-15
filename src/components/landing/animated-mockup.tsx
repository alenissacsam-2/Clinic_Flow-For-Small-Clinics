"use client"

import { useEffect, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { APPOINTMENT_STATUS } from "@/lib/status"

/**
 * The hero centrepiece: a believable "Today" queue that plays out a scripted
 * clinic afternoon on a loop — a patient finishes, their prescription pings out
 * on WhatsApp, the next one goes in, and a fresh online booking drops onto the
 * end of the list. Not a live simulation; a hand-authored SCRIPT of snapshots
 * the component steps through. Rows are derived purely from the current scene
 * (React Compiler safe), and the whole thing freezes on scene 0 — visually the
 * old static mock — when the visitor prefers reduced motion.
 */

type Status = "confirmed" | "arrived" | "in_progress" | "completed"

const PATIENTS: Record<number, { name: string; note: string }> = {
  1: { name: "Ramesh Kumar", note: "Fever, 3 days" },
  2: { name: "Priya Nair", note: "Follow-up" },
  3: { name: "Aarav Shah", note: "New patient" },
  4: { name: "Fatima Sheikh", note: "Booked online" },
  5: { name: "Meera Iyer", note: "Booked online" },
  6: { name: "Dev Menon", note: "Walk-in" },
}

type Scene = {
  rows: { token: number; status: Status }[]
  /** Name the WhatsApp chip credits, or null to hide it. */
  sent: string | null
}

// Each adjacent pair (including the wrap back to scene 0) shares at least two
// rows, so the loop never does a jarring full-list swap.
const SCRIPT: Scene[] = [
  {
    rows: [
      { token: 1, status: "in_progress" },
      { token: 2, status: "arrived" },
      { token: 3, status: "confirmed" },
      { token: 4, status: "confirmed" },
    ],
    sent: null,
  },
  {
    rows: [
      { token: 1, status: "completed" },
      { token: 2, status: "arrived" },
      { token: 3, status: "confirmed" },
      { token: 4, status: "confirmed" },
    ],
    sent: "Ramesh Kumar",
  },
  {
    rows: [
      { token: 2, status: "in_progress" },
      { token: 3, status: "arrived" },
      { token: 4, status: "confirmed" },
      { token: 5, status: "confirmed" },
    ],
    sent: "Ramesh Kumar",
  },
  {
    rows: [
      { token: 2, status: "completed" },
      { token: 3, status: "arrived" },
      { token: 4, status: "confirmed" },
      { token: 5, status: "confirmed" },
    ],
    sent: "Priya Nair",
  },
  {
    rows: [
      { token: 3, status: "in_progress" },
      { token: 4, status: "arrived" },
      { token: 5, status: "confirmed" },
      { token: 6, status: "confirmed" },
    ],
    sent: null,
  },
]

const rowSpring = { type: "spring", bounce: 0, duration: 0.4 } as const

export function AnimatedMockup() {
  const reduced = useReducedMotion()
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (reduced) return
    const id = setInterval(() => setStep((s) => (s + 1) % SCRIPT.length), 2800)
    return () => clearInterval(id)
  }, [reduced])

  const scene = SCRIPT[step]

  // Same rule the real `DayFocus` uses: a patient who has physically arrived
  // outranks one who is merely booked.
  const current = scene.rows.find((r) => r.status === "in_progress") ?? null
  const next =
    scene.rows.find((r) => r.status === "arrived") ??
    scene.rows.find((r) => r.status === "confirmed") ??
    null

  return (
    <div className="relative mx-auto max-w-md pb-6">
      {/* Queue card. Solid, not glass — it sits over the hero film, and a
          frosted panel would let the footage wash through the names.
          `text-card-foreground` is load-bearing: on the dark hero band, text
          that does not name its colour inherits the band's light foreground
          and disappears into this light card. */}
      <div className="rounded-2xl border border-edge/25 bg-card text-card-foreground p-5 shadow-nm-float">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="font-heading text-base font-semibold">Today</p>
            <p className="text-xs text-muted-foreground">Wed, 24 Jul · 4 in queue</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground">
            <span className="size-1.5 rounded-full bg-primary-foreground animate-live-dot" />
            Live
          </span>
        </div>

        {/* The focus strip — who is in the room, who is next.
            This is not decoration invented for the marketing page: it is the
            product's actual Today screen, which leads with exactly this pair
            for exactly this reason. Whoever reaches the real app after seeing
            this should recognise it immediately, so the hero has to be a
            portrait of the software rather than an idealised cousin of it. */}
        <div className="mb-3 grid grid-cols-2 gap-2">
          <FocusChip
            eyebrow="In consultation"
            token={current?.token}
            name={current ? PATIENTS[current.token].name : null}
            active
          />
          <FocusChip
            eyebrow="Up next"
            token={next?.token}
            name={next ? PATIENTS[next.token].name : null}
          />
        </div>

        <motion.div layout className="space-y-2">
          <AnimatePresence mode="popLayout" initial={false}>
            {scene.rows.map((r) => {
              const p = PATIENTS[r.token]
              const s = APPOINTMENT_STATUS[r.status]
              return (
                <motion.div
                  key={r.token}
                  layout
                  initial={{ opacity: 0, transform: "translateY(14px)" }}
                  animate={{ opacity: 1, transform: "translateY(0px)" }}
                  exit={{ opacity: 0, y: -14 }}
                  transition={rowSpring}
                  // Rows sink into the card they sit in — recessed slots
                  // inside a raised plane, the system's core contrast.
                  className="flex items-center gap-3 rounded-lg border border-edge/15 bg-background/70 px-3 py-2 shadow-nm-inset"
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-accent text-xs font-semibold text-accent-foreground">
                    {r.token}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{p.note}</p>
                  </div>
                  <span className="relative inline-flex shrink-0 items-center">
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.span
                        key={r.status}
                        initial={{ opacity: 0, transform: "scale(0.7)" }}
                        animate={{ opacity: 1, transform: "scale(1)" }}
                        exit={{ opacity: 0, scale: 0.7 }}
                        transition={{ duration: 0.18, ease: "easeOut" }}
                        className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", s.badge)}
                      >
                        {s.label}
                      </motion.span>
                    </AnimatePresence>
                  </span>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Overlapping "sent on WhatsApp" chip — see below for FocusChip. */}
      <div className="pointer-events-none absolute -bottom-7 -left-5 hidden sm:block">
        <AnimatePresence>
          {scene.sent && (
            <motion.div
              key={scene.sent}
              initial={{ opacity: 0, transform: "scale(0.85) translateY(10px)" }}
              animate={{ opacity: 1, transform: "scale(1) translateY(0px)" }}
              exit={{ opacity: 0, transform: "scale(0.95)" }}
              transition={{ type: "spring", bounce: 0, duration: 0.4 }}
              className="rounded-xl border border-edge/25 bg-card text-card-foreground px-4 py-3 shadow-nm-float"
            >
              <div className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-full bg-success/15 text-success">
                  <Check className="size-3.5" />
                </span>
                <div className="text-xs">
                  <p className="font-medium">Prescription sent</p>
                  <p className="text-muted-foreground">to {scene.sent} · on WhatsApp</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

/**
 * One half of the focus strip. Deliberately small and quiet — it sits above a
 * list that is already busy, and its job is to be *findable*, not loud.
 *
 * The active side is filled rather than merely outlined, because on a card
 * this size a border is not enough of a difference to survive being glanced
 * at from across a room in a screenshot on someone's phone.
 */
function FocusChip({
  eyebrow,
  token,
  name,
  active = false,
}: {
  eyebrow: string
  token?: number
  name: string | null
  active?: boolean
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-lg px-2.5 py-2",
        active
          ? "border border-primary/25 bg-primary/8 shadow-nm-raised"
          : "border border-edge/15 bg-background/70 shadow-nm-inset",
      )}
    >
      <p className="flex items-center gap-1 text-[0.5625rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {active && <span className="animate-live-dot size-1 rounded-full bg-primary" />}
        {eyebrow}
      </p>
      <AnimatePresence mode="wait" initial={false}>
        <motion.p
          key={name ?? "none"}
          initial={{ opacity: 0, transform: "translateY(6px)" }}
          animate={{ opacity: 1, transform: "translateY(0px)" }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="mt-0.5 truncate text-sm font-semibold"
        >
          {name ? (
            <>
              <span className="tabular-nums text-muted-foreground">#{token} </span>
              {name}
            </>
          ) : (
            <span className="text-muted-foreground">Room free</span>
          )}
        </motion.p>
      </AnimatePresence>
    </div>
  )
}

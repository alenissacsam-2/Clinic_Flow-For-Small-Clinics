"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import {
  ArrowRight,
  CheckCheck,
  ChevronRight,
  FileText,
  MousePointerClick,
  Pill,
  RotateCcw,
  Send,
  TriangleAlert,
  X,
} from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ScrollSkew } from "./motion-primitives"

/**
 * The playable one.
 *
 * Every other section on this page *describes* the product. This one hands it
 * over: tap a patient out of the queue, tap medicines onto the pad, sign, and
 * watch the prescription land on a phone — with a clock running the whole time.
 * Four things get demonstrated in one interaction that four feature cards were
 * only claiming: the queue, the prescription pad, the drug-safety advisory, and
 * WhatsApp delivery.
 *
 * ── Why the allergy step is the important one ────────────────────────────
 * Amoxicillin is deliberately one of the four chips, and the patient's record
 * deliberately lists a penicillin allergy. Tapping it trips a live advisory
 * that matches on the *active ingredient*, which is exactly what the real
 * engine does and exactly the thing a doctor cannot check for themselves at
 * speed. The advisory also does not block the send — because the real one
 * doesn't, and a demo that pretended otherwise would be selling a product that
 * overrides clinical judgement. That honesty is the feature.
 *
 * ── Layout is fixed-height on purpose ────────────────────────────────────
 * The stage is a fixed min-height across all three steps. A panel that grows as
 * you add medicines would shove the rest of the page down mid-interaction,
 * which on a phone means the thing you just tapped jumps out from under your
 * thumb. Cheap to reserve; very expensive to skip.
 *
 * Reduced motion is handled in CSS via `[data-demo-anim]` rather than by
 * branching this tree — the server cannot know the preference, and the
 * interaction itself (which is user-driven, not autonomous) stays fully intact.
 */

type Medicine = {
  id: string
  name: string
  dose: string
  /** Set on the one that collides with the patient's recorded allergy. */
  clashes?: string
}

const MEDICINES: Medicine[] = [
  { id: "para", name: "Paracetamol 650 mg", dose: "1-0-1 · 3 days" },
  { id: "cet", name: "Cetirizine 10 mg", dose: "0-0-1 · 5 days" },
  {
    id: "amox",
    name: "Amoxicillin 500 mg",
    dose: "1-1-1 · 5 days",
    clashes: "Amoxicillin is a penicillin, and Riya's record lists a penicillin allergy.",
  },
  { id: "ors", name: "ORS sachets", dose: "As needed · 2 days" },
]

const QUEUE = [
  { token: 4, name: "Riya Nair", time: "11:30", note: "Fever, 3 days" },
  { token: 5, name: "Arjun Das", time: "11:45", note: "Follow-up" },
  { token: 6, name: "Meera Iyer", time: "12:00", note: "BP review" },
]

type Step = "queue" | "visit" | "sent"

export function TryIt() {
  const [step, setStep] = useState<Step>("queue")
  const [picked, setPicked] = useState<string[]>([])
  const [elapsed, setElapsed] = useState(0)
  // `performance.now()` never touches render — only handlers and the tick — so
  // the server and the first client render agree on a flat 0.
  const startedAt = useRef(0)

  useEffect(() => {
    if (step !== "visit") return
    const id = setInterval(() => setElapsed(performance.now() - startedAt.current), 83)
    return () => clearInterval(id)
  }, [step])

  function begin() {
    startedAt.current = performance.now()
    setElapsed(0)
    setStep("visit")
  }

  function toggle(id: string) {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  }

  function send() {
    setElapsed(performance.now() - startedAt.current)
    setStep("sent")
  }

  function reset() {
    setPicked([])
    setElapsed(0)
    setStep("queue")
  }

  const chosen = MEDICINES.filter((m) => picked.includes(m.id))
  const clash = chosen.find((m) => m.clashes)
  const seconds = (elapsed / 1000).toFixed(1)

  return (
    <section
      data-band="dark"
      className="nm-dark-surface bg-grain relative isolate bg-sidebar text-sidebar-foreground"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="glow-primary animate-glow-drift absolute -top-40 left-1/4 size-[42rem] rounded-full opacity-70 blur-3xl" />
        <div className="glow-clay animate-glow-drift absolute -right-32 bottom-0 size-[30rem] rounded-full opacity-50 blur-3xl [animation-delay:-9s]" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 py-24 sm:py-32">
        <div className="mx-auto max-w-2xl text-center">
          <p className="font-mono text-xs tracking-[0.22em] text-sidebar-primary">TRY IT</p>
          <ScrollSkew>
            <h2 className="mt-4 font-heading text-4xl font-extrabold tracking-[-0.04em] text-balance sm:text-5xl">
              Write a prescription. Right here.
            </h2>
          </ScrollSkew>
          <p className="mt-4 text-lg text-sidebar-foreground/70">
            Not a video, not a screenshot. This is the actual flow — three taps and a signature.
            There is a clock running, if you are competitive about it.
          </p>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-[1.35fr_1fr] lg:items-start lg:gap-8">
          {/* ── The app stage ───────────────────────────────────────────── */}
          {/* One fixed height across all three steps. A stage that grew as you
              added medicines would shove the rest of the page down mid-tap,
              which on a phone means the control you just pressed jumps out from
              under your thumb. The height is set by the tallest state (four
              medicines on the pad), so the box never moves. */}
          <div
            data-stage
            className="relative min-h-[33rem] overflow-hidden rounded-3xl border border-white/12 bg-white/[0.05] backdrop-blur-sm"
          >
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-white/15" />
                <span className="size-2.5 rounded-full bg-white/15" />
                <span className="size-2.5 rounded-full bg-white/15" />
                <span className="ml-2 font-mono text-[0.7rem] tracking-wider text-sidebar-foreground/45">
                  clinicflow.app/today
                </span>
              </div>
              <span
                className={cn(
                  "font-mono text-sm tabular-nums transition-colors duration-300",
                  step === "visit" ? "text-sidebar-primary" : "text-sidebar-foreground/40",
                )}
              >
                {seconds}s
              </span>
            </div>

            <div className="p-5 sm:p-6">
              <AnimatePresence mode="wait" initial={false}>
                {step === "queue" && (
                  <Slide key="queue">
                    <p className="flex items-center gap-2 text-sm text-sidebar-foreground/60">
                      <MousePointerClick className="size-4 text-sidebar-primary" />
                      Tap a patient to open their visit.
                    </p>
                    <div className="mt-4 space-y-2.5">
                      {QUEUE.map((q, i) => (
                        <button
                          key={q.token}
                          type="button"
                          onClick={begin}
                          className={cn(
                            "group/row flex w-full items-center gap-4 rounded-2xl border px-4 py-3.5 text-left",
                            "transition-colors duration-200",
                            i === 0
                              ? "border-sidebar-primary/50 bg-sidebar-primary/12 hover:bg-sidebar-primary/20"
                              : "border-white/10 bg-white/[0.03] hover:bg-white/[0.07]",
                          )}
                        >
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sidebar-primary/20 font-heading text-sm font-bold text-sidebar-primary">
                            {q.token}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-heading text-sm font-bold">
                              {q.name}
                            </span>
                            <span className="block truncate text-xs text-sidebar-foreground/55">
                              {q.time} · {q.note}
                            </span>
                          </span>
                          {i === 0 && (
                            <span className="animate-live-dot hidden shrink-0 text-xs font-medium text-sidebar-primary sm:inline">
                              Start visit
                            </span>
                          )}
                          <ChevronRight className="size-4 shrink-0 text-sidebar-foreground/35 transition-transform duration-200 group-hover/row:translate-x-1" />
                        </button>
                      ))}
                    </div>

                    {/* The real Today screen carries this strip, and it does
                        double duty here: it is product texture, and it fills the
                        space the fixed stage height leaves in the shortest
                        step. */}
                    <dl className="mt-6 grid grid-cols-3 gap-3 border-t border-white/10 pt-5">
                      {[
                        ["3", "waiting"],
                        ["1", "in consultation"],
                        ["₹1,350", "collected today"],
                      ].map(([v, k]) => (
                        <div key={k}>
                          <dt className="font-heading text-xl font-bold tabular-nums">{v}</dt>
                          <dd className="mt-0.5 text-[0.7rem] text-sidebar-foreground/50">{k}</dd>
                        </div>
                      ))}
                    </dl>
                  </Slide>
                )}

                {step === "visit" && (
                  <Slide key="visit">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-heading text-base font-bold">Riya Nair · Token #4</span>
                      {/* The recorded allergy is stated up front, exactly as the
                          real visit screen does — the advisory below only makes
                          sense if the visitor saw the record first. */}
                      <span className="rounded-full bg-warning/20 px-2.5 py-1 text-[0.7rem] font-medium text-warning">
                        Allergy on file: penicillin
                      </span>
                    </div>

                    <p className="mt-4 flex items-center gap-2 text-sm text-sidebar-foreground/60">
                      <Pill className="size-4 text-sidebar-primary" />
                      Tap to add to the prescription.
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {MEDICINES.map((m) => {
                        const on = picked.includes(m.id)
                        return (
                          <button
                            key={m.id}
                            type="button"
                            aria-pressed={on}
                            onClick={() => toggle(m.id)}
                            className={cn(
                              "rounded-full border px-3.5 py-2 text-xs font-medium transition-colors duration-200",
                              on
                                ? "border-sidebar-primary bg-sidebar-primary text-sidebar-primary-foreground"
                                : "border-white/15 bg-white/[0.04] text-sidebar-foreground/80 hover:bg-white/10",
                            )}
                          >
                            {m.name}
                          </button>
                        )
                      })}
                    </div>

                    {/* Four rows' worth of height, always — so adding and
                        removing medicines never moves the buttons below. Only
                        the advisory is allowed to grow the box, and that is the
                        one moment where movement is the point. */}
                    <div className="mt-5 min-h-[11rem] space-y-2">
                      <AnimatePresence initial={false}>
                        {chosen.map((m) => (
                          <motion.div
                            key={m.id}
                            data-demo-anim
                            layout
                            initial={{ opacity: 0, y: -6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.2 }}
                            className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-sidebar/50 px-3.5 py-2.5"
                          >
                            <span className="truncate text-xs font-medium">{m.name}</span>
                            <span className="shrink-0 text-xs text-sidebar-foreground/55">
                              {m.dose}
                            </span>
                            <button
                              type="button"
                              onClick={() => toggle(m.id)}
                              aria-label={`Remove ${m.name}`}
                              className="shrink-0 rounded-md p-1 text-sidebar-foreground/40 transition-colors hover:text-sidebar-foreground"
                            >
                              <X className="size-3.5" />
                            </button>
                          </motion.div>
                        ))}
                      </AnimatePresence>

                      {chosen.length === 0 && (
                        <p className="pt-6 text-center text-xs text-sidebar-foreground/35">
                          Nothing prescribed yet.
                        </p>
                      )}
                    </div>

                    {/* The action row sits ABOVE the advisory, which is not
                        where the advisory naturally belongs — it belongs next to
                        the pad it is talking about. It is here because the
                        advisory is the one element that can appear mid-flow, and
                        measured at 390px it grows the stage by 139px. Put it
                        above these buttons and every one of those pixels shoves
                        "Sign & send" down the screen while a thumb is on its way
                        to it. Anchoring the primary action beats adjacency; the
                        advisory names the medicine, so it is not orphaned. */}
                    <div className="mt-5 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={send}
                        disabled={chosen.length === 0}
                        className={cn(
                          "inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold",
                          "transition-all duration-200",
                          chosen.length === 0
                            ? "cursor-not-allowed bg-white/8 text-sidebar-foreground/35"
                            : "bg-sidebar-primary text-sidebar-primary-foreground hover:brightness-110",
                        )}
                      >
                        <Send className="size-4" />
                        Sign &amp; send on WhatsApp
                      </button>
                      <button
                        type="button"
                        onClick={reset}
                        className="text-xs text-sidebar-foreground/45 underline-offset-4 transition-colors hover:text-sidebar-foreground hover:underline"
                      >
                        Start over
                      </button>
                    </div>

                    <AnimatePresence>
                      {clash && (
                        <motion.div
                          data-demo-anim
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.25 }}
                          className="overflow-hidden"
                        >
                          <div
                            role="status"
                            className="mt-5 flex gap-3 rounded-xl border border-warning/40 bg-warning/12 p-3.5"
                          >
                            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
                            <p className="text-xs leading-relaxed text-sidebar-foreground/85">
                              <strong className="font-semibold text-warning">
                                Interaction check:
                              </strong>{" "}
                              {clash.clashes} Matched on the active ingredient, so a brand name
                              would have tripped it too.{" "}
                              <span className="text-sidebar-foreground/60">
                                Advisory only — it never blocks you, and it never overrules you.
                              </span>
                            </p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Slide>
                )}

                {step === "sent" && (
                  <Slide key="sent">
                    <div className="flex min-h-[26rem] flex-col items-center justify-center text-center">
                      <span className="flex size-14 items-center justify-center rounded-2xl bg-success/20 text-success">
                        <CheckCheck className="size-7" />
                      </span>
                      <p className="mt-6 font-heading text-5xl font-extrabold tracking-[-0.04em] tabular-nums">
                        {seconds}
                        <span className="text-2xl text-sidebar-foreground/50">s</span>
                      </p>
                      <p className="mt-3 max-w-sm text-sm leading-relaxed text-sidebar-foreground/70">
                        That is the whole job. In the real thing it is the same three actions on
                        your own list — and the patient has the PDF before she is off the chair.
                      </p>

                      {/* The page's highest-intent moment, and until now the one
                          with nothing to press.
                          Between the hero and the pricing band there are more
                          than nine screens of scrolling, and this — the instant
                          someone has just worked the product and seen their own
                          number — is the best of them. Anywhere else a CTA is an
                          interruption; here it is the obvious next sentence, so
                          it is phrased as one rather than as a second "Start
                          free" competing with the hero's.
                          Deliberately NOT worded "create your clinic": the e2e
                          suite locates the closing CTA by that exact name, and a
                          second link matching it would make that locator
                          ambiguous and fail the run. */}
                      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
                        <Link
                          href="/signup"
                          className={cn(
                            buttonVariants({ size: "sm" }),
                            "btn-shine group/try gap-2 rounded-full bg-sidebar-primary px-5 text-sidebar-primary-foreground hover:bg-sidebar-primary/90",
                          )}
                        >
                          <span aria-hidden className="btn-shine-bar-ink" />
                          Set this up for your clinic
                          <ArrowRight className="size-3.5 transition-transform duration-300 group-hover/try:translate-x-0.5" />
                        </Link>
                        <button
                          type="button"
                          onClick={reset}
                          className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-xs font-medium text-sidebar-foreground/70 transition-colors hover:bg-white/8 hover:text-sidebar-foreground"
                        >
                          <RotateCcw className="size-3.5" />
                          Go again
                        </button>
                      </div>
                      <p className="mt-3 text-[0.7rem] text-sidebar-foreground/45">
                        Free for 14 days · no card required
                      </p>
                    </div>
                  </Slide>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* ── The patient's phone ─────────────────────────────────────── */}
          <Phone sent={step === "sent"} chosen={chosen} />
        </div>
      </div>
    </section>
  )
}

/** One step of the stage. Shared entrance so the steps feel like one surface. */
function Slide({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      data-demo-anim
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -12 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}

/**
 * The receiving end. It is deliberately present and empty from the first frame
 * rather than appearing on send: the point being made is that the patient's
 * side is already there, waiting, and nobody has to do anything to it.
 */
function Phone({ sent, chosen }: { sent: boolean; chosen: Medicine[] }) {
  return (
    <div className="mx-auto w-full max-w-[17rem] lg:mx-0">
      <div className="rounded-[2rem] border border-white/12 bg-sidebar/60 p-3 shadow-nm-float">
        <div className="rounded-[1.5rem] border border-white/8 bg-sidebar-accent/50 p-3">
          <div className="flex items-center gap-2 border-b border-white/8 pb-2.5">
            <span className="flex size-7 items-center justify-center rounded-full bg-success/25 text-[0.6rem] font-bold text-success">
              SC
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold">Sunrise Clinic</p>
              <p className="text-[0.6rem] text-sidebar-foreground/45">WhatsApp</p>
            </div>
          </div>

          <div className="min-h-[17rem] space-y-2 pt-3">
            <AnimatePresence initial={false}>
              {sent ? (
                <>
                  <Bubble key="rx" delay={0.05}>
                    <span className="flex items-center gap-1.5 font-medium text-primary">
                      <FileText className="size-3" />
                      Prescription.pdf
                    </span>
                    <span className="mt-1 block text-[0.6rem] text-muted-foreground">
                      Dr. Sharma · {chosen.length} medicine{chosen.length === 1 ? "" : "s"}
                    </span>
                  </Bubble>
                  <Bubble key="note" delay={0.45}>
                    Take as written. Reply here if anything worsens. Get well soon, Riya.
                  </Bubble>
                </>
              ) : (
                <motion.p
                  key="idle"
                  data-demo-anim
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="pt-16 text-center text-[0.7rem] leading-relaxed text-sidebar-foreground/30"
                >
                  Riya&apos;s phone.
                  <br />
                  Nothing installed, nothing to sign up for.
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  )
}

function Bubble({ children, delay }: { children: React.ReactNode; delay: number }) {
  return (
    <motion.div
      data-demo-anim
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 22, delay }}
      className="max-w-[92%] rounded-2xl rounded-tl-sm bg-card px-3 py-2 text-[0.7rem] leading-relaxed text-card-foreground"
    >
      {children}
    </motion.div>
  )
}

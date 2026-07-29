"use client"

import { useCallback, useEffect, useState } from "react"
import { formatInTimeZone } from "date-fns-tz"
import { Maximize2, Minimize2, MonitorOff, WifiOff } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { resolveLocale, translator } from "@/lib/i18n"
import { useNowSeconds } from "@/lib/use-now"
import { useWakeLock } from "@/lib/use-wake-lock"
import { IST_TZ } from "@/lib/format"
import { TONE } from "@/lib/status"
import { cn } from "@/lib/utils"

export type QueueSnapshot = {
  found: boolean
  clinic: {
    name: string
    doctor_name: string
    specialty: string | null
    logo_path: string | null
    lang: string | null
  }
  in_consult: { token: number }[]
  waiting: { token: number }[]
  completed_count: number
  /** Average minutes between consultation starts today; null until it means something. */
  pace_minutes: number | null
  as_of: string
}

const REFRESH_MS = 20_000
/** How many upcoming tokens the board shows before it stops naming them. */
const NEXT_SHOWN = 6

/**
 * The waiting-room board.
 *
 * Deliberately shows **token numbers only** — no names, no phone numbers, no
 * reason for visit. This screen hangs in a room full of strangers, so a token
 * is all it needs to do its job; anything more is a disclosure nobody agreed
 * to. Type is oversized because it is read from across a room, not held.
 */
export function DisplayBoard({
  slug,
  initial,
  logoUrl,
}: {
  slug: string
  initial: QueueSnapshot
  logoUrl: string | null
}) {
  const [snap, setSnap] = useState(initial)
  const [stale, setStale] = useState(false)

  const wakeLock = useWakeLock()
  const nowSeconds = useNowSeconds()

  const poll = useCallback(async () => {
    const supabase = createClient()
    const { data, error } = await supabase.rpc("get_display_queue", { p_slug: slug })
    if (error || !data) {
      // Keep the last good queue on screen and say so, rather than blanking
      // the board — a wall screen with nothing on it looks broken.
      setStale(true)
      return
    }
    setSnap(data as unknown as QueueSnapshot)
    setStale(false)
  }, [slug])

  useEffect(() => {
    const id = setInterval(poll, REFRESH_MS)

    // A tablet that was asleep, or a tab that was in the background, comes
    // back holding a queue from whenever it went away. Twenty seconds of a
    // stale board is twenty seconds of the wrong token in a full room, so the
    // board re-reads the instant it becomes visible again instead of waiting
    // for its turn in the interval.
    function onWake() {
      if (document.visibilityState === "visible") void poll()
    }
    document.addEventListener("visibilitychange", onWake)
    window.addEventListener("online", onWake)

    return () => {
      clearInterval(id)
      document.removeEventListener("visibilitychange", onWake)
      window.removeEventListener("online", onWake)
    }
  }, [poll])

  // The board speaks the clinic's chosen language — the same setting that
  // decides which WhatsApp templates its patients receive.
  const t = translator(resolveLocale(snap.clinic.lang))
  const now = snap.in_consult[0]?.token ?? null
  const next = snap.waiting.slice(0, NEXT_SHOWN)
  const pace = snap.pace_minutes

  return (
    // The one surface that is dark by default. It hangs on a wall in a lit
    // waiting room, often for hours: dark cuts glare, stops the panel burning,
    // and lets the serving token glow instead of merely being large.
    // `.dark` (not `nm-dark-surface`) because this is genuinely the dark theme
    // — the class sets the lamp variables, so every depth utility below
    // inverts correctly with no overrides.
    <main className="dark group/board flex min-h-screen flex-col bg-background text-foreground">
      <div className="animate-board-drift flex min-h-screen flex-col p-5 sm:p-8 xl:p-10">
        <Header
          clinic={snap.clinic}
          logoUrl={logoUrl}
          nowSeconds={nowSeconds}
          stale={stale}
          asOf={snap.as_of}
          updatedLabel={t("display.updated")}
          reconnectingLabel={t("display.reconnecting")}
        />

        <div className="grid flex-1 gap-6 lg:grid-cols-[1.15fr_1fr] xl:gap-10">
          {/* ── Now serving ────────────────────────────────────────────── */}
          <section className="flex min-h-0 flex-col">
            <SectionTitle>{t("display.inConsult")}</SectionTitle>
            <div
              className={cn(
                "relative flex flex-1 items-center justify-center overflow-hidden rounded-3xl border",
                now != null
                  ? "border-primary/35 bg-card shadow-nm-float"
                  : "border-dashed border-edge/30 bg-background/50 shadow-nm-inset",
              )}
            >
              {/* Indigo bloom behind the serving token — the one thing every
                  person in the room is looking for, so it is the one thing on
                  the board that emits light rather than just reflecting it. */}
              {now != null && (
                <div
                  aria-hidden
                  className="glow-primary animate-glow-drift pointer-events-none absolute inset-0 blur-2xl"
                />
              )}
              {/* Keyed on the token itself: a new number is a new element, so
                  the arrival animation replays on every change and never on a
                  poll that returned the same queue. No "did it change?" state
                  to keep in sync, and no reflow forced to restart a CSS
                  animation. */}
              {now != null && (
                <span
                  key={`halo-${now}`}
                  aria-hidden
                  className="animate-token-halo pointer-events-none absolute inset-8 rounded-full border-2 border-primary/50"
                />
              )}
              {now != null ? (
                <span
                  key={now}
                  role="status"
                  aria-live="polite"
                  className={cn(
                    "animate-token-arrive relative font-heading font-extrabold tabular-nums tracking-[-0.045em] text-primary",
                    // Fluid rather than stepped: this board runs on a 55"
                    // reception TV and on a 10" tablet, and a breakpoint scale
                    // picked for one is illegible or clipped on the other.
                    // Capped against the *height* too, since the tile is a
                    // fraction of the viewport, not the whole of it.
                    "text-[clamp(6rem,min(26vw,42vh),22rem)] leading-none",
                  )}
                >
                  {now}
                </span>
              ) : (
                <span className="text-[clamp(1.1rem,3vw,2rem)] text-muted-foreground">
                  {t("display.pleaseWait")}
                </span>
              )}
            </div>
          </section>

          {/* ── Next in line ───────────────────────────────────────────── */}
          <section className="flex min-h-0 flex-col">
            <SectionTitle>{t("display.nextInLine")}</SectionTitle>
            {next.length === 0 ? (
              <div className="flex flex-1 items-center justify-center rounded-3xl border border-dashed border-edge/30 bg-background/50 shadow-nm-inset">
                <span className="text-[clamp(1.1rem,3vw,2rem)] text-muted-foreground">
                  {t("display.noneWaiting")}
                </span>
              </div>
            ) : (
              // Columns follow the queue length instead of being fixed at
              // three. A three-column grid holding four tokens leaves two
              // dead cells and shrinks every tile to fit a row that is half
              // empty; two columns fills the same space with numbers twice
              // the size, which is the entire point of the board.
              <ul
                className={cn(
                  "grid flex-1 auto-rows-fr gap-3 xl:gap-4",
                  next.length <= 2 ? "grid-cols-1" : next.length <= 4 ? "grid-cols-2" : "grid-cols-3",
                )}
              >
                {next.map((w, i) => (
                  // Up-next is raised out of the queue; the rest sit recessed —
                  // the same "who's active" language the Today queue uses.
                  <li
                    key={w.token}
                    className={cn(
                      "flex flex-col items-center justify-center gap-1 rounded-2xl border p-2",
                      i === 0
                        ? "border-primary/35 bg-card text-primary shadow-nm-raised"
                        : "border-edge/20 bg-background/50 text-foreground shadow-nm-inset",
                    )}
                  >
                    <span className="font-heading text-[clamp(2rem,7vw,4.5rem)] font-extrabold leading-none tabular-nums tracking-[-0.03em]">
                      {w.token}
                    </span>
                    {/* Position × today's pace. Shown per token rather than as
                        one figure for the queue, because "how long for *me*"
                        is the actual question and a single number only
                        answers it for whoever is last. Absent entirely when
                        the day has too little history to be honest about it. */}
                    {pace != null && (
                      <span className="text-[clamp(0.6rem,1.2vw,0.9rem)] text-muted-foreground">
                        {waitLabel(t, (i + 1) * pace)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <Footer
          waiting={snap.waiting.length}
          completed={snap.completed_count}
          pace={pace}
          t={t}
        />
      </div>

      <Controls wakeLock={wakeLock} />
    </main>
  )
}

/** "about 25 min", or a softer phrase once the wait rounds to nothing. */
function waitLabel(t: (key: string, vars?: Record<string, string | number>) => string, minutes: number) {
  if (minutes < 2) return t("display.underAMinute")
  // Rounded to five, because the estimate is not accurate to the minute and
  // printing "about 23 min" claims a precision the data does not have.
  return t("display.aboutMinutes", { n: Math.round(minutes / 5) * 5 })
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 text-[clamp(0.7rem,1.3vw,1rem)] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
      {children}
    </h2>
  )
}

function Header({
  clinic,
  logoUrl,
  nowSeconds,
  stale,
  asOf,
  updatedLabel,
  reconnectingLabel,
}: {
  clinic: QueueSnapshot["clinic"]
  logoUrl: string | null
  nowSeconds: number
  stale: boolean
  asOf: string
  updatedLabel: string
  reconnectingLabel: string
}) {
  // `0` is the server snapshot — the clock renders as furniture until the
  // client takes over, rather than painting a server time that is wrong by
  // however long the response spent in flight.
  const hydrated = nowSeconds > 0
  const instant = new Date(nowSeconds * 1000)
  const clock = hydrated ? formatInTimeZone(instant, IST_TZ, "HH:mm") : "--:--"
  const dateLine = hydrated ? formatInTimeZone(instant, IST_TZ, "EEEE, d MMMM") : ""

  return (
    <header className="mb-6 flex items-center gap-4 border-b border-edge/25 pb-5 xl:mb-8">
      {logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt=""
          className="size-12 shrink-0 rounded-xl object-cover shadow-nm-raised xl:size-16"
        />
      )}
      <div className="min-w-0">
        <h1 className="truncate font-heading text-[clamp(1.4rem,3.4vw,3rem)] font-extrabold leading-tight tracking-[-0.035em]">
          {clinic.name}
        </h1>
        <p className="truncate text-[clamp(0.8rem,1.6vw,1.4rem)] text-muted-foreground">
          {clinic.doctor_name}
          {clinic.specialty ? ` · ${clinic.specialty}` : ""}
        </p>
      </div>

      {/* A waiting room asks the time more often than it asks anything else,
          and the board is already the thing everyone is facing. It costs one
          line here and saves every patient reaching for a phone. */}
      <div className="ml-auto shrink-0 text-right">
        <p className="font-heading text-[clamp(1.6rem,4vw,3.6rem)] font-extrabold leading-none tabular-nums tracking-[-0.04em]">
          {clock}
        </p>
        <p className="mt-1 text-[clamp(0.65rem,1.1vw,1rem)] text-muted-foreground">
          {stale ? (
            <span className={cn("inline-flex items-center gap-1.5", TONE.warning.text)}>
              <WifiOff className="size-3.5" /> {reconnectingLabel}
            </span>
          ) : (
            (dateLine || `${updatedLabel} ${asOf}`)
          )}
        </p>
      </div>
    </header>
  )
}

function Footer({
  waiting,
  completed,
  pace,
  t,
}: {
  waiting: number
  completed: number
  pace: number | null
  t: (key: string, vars?: Record<string, string | number>) => string
}) {
  return (
    <footer className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-edge/25 pt-4 text-[clamp(0.75rem,1.4vw,1.15rem)] text-muted-foreground xl:mt-8">
      <span>
        <span className="font-semibold text-foreground tabular-nums">{waiting}</span>{" "}
        {t("display.waiting")}
      </span>
      <span>
        <span className="font-semibold text-foreground tabular-nums">{completed}</span>{" "}
        {t("display.seenToday")}
      </span>
      {/* The clinic's pace, not a wait — each tile above already carries the
          wait for *its* token, and repeating a single number down here read
          as a fourth, contradictory estimate. */}
      {pace != null && <span>{t("display.perPatient", { n: pace })}</span>}
      <span className="ml-auto hidden sm:inline">{t("display.calledInOrder")}</span>
    </footer>
  )
}

/**
 * Screen controls, parked in a corner and invisible until someone reaches for
 * them.
 *
 * Everything here is a one-time setup gesture the receptionist performs when
 * they mount the tablet, not a control anyone uses again — so it must not be
 * part of what a waiting room looks at all day. It fades in on hover or
 * keyboard focus and is otherwise transparent.
 */
function Controls({ wakeLock }: { wakeLock: "unsupported" | "held" | "released" }) {
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    function sync() {
      setIsFullscreen(document.fullscreenElement != null)
    }
    document.addEventListener("fullscreenchange", sync)
    return () => document.removeEventListener("fullscreenchange", sync)
  }, [])

  async function toggle() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await document.documentElement.requestFullscreen()
    } catch {
      // Denied or unsupported (iOS Safari has never allowed it). Nothing to
      // recover: the board is already usable in a normal tab.
    }
  }

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 flex items-center gap-2 opacity-0 transition-opacity duration-300 focus-within:opacity-100 group-hover/board:opacity-100">
      {wakeLock === "released" && (
        <span
          className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-edge/30 bg-card/80 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur"
          title="This screen may dim on its own. Set the device's own sleep timer to Never."
        >
          <MonitorOff className="size-3.5" /> Screen may sleep
        </span>
      )}
      <button
        type="button"
        onClick={toggle}
        aria-label={isFullscreen ? "Exit full screen" : "Full screen"}
        className="pointer-events-auto flex size-10 items-center justify-center rounded-full border border-edge/30 bg-card/80 text-muted-foreground shadow-nm-raised backdrop-blur transition-colors hover:text-foreground"
      >
        {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
      </button>
    </div>
  )
}

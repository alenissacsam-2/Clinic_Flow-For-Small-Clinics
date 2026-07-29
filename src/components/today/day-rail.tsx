import { formatInTimeZone } from "date-fns-tz"

import { IST_TZ } from "@/lib/format"
import { APPOINTMENT_STATUS } from "@/lib/status"
import { cn } from "@/lib/utils"
import type { QueueRow } from "./queue-list"

/**
 * The whole day as one strip: every appointment placed on a real time axis,
 * coloured by status, with a needle at "now".
 *
 * ── What a list cannot show ───────────────────────────────────────────────
 * A queue list is ordered but not *scaled* — nine rows look the same whether
 * they run 09:00–11:00 or 09:00–19:00. The two facts a doctor actually plans
 * around are both about spacing: where the day is crowded, and where the gaps
 * are. Putting the same rows on a proportional axis surfaces both for free,
 * and the needle answers "how far in am I" without any arithmetic.
 *
 * ── Why "now" arrives as a prop ───────────────────────────────────────────
 * Reading the clock inside a component body is impure — the React Compiler
 * lints it, and rightly: the same props would render differently on every
 * re-render. "Now" is request-scoped data, so it is resolved once by the page
 * and passed down, which also leaves this component a pure function of its
 * inputs.
 *
 * Server-rendered rather than ticking on a timer: the value is accurate at
 * page load and re-derived on every `router.refresh()` — which is exactly what
 * the queue actions already trigger — so the needle moves whenever the day
 * actually changes. A client ticker would buy sub-minute precision on an axis
 * whose smallest readable unit is about fifteen minutes. (`Elapsed`, in the
 * focus card, *is* live — there the number itself is the reading.)
 */
export function DayRail({ rows, nowMs }: { rows: QueueRow[]; nowMs: number }) {
  if (rows.length < 2) return null

  const times = rows.map((r) => new Date(r.starts_at).getTime())
  const now = nowMs

  // Pad the axis by half an hour on each side so the first and last blocks
  // are not welded to the ends, and stretch it to include "now" — otherwise
  // the needle clamps to an edge and reads as a bug on a day that has not
  // started yet or finished hours ago.
  const HALF_HOUR = 30 * 60_000
  const from = Math.min(...times, now) - HALF_HOUR
  const to = Math.max(...times, now) + HALF_HOUR
  const span = to - from

  const pct = (t: number) => ((t - from) / span) * 100

  // Hour gridlines, on the hour, in IST.
  const ticks: { at: number; label: string }[] = []
  const first = new Date(from)
  first.setUTCMinutes(0, 0, 0)
  for (let t = first.getTime(); t <= to; t += 3600_000) {
    if (t < from) continue
    ticks.push({ at: t, label: formatInTimeZone(new Date(t), IST_TZ, "h a").replace(" ", "") })
  }

  const seen = rows.filter((r) => r.status === "completed").length

  return (
    <section
      aria-label="Today at a glance"
      className="mb-6 rounded-2xl border border-edge/20 bg-card p-5 shadow-nm-raised"
    >
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="font-heading text-sm font-semibold">The day so far</h2>
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold tabular-nums text-foreground">{seen}</span> of{" "}
          <span className="tabular-nums">{rows.length}</span> seen ·{" "}
          {formatInTimeZone(new Date(Math.min(...times)), IST_TZ, "h:mm a")} –{" "}
          {formatInTimeZone(new Date(Math.max(...times)), IST_TZ, "h:mm a")}
        </p>
      </div>

      {/* The track is recessed: it is a channel that holds things, which is
          the same rule the progress grooves in Reports follow. */}
      <div className="relative h-12 rounded-lg border border-edge/15 bg-background/60 shadow-nm-inset">
        {ticks.map((t) => (
          <span
            key={t.at}
            aria-hidden
            style={{ left: `${pct(t.at)}%` }}
            className="absolute inset-y-1 w-px bg-edge/20"
          />
        ))}

        {rows.map((r) => {
          const s = APPOINTMENT_STATUS[r.status]
          const active = r.status === "in_progress"
          return (
            <span
              key={r.id}
              title={`${formatInTimeZone(r.starts_at, IST_TZ, "h:mm a")} · ${r.patient?.full_name ?? "Unknown"} · ${s.label}`}
              style={{ left: `${pct(new Date(r.starts_at).getTime())}%` }}
              className={cn(
                "absolute top-1/2 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full transition-[height]",
                s.rail ?? "bg-border",
                // The in-consultation block is taller and lifted, so the one
                // thing happening right now is findable at a glance — the same
                // raised-equals-active rule as the queue rows.
                active ? "h-9 shadow-nm-raised ring-2 ring-primary/30" : "h-6",
                r.status === "completed" && "opacity-45",
              )}
            />
          )
        })}

        {/* Now. Drawn last so it sits over every block it crosses. */}
        <span
          aria-hidden
          style={{ left: `${pct(now)}%` }}
          className="absolute inset-y-0 w-px -translate-x-1/2 bg-foreground/70"
        >
          <span className="absolute -top-1 left-1/2 size-2 -translate-x-1/2 rounded-full bg-foreground/70" />
        </span>
      </div>

      {/* Labels are absolutely positioned against the same axis as the ticks,
          not laid out in flow — a flex row would space them evenly and
          silently disagree with the gridlines they belong to. */}
      <div className="relative mt-1.5 h-4">
        {ticks.map((t) => (
          <span
            key={t.at}
            style={{ left: `${pct(t.at)}%` }}
            className="absolute -translate-x-1/2 text-[0.625rem] tabular-nums whitespace-nowrap text-muted-foreground"
          >
            {t.label}
          </span>
        ))}
      </div>

      {/* Without this the rail is four shades of nothing. A colour code that
          has to be inferred is decoration; one with a key is a reading. */}
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-edge/15 pt-3 text-[0.6875rem] text-muted-foreground">
        {LEGEND.map(({ label, rail, faded }) => (
          <li key={label} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className={cn("h-3 w-1 rounded-full", rail, faded && "opacity-45")}
            />
            {label}
          </li>
        ))}
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="h-3 w-px bg-foreground/70" />
          now
        </li>
      </ul>
    </section>
  )
}

/**
 * Spelled out rather than derived from `APPOINTMENT_STATUS`, because the rail
 * groups statuses the map keeps separate: `arrived` and `in_progress` are one
 * idea here ("here now"), and `no_show` never earns a key of its own.
 */
const LEGEND = [
  { label: "seen", rail: APPOINTMENT_STATUS.completed.rail, faded: true },
  { label: "in consultation", rail: APPOINTMENT_STATUS.in_progress.rail, faded: false },
  { label: "waiting", rail: APPOINTMENT_STATUS.arrived.rail, faded: false },
  { label: "booked", rail: APPOINTMENT_STATUS.confirmed.rail, faded: false },
] as const

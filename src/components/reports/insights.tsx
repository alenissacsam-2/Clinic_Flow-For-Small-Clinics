import { formatINR } from "@/lib/format"
import { cn } from "@/lib/utils"

/**
 * The three read-outs that turn "how much did I make" into "what should I do
 * differently": where the money comes from, when patients actually turn up,
 * and which days carry the week.
 *
 * All three are plain SVG and CSS, server-rendered. Reports already ships
 * recharts for the time series; a donut and two bar rows do not justify
 * putting more chart JS on a low-end Android phone, and being server-rendered
 * they are in the HTML for anyone reading with JS off or printing the page.
 */

/** A stable colour per payment mode, from the chart ramp. Keyed by mode rather
 *  than by rank so a mode doesn't change colour when the amounts reorder — and
 *  spelled out in full because Tailwind only generates classes it can find as
 *  literals in the source. */
const MODE_COLOR: Record<string, { bar: string; stroke: string }> = {
  upi: { bar: "bg-chart-1", stroke: "var(--chart-1)" },
  card: { bar: "bg-chart-2", stroke: "var(--chart-2)" },
  cash: { bar: "bg-chart-4", stroke: "var(--chart-4)" },
  other: { bar: "bg-chart-5", stroke: "var(--chart-5)" },
}
const FALLBACK = { bar: "bg-chart-3", stroke: "var(--chart-3)" }

export function Panel({
  title,
  hint,
  children,
  className,
}: {
  title: string
  hint?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={cn("rounded-2xl border border-edge/20 bg-card p-5 shadow-nm-raised", className)}
    >
      <div className="mb-4">
        <h2 className="font-heading text-sm font-semibold">{title}</h2>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </section>
  )
}

/* ═══ Where the money comes from ═══════════════════════════════════════════ */

const R = 34
const C = 2 * Math.PI * R

export function PaymentMix({ modes }: { modes: [string, number][] }) {
  const total = modes.reduce((s, [, v]) => s + v, 0)
  if (!total) return <Empty>No payments recorded in this period.</Empty>

  // Each arc's start is the sum of every arc before it. Written as a prefix
  // sum rather than a running accumulator because the React Compiler treats a
  // variable reassigned inside a render-time `map` as unstable state — and it
  // is right to: with at most four payment modes the quadratic cost here is
  // literally six additions.
  const arcs = modes.map(([mode, amount], i) => ({
    mode,
    amount,
    len: (amount / total) * C,
    offset: modes.slice(0, i).reduce((s, [, v]) => s + (v / total) * C, 0),
    color: MODE_COLOR[mode] ?? FALLBACK,
  }))

  return (
    <div className="flex flex-wrap items-center gap-6">
      <svg viewBox="0 0 80 80" className="size-28 shrink-0 -rotate-90" role="img" aria-label="Payment mode split">
        <circle
          cx="40"
          cy="40"
          r={R}
          fill="none"
          stroke="color-mix(in oklab, var(--nm-edge) 20%, transparent)"
          strokeWidth="11"
        />
        {arcs.map((a) => (
          <circle
            key={a.mode}
            cx="40"
            cy="40"
            r={R}
            fill="none"
            stroke={a.color.stroke}
            strokeWidth="11"
            // Draw `len` of the circumference and hide the rest, then rotate
            // the start point by everything already drawn. A negative offset
            // advances clockwise, which is why it is negated.
            strokeDasharray={`${a.len} ${C - a.len}`}
            strokeDashoffset={-a.offset}
          />
        ))}
      </svg>

      <ul className="min-w-40 flex-1 space-y-2">
        {arcs.map((a) => (
          <li key={a.mode} className="flex items-center gap-2 text-sm">
            <span aria-hidden className={cn("size-2.5 shrink-0 rounded-sm", a.color.bar)} />
            {/* `capitalize` would render the acronym as "Upi". */}
            <span className={cn(a.mode !== "upi" && "capitalize")}>
              {a.mode === "upi" ? "UPI" : a.mode}
            </span>
            <span className="ml-auto font-medium tabular-nums">{formatINR(a.amount)}</span>
            <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
              {Math.round((a.amount / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ═══ When patients actually arrive ════════════════════════════════════════ */

export function HourHistogram({ hours }: { hours: { hour: number; count: number }[] }) {
  const live = hours.filter((h) => h.count > 0)
  if (!live.length) return <Empty>No appointments in this period.</Empty>

  const max = Math.max(...hours.map((h) => h.count))
  const busiest = live.reduce((a, b) => (b.count > a.count ? b : a))

  return (
    <>
      {/* Each column is `h-full` and pushes its bar to the bottom. The obvious
          spelling — a percentage height on a bar inside an auto-height column
          — silently collapses to zero, because a percentage height resolves
          against the parent's *computed* height and `auto` gives it nothing to
          resolve against. The whole row stays one fixed height regardless of
          the tallest bar, so the panel does not resize as the period changes. */}
      <div className="flex h-28 items-stretch gap-1">
        {hours.map((h) => (
          <div key={h.hour} className="flex h-full flex-1 flex-col justify-end">
            <div
              style={{ height: `${Math.max(2, (h.count / max) * 100)}%` }}
              title={`${label12(h.hour)} · ${h.count} appointment${h.count === 1 ? "" : "s"}`}
              className={cn(
                "w-full rounded-sm",
                h.count === 0
                  ? "bg-edge/15"
                  : h.hour === busiest.hour
                    ? "bg-chart-1"
                    : "bg-chart-1/40",
              )}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1 text-[0.625rem] tabular-nums text-muted-foreground">
        {hours.map((h) => (
          <span key={h.hour} className="flex-1 text-center">
            {/* Only every third hour gets a label — at 12 columns on a phone
                every label would overlap its neighbour into mush. */}
            {h.hour % 3 === 0 ? label12(h.hour) : ""}
          </span>
        ))}
      </div>
      <p className="mt-3 border-t border-edge/15 pt-3 text-xs text-muted-foreground">
        Busiest hour is{" "}
        <span className="font-semibold text-foreground">{label12(busiest.hour)}</span> —{" "}
        {busiest.count} of {live.reduce((s, h) => s + h.count, 0)} appointments started then.
      </p>
    </>
  )
}

function label12(h: number) {
  const suffix = h < 12 ? "am" : "pm"
  const hour = h % 12 === 0 ? 12 : h % 12
  return `${hour}${suffix}`
}

/* ═══ Which days carry the week ════════════════════════════════════════════ */

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

export function WeekdayBars({ totals }: { totals: number[] }) {
  const max = Math.max(...totals)
  if (!max) return <Empty>No payments recorded in this period.</Empty>

  return (
    <ul className="space-y-2.5">
      {totals.map((amount, i) => (
        <li key={DAYS[i]} className="flex items-center gap-3 text-sm">
          <span className="w-8 shrink-0 text-xs text-muted-foreground">{DAYS[i]}</span>
          {/* Groove + fill: the track is recessed because it's a channel, the
              bar is what sits in it. */}
          <span className="h-2.5 flex-1 overflow-hidden rounded-full border border-edge/15 bg-background/60 shadow-nm-inset">
            <span
              style={{ width: `${(amount / max) * 100}%` }}
              className={cn(
                "block h-full rounded-full",
                amount === max ? "bg-chart-1" : "bg-chart-1/45",
              )}
            />
          </span>
          <span className="w-20 shrink-0 text-right text-xs font-medium tabular-nums">
            {formatINR(amount)}
          </span>
        </li>
      ))}
    </ul>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{children}</p>
}

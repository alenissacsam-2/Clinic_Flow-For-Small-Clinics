import type { LucideIcon } from "lucide-react"
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * The KPI tile used across Today, Reports and the operator overview.
 *
 * Static by design — these are read-outs, not controls, so no hover-lift.
 *
 * ── Why a number alone was not enough ─────────────────────────────────────
 * "Revenue today: ₹2,600" is a fact with no meaning attached. Good or bad
 * depends entirely on what a Tuesday normally looks like in this clinic, and
 * the doctor is the only one who knows — which means the tile was making them
 * do the comparison in their head, every morning, from memory. `delta` and
 * `spark` move that work onto the page: the chip says how today compares, the
 * sparkline says whether that comparison is a blip or a trend.
 *
 * Both are optional and both must be **computed from real rows**. A KPI tile is
 * the easiest place in a product to start quietly inventing numbers, and this
 * one is looked at by someone deciding whether their practice is working.
 */

export type Delta = {
  /** Signed percentage change. `null` when there is no baseline to compare to. */
  pct: number | null
  /** What the comparison is against — printed, never implied. e.g. "vs last Tue". */
  label: string
  /** Set when *down* is the good direction (outstanding dues, no-shows). */
  inverted?: boolean
}

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  tone = "default",
  delta,
  spark,
}: {
  label: string
  value: string
  icon?: LucideIcon
  hint?: string
  tone?: "default" | "destructive"
  delta?: Delta
  /** Recent history, oldest first. Drawn as a sparkline; needs 2+ points. */
  spark?: number[]
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-edge/20 bg-card p-5 shadow-nm-raised">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {label}
        </p>
        {Icon && (
          // Pressed into the tile, against the tile's own extrusion.
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-background/70 text-primary shadow-nm-inset">
            <Icon className="size-4" />
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <p
          className={cn(
            "font-heading text-2xl font-bold tabular-nums tracking-[-0.03em]",
            tone === "destructive" && "text-destructive",
          )}
        >
          {value}
        </p>
        {delta && <DeltaChip {...delta} />}
      </div>

      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}

      {spark && spark.length > 1 && <Spark points={spark} />}
    </div>
  )
}

function DeltaChip({ pct, label, inverted }: Delta) {
  // No baseline is a real state — a clinic in its first week has nothing to
  // compare against — and saying so is better than printing a confident 0%.
  if (pct === null) {
    return <span className="text-[0.7rem] text-muted-foreground">no baseline yet</span>
  }

  const rounded = Math.round(pct)
  const flat = rounded === 0
  const good = inverted ? rounded < 0 : rounded > 0
  const Icon = flat ? ArrowRight : rounded > 0 ? ArrowUpRight : ArrowDownRight

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[0.7rem] font-semibold tabular-nums",
        flat
          ? "bg-muted text-muted-foreground"
          : good
            ? "bg-success/12 text-success"
            : "bg-destructive/12 text-destructive",
      )}
      // The arrow, not just the colour, carries the direction — the same rule
      // the status rails follow, for the same red/green-blind readers.
      title={`${rounded > 0 ? "+" : ""}${rounded}% ${label}`}
    >
      <Icon className="size-3" aria-hidden />
      {flat ? "level" : `${Math.abs(rounded)}%`}
      <span className="ml-0.5 font-normal opacity-70">{label}</span>
    </span>
  )
}

/**
 * A sparkline as one inline SVG path — no chart library, no client component,
 * no layout shift. Reports already pays for recharts; a 24×64 trend line in a
 * KPI tile should not.
 *
 * `preserveAspectRatio="none"` lets the fixed 100×28 viewBox stretch to
 * whatever width the tile ends up, so the drawing code never needs to know the
 * real pixel size. The stroke is `vector-effect: non-scaling-stroke` for the
 * same reason — without it the horizontal stretch would thin the line.
 */
function Spark({ points }: { points: number[] }) {
  const max = Math.max(...points)
  const min = Math.min(...points)
  // A perfectly flat series has zero range; dividing by it yields NaN and the
  // path silently disappears. Flat data draws as a flat line down the middle.
  const range = max - min || 1
  const step = 100 / (points.length - 1)
  const d = points
    .map((v, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(2)},${(26 - ((v - min) / range) * 24).toFixed(2)}`)
    .join(" ")

  return (
    <svg
      viewBox="0 0 100 28"
      preserveAspectRatio="none"
      aria-hidden
      className="mt-3 h-7 w-full overflow-visible"
    >
      <path
        d={`${d} L100,28 L0,28 Z`}
        fill="color-mix(in oklab, var(--chart-1) 12%, transparent)"
        stroke="none"
      />
      <path
        d={d}
        fill="none"
        stroke="var(--chart-1)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

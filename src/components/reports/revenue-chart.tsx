"use client"

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

export type DailyPoint = { label: string; amount: number }

type Row = DailyPoint & { avg: number | null }

/**
 * Daily takings as a filled area, with a 7-day moving average over the top.
 *
 * ── Why the average line is the point ─────────────────────────────────────
 * This used to be a bare bar chart, and a bar chart of one clinic's daily
 * revenue is close to unreadable: a solo practice swings from ₹0 on a closed
 * Sunday to ₹6,000 on a busy Saturday, so the eye sees noise and the one
 * question the doctor actually has — *is this getting better?* — goes
 * unanswered. The rolling mean answers it directly, and keeping the daily
 * series behind it means nothing is hidden: you can still see the individual
 * day that was unusual, it just no longer dominates.
 *
 * Seven days specifically, because the dominant cycle in a clinic is the week.
 * A shorter window still wobbles with the weekend; a longer one lags a real
 * change by too much to notice it.
 *
 * The line is `--chart-4` (clay) against the area's `--chart-1` (indigo) —
 * the two ends of the palette ramp, so they stay distinguishable in both
 * themes and for a red/green-blind reader, and neither is the destructive red.
 */
const WINDOW = 7

export function RevenueChart({
  data,
  kind = "currency",
  seriesLabel,
}: {
  data: DailyPoint[]
  kind?: "currency" | "count"
  seriesLabel?: string
}) {
  const label = seriesLabel ?? (kind === "count" ? "Count" : "Revenue")

  // Below two windows of data the "average" would be mostly made of its own
  // ramp-up and would mislead more than it explains, so it simply isn't drawn.
  const showAvg = data.length >= WINDOW * 2
  const rows: Row[] = data.map((d, i) => {
    if (!showAvg || i < WINDOW - 1) return { ...d, avg: null }
    let sum = 0
    for (let j = i - WINDOW + 1; j <= i; j++) sum += data[j].amount
    return { ...d, avg: Math.round(sum / WINDOW) }
  })

  // Indian digit grouping on the axis, and compact above ten thousand — a
  // ₹1,25,000 tick label is wider than the axis gutter it has to fit in.
  const money = (v: number) =>
    v >= 10000 ? `₹${(v / 1000).toFixed(0)}k` : `₹${v.toLocaleString("en-IN")}`
  const yFmt = (v: number) => (kind === "count" ? `${v}` : money(v))
  const tipFmt = (v: number | string) =>
    kind === "count"
      ? `${Number(v ?? 0)}`
      : `₹${Number(v ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="cf-rev-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.42} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
            </linearGradient>
          </defs>

          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="color-mix(in oklab, var(--nm-edge) 30%, transparent)"
          />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            interval="preserveStartEnd"
            minTickGap={24}
            tickLine={false}
            stroke="var(--nm-edge)"
          />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            width={52}
            allowDecimals={kind === "count" ? false : true}
            tickFormatter={yFmt}
            tickLine={false}
            axisLine={false}
            stroke="var(--nm-edge)"
          />
          <Tooltip
            formatter={(v, name) => [tipFmt(v as number), name === "avg" ? "7-day average" : label]}
            cursor={{ stroke: "var(--nm-edge)", strokeDasharray: "3 3" }}
            labelStyle={{ fontSize: 12, color: "var(--popover-foreground)" }}
            contentStyle={{
              fontSize: 12,
              borderRadius: 12,
              background: "var(--popover)",
              border: "1px solid color-mix(in oklab, var(--nm-edge) 40%, transparent)",
              boxShadow: "var(--nm-d-lg) var(--nm-d-lg) var(--nm-b-lg) var(--nm-lo)",
            }}
          />

          {/* --chart-1, not --primary: the chart ramp is the source of truth
              for data colour, so a palette change moves charts with it. */}
          <Area
            dataKey="amount"
            name={label}
            stroke="var(--chart-1)"
            strokeWidth={1.75}
            fill="url(#cf-rev-fill)"
            // A clinic's series is a real jagged thing — monotone smoothing
            // would round a ₹0 closed Sunday into a gentle dip and quietly
            // misreport a day the practice was shut.
            type="linear"
            dot={false}
            activeDot={{ r: 3.5, strokeWidth: 0 }}
          />
          {showAvg && (
            <Line
              dataKey="avg"
              name="avg"
              stroke="var(--chart-4)"
              strokeWidth={2}
              strokeDasharray="5 3"
              dot={false}
              // Leading nulls during the ramp-up would otherwise be drawn as a
              // line to zero.
              connectNulls={false}
              isAnimationActive={false}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

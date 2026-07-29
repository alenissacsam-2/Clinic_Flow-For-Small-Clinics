import Link from "next/link"
import { formatInTimeZone } from "date-fns-tz"
import {
  AlertCircle,
  Banknote,
  Download,
  Stethoscope,
  TrendingUp,
  Wallet,
} from "lucide-react"

import { createClient } from "@/lib/supabase/server"
import { requireClinic } from "@/lib/clinic"
import { formatINR, istDateKey, IST_TZ } from "@/lib/format"
import { cn } from "@/lib/utils"
import { PageHeader } from "@/components/page-header"
import { StatCard, type Delta } from "@/components/stat-card"
import { buttonVariants } from "@/components/ui/button"
import { RevenueChart, type DailyPoint } from "@/components/reports/revenue-chart"
import { HourHistogram, Panel, PaymentMix, WeekdayBars } from "@/components/reports/insights"

/**
 * The practice's report card.
 *
 * ── The shape of this page is an argument ─────────────────────────────────
 * It used to be four totals and a bar chart, which tells a doctor what
 * happened and nothing about what to do. Every block here answers a question
 * someone running a one-person clinic actually asks out loud:
 *
 *   "Am I doing better than last month?"  → every KPI carries a delta against
 *                                            the *immediately preceding equal
 *                                            period*, printed, not implied.
 *   "Is this a trend or a bad week?"      → 7-day moving average on the chart.
 *   "Should I change my hours?"           → arrivals by hour of day.
 *   "Which days are worth opening?"       → takings by weekday.
 *   "Who still owes me?"                  → outstanding, with a way through.
 *
 * Every number is computed from rows in this clinic's own tables. There are no
 * benchmarks, no "clinics like yours", no projections — inventing a comparison
 * is the fastest way to make a report look authoritative and be worthless.
 */

const RANGES = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
] as const

function pctChange(now: number, before: number): number | null {
  if (before <= 0) return null
  return ((now - before) / before) * 100
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>
}) {
  await requireClinic()
  const supabase = await createClient()

  const { days: rawDays } = await searchParams
  const days = RANGES.some((r) => String(r.days) === rawDays) ? Number(rawDays) : 30

  const now = new Date()
  const DAY = 24 * 3600_000
  const since = new Date(now.getTime() - days * DAY)
  // The comparison window is the same length, immediately before — so a "30
  // days" reading is always against the 30 days before it, never against a
  // calendar month of a different length.
  const prevSince = new Date(now.getTime() - 2 * days * DAY)

  const [{ data: payments }, { data: invoices }, { data: appts }] = await Promise.all([
    supabase
      .from("payments")
      .select("amount, mode, paid_at")
      .gte("paid_at", prevSince.toISOString())
      .order("paid_at", { ascending: true }),
    supabase.from("invoices").select("total_amount, status"),
    supabase
      .from("appointments")
      .select("id, starts_at, status")
      .gte("starts_at", prevSince.toISOString())
      .neq("status", "cancelled"),
  ])

  const pays = payments ?? []
  const inCurrent = pays.filter((p) => new Date(p.paid_at) >= since)
  const inPrev = pays.filter((p) => new Date(p.paid_at) < since)

  const sum = (arr: { amount: number }[]) => arr.reduce((s, p) => s + Number(p.amount), 0)
  const collected = sum(inCurrent)
  const collectedPrev = sum(inPrev)

  const seen = (appts ?? []).filter(
    (a) => a.status === "completed" && new Date(a.starts_at) >= since,
  )
  const seenPrev = (appts ?? []).filter(
    (a) => a.status === "completed" && new Date(a.starts_at) < since,
  )

  // Average *payment*, not average per completed appointment. Dividing money
  // by appointments assumes every visit produces exactly one bill and every
  // bill is marked complete — neither is true in a real clinic, and when it
  // isn't the number inflates wildly (a clinic that bills without closing
  // appointments would read "₹24,950 per visit"). Payments are the denominator
  // that always matches the numerator.
  const perVisit = inCurrent.length ? collected / inCurrent.length : 0
  const perVisitPrev = inPrev.length ? collectedPrev / inPrev.length : 0

  // Daily buckets across the *current* window only.
  const buckets = new Map<string, number>()
  for (let i = days - 1; i >= 0; i--) {
    buckets.set(istDateKey(new Date(now.getTime() - i * DAY)), 0)
  }
  for (const p of inCurrent) {
    const key = istDateKey(p.paid_at)
    if (buckets.has(key)) buckets.set(key, buckets.get(key)! + Number(p.amount))
  }
  const daily: DailyPoint[] = [...buckets.entries()].map(([key, amount]) => ({
    label: formatInTimeZone(`${key}T12:00:00Z`, IST_TZ, "d MMM"),
    amount: Math.round(amount),
  }))

  // Mode split
  const modeMap = new Map<string, number>()
  for (const p of inCurrent) modeMap.set(p.mode, (modeMap.get(p.mode) ?? 0) + Number(p.amount))
  const modes = [...modeMap.entries()].sort((a, b) => b[1] - a[1])

  // Arrivals by IST hour of day
  const hourCounts = new Array(24).fill(0) as number[]
  for (const a of appts ?? []) {
    if (new Date(a.starts_at) < since) continue
    hourCounts[Number(formatInTimeZone(a.starts_at, IST_TZ, "H"))]++
  }
  // Trim to the hours a clinic could plausibly run, so 24 mostly-empty columns
  // don't squash the handful that carry the day.
  const firstHour = Math.min(7, ...hourCounts.flatMap((c, h) => (c ? [h] : [])))
  const lastHour = Math.max(21, ...hourCounts.flatMap((c, h) => (c ? [h] : [])))
  const hours = hourCounts
    .map((count, hour) => ({ hour, count }))
    .slice(firstHour, lastHour + 1)

  // Takings by IST weekday
  const weekday = new Array(7).fill(0) as number[]
  for (const p of inCurrent) {
    weekday[Number(formatInTimeZone(p.paid_at, IST_TZ, "i")) % 7] += Number(p.amount)
  }

  // Outstanding across all time — a debt does not expire because the report
  // window moved, so this one deliberately ignores `days`.
  const billed = (invoices ?? [])
    .filter((i) => i.status !== "void")
    .reduce((s, i) => s + Number(i.total_amount), 0)
  const { data: allPay } = await supabase.from("payments").select("amount")
  const outstanding = Math.max(0, billed - (allPay ?? []).reduce((s, p) => s + Number(p.amount), 0))
  const openCount = (invoices ?? []).filter(
    (i) => i.status === "unpaid" || i.status === "partial",
  ).length

  const vs = `vs prev ${days}d`
  const collectedDelta: Delta = { pct: pctChange(collected, collectedPrev), label: vs }
  const seenDelta: Delta = { pct: pctChange(seen.length, seenPrev.length), label: vs }
  const perVisitDelta: Delta = { pct: pctChange(perVisit, perVisitPrev), label: vs }

  return (
    <div>
      <PageHeader
        title="Reports"
        description={`Collections and activity, last ${days} days.`}
      >
        <RangeTabs current={days} />
        <a
          href="/api/reports/export"
          target="_blank"
          rel="noreferrer"
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          <Download className="size-4" /> Export CSV
        </a>
      </PageHeader>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Collected"
          value={formatINR(collected)}
          icon={Wallet}
          delta={collectedDelta}
          spark={daily.map((d) => d.amount)}
        />
        <StatCard
          label="Patients seen"
          value={String(seen.length)}
          icon={Stethoscope}
          delta={seenDelta}
        />
        <StatCard
          label="Average payment"
          value={formatINR(Math.round(perVisit))}
          icon={Banknote}
          delta={perVisitDelta}
          hint={
            inCurrent.length
              ? `across ${inCurrent.length} payment${inCurrent.length === 1 ? "" : "s"}`
              : "no payments yet"
          }
        />
        <StatCard
          label="Outstanding"
          value={formatINR(outstanding)}
          icon={AlertCircle}
          tone={outstanding > 0 ? "destructive" : "default"}
          hint={
            outstanding > 0
              ? `${openCount} invoice${openCount === 1 ? "" : "s"} still open · all time`
              : "everything billed has been collected"
          }
        />
      </div>

      <Panel
        title="Daily collections"
        hint={
          daily.length >= 14
            ? "Bars are what came in each day; the dashed line is the 7-day average."
            : "Not enough history yet for a rolling average."
        }
        className="mb-4"
      >
        <RevenueChart data={daily} />
      </Panel>

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Panel title="How patients pay" hint={`Share of the ${formatINR(collected)} collected.`}>
          <PaymentMix modes={modes} />
        </Panel>
        <Panel title="Takings by weekday" hint="Which days actually carry the week.">
          <WeekdayBars totals={weekday} />
        </Panel>
      </div>

      <Panel
        title="When patients come in"
        hint="Appointment start times. Useful for deciding opening hours — and where to add a slot."
      >
        <HourHistogram hours={hours} />
      </Panel>

      {outstanding > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-edge/20 bg-card p-5 shadow-nm-raised">
          <p className="text-sm">
            <span className="font-semibold">{formatINR(outstanding)}</span> is still owed across{" "}
            {openCount} open invoice{openCount === 1 ? "" : "s"}.
          </p>
          {/* A number a doctor can act on should come with the action. */}
          <Link
            href="/billing?status=unpaid"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            <TrendingUp className="size-4" />
            Chase them in Billing
          </Link>
        </div>
      )}
    </div>
  )
}

/**
 * Period switcher. Plain links, not a client component — the whole page is a
 * server render keyed on `?days`, so a `<Link>` is both the smallest and the
 * most correct implementation: it is shareable, back-button-able, and works
 * before any JS has loaded.
 */
function RangeTabs({ current }: { current: number }) {
  return (
    <div
      role="group"
      aria-label="Reporting period"
      className="flex items-center gap-0.5 rounded-full border border-edge/20 bg-background/60 p-0.5 shadow-nm-inset"
    >
      {RANGES.map((r) => {
        const on = r.days === current
        return (
          <Link
            key={r.days}
            href={`/reports?days=${r.days}`}
            aria-current={on ? "true" : undefined}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
              on
                ? "bg-card text-foreground shadow-nm-raised"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {r.label}
          </Link>
        )
      })}
    </div>
  )
}

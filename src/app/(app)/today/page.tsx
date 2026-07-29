import { Users, Clock3, CheckCircle2, IndianRupee } from "lucide-react"
import { OfflineDrafts } from "@/components/visits/offline-drafts"
import { createClient } from "@/lib/supabase/server"
import { requireClinic } from "@/lib/clinic"
import { istDateKey, istDayRangeUtc, formatISTDate, formatINR } from "@/lib/format"
import { PageHeader } from "@/components/page-header"
import { StatCard, type Delta } from "@/components/stat-card"
import { WalkInDialog } from "@/components/today/walk-in-dialog"
import { DayFocus } from "@/components/today/day-focus"
import { DayRail } from "@/components/today/day-rail"
import { QueueList, type QueueRow } from "@/components/today/queue-list"
import { PendingBookings, type PendingRow } from "@/components/today/pending-bookings"

/** How many booking requests the banner shows before it says "and N more". */
const PENDING_LIMIT = 50

/** Signed percent change, or null when there is no baseline worth comparing to. */
function pctChange(now: number, before: number): number | null {
  if (before <= 0) return null
  return ((now - before) / before) * 100
}

export default async function TodayPage() {
  await requireClinic() // auth guard; the queries below are scoped by RLS
  const supabase = await createClient()

  // Resolved once, here, and passed down. Reading the clock inside a component
  // body is impure and the React Compiler rejects it; request-scoped values
  // belong to the request.
  const now = new Date()
  const todayKey = istDateKey(now)
  const { start, end } = istDayRangeUtc(todayKey)

  // Two weeks of payments, not one day. Today's number on its own says nothing
  // — the comparison that means something to a clinic is the *same weekday*
  // last week (Tuesdays behave like Tuesdays; Tuesday vs Sunday is noise), and
  // the sparkline needs the run of days behind it either way. One query
  // covers both.
  const sparkFrom = new Date(start)
  sparkFrom.setUTCDate(sparkFrom.getUTCDate() - 13)

  const [{ data }, { data: pendingData, count: pendingTotal }, { data: recentPayments }] =
    await Promise.all([
    supabase
      .from("appointments")
      .select(
        "id, starts_at, status, source, token_number, reason, patient:patients(id, full_name, phone)",
      )
      .gte("starts_at", start.toISOString())
      .lt("starts_at", end.toISOString())
      .not("status", "in", "(cancelled,pending)")
      .order("token_number", { ascending: true, nullsFirst: false })
      .order("starts_at", { ascending: true }),
    // Only requests whose slot has not already come and gone. Without the
    // floor, a request the doctor never got round to answering sat here for
    // ever — and because the list is ordered soonest-first and capped, a
    // backlog of dead requests pushed today's live ones off the end. A
    // request for a slot that has passed cannot be accepted; it is history,
    // not an inbox item.
    supabase
      .from("appointments")
      .select("id, starts_at, reason, patient:patients(full_name, phone)", { count: "exact" })
      .eq("status", "pending")
      .gte("starts_at", start.toISOString())
      .order("starts_at", { ascending: true })
      .limit(PENDING_LIMIT),
    supabase
      .from("payments")
      .select("amount, paid_at")
      .gte("paid_at", sparkFrom.toISOString())
      .lt("paid_at", end.toISOString()),
  ])

  const rows = (data ?? []) as unknown as QueueRow[]
  const pending = (pendingData ?? []) as unknown as PendingRow[]

  // Mark rows whose pre-visit intake has been submitted.
  const apptIds = rows.map((r) => r.id)
  if (apptIds.length) {
    const { data: intakes } = await supabase
      .from("intake_requests")
      .select("appointment_id")
      .in("appointment_id", apptIds)
      .eq("status", "submitted")
    const done = new Set((intakes ?? []).map((i) => i.appointment_id))
    for (const r of rows) r.intakeDone = done.has(r.id)
  }

  const waiting = rows.filter((r) => r.status === "arrived" || r.status === "in_progress").length
  const done = rows.filter((r) => r.status === "completed").length

  // Bucket the fortnight into IST days so both the sparkline and the
  // same-weekday comparison read off one source.
  const byDay = new Map<string, number>()
  for (let i = 13; i >= 0; i--) {
    const d = new Date(start)
    d.setUTCDate(d.getUTCDate() - i)
    byDay.set(istDateKey(d), 0)
  }
  for (const p of recentPayments ?? []) {
    const key = istDateKey(p.paid_at)
    if (byDay.has(key)) byDay.set(key, byDay.get(key)! + Number(p.amount))
  }
  const series = [...byDay.values()]
  const revenue = series[series.length - 1] ?? 0
  const sameDayLastWeek = series[series.length - 8] ?? 0

  const revenueDelta: Delta = {
    pct: pctChange(revenue, sameDayLastWeek),
    label: "vs last week",
  }

  return (
    <div>
      <PageHeader title="Today" description={formatISTDate(todayKey)}>
        <WalkInDialog />
      </PageHeader>

      {/* Anything written while the connection was down, waiting to be sent. */}
      <div className="mb-4 empty:mb-0">
        <OfflineDrafts />
      </div>

      <PendingBookings rows={pending} total={pendingTotal ?? pending.length} />

      {/* Order is deliberate and is the answer to "what do I need right now":
          the two people who matter this minute, then the shape of the day,
          then the counts, then the full list. The counts used to lead — they
          are the least actionable thing on the screen. */}
      <DayFocus rows={rows} />
      <DayRail rows={rows} nowMs={now.getTime()} />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="In queue"
          value={String(rows.length)}
          icon={Users}
          hint={rows.length ? `${rows.length - done} still to see` : "nothing booked"}
        />
        <StatCard
          label="Waiting"
          value={String(waiting)}
          icon={Clock3}
          hint={waiting ? "here now, not yet seen" : "nobody waiting"}
        />
        <StatCard
          label="Completed"
          value={String(done)}
          icon={CheckCircle2}
          hint={rows.length ? `${Math.round((done / rows.length) * 100)}% of today` : undefined}
        />
        <StatCard
          label="Revenue today"
          value={formatINR(revenue)}
          icon={IndianRupee}
          delta={revenueDelta}
          spark={series}
        />
      </div>

      <QueueList rows={rows} />
    </div>
  )
}

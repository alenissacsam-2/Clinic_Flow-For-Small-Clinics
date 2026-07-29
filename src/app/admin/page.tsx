import { Building2, Users, UserRound, Wallet, IndianRupee, CalendarClock, MessageCircleWarning } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { formatINR } from "@/lib/format"
import { PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import { RevenueChart, type DailyPoint } from "@/components/reports/revenue-chart"
import { hasServiceRole } from "@/lib/env"
import { whatsappConfigured } from "@/lib/whatsapp/client"

type Stats = {
  clinics: number
  suspended: number
  doctors: number
  staff: number
  patients: number
  appts_total: number
  appts_7d: number
  revenue_total: number
  revenue_today: number
  revenue_7d: number
  revenue_30d: number
  wa_failed: number
  wa_by_status: Record<string, number>
  signups: { date: string; count: number }[]
}

export default async function AdminOverviewPage() {
  const supabase = await createClient()
  const { data } = await supabase.rpc("admin_platform_stats")
  const s = (data as unknown as Stats | null) ?? null

  if (!s) {
    return (
      <div>
        <PageHeader title="Operator overview" description="Platform-wide activity across all clinics." />
        <p className="text-sm text-muted-foreground">Couldn&apos;t load platform stats.</p>
      </div>
    )
  }

  const signupSeries: DailyPoint[] = s.signups.map((p) => ({
    label: p.date.slice(5), // MM-DD
    amount: p.count,
  }))
  const waSent = (s.wa_by_status.sent ?? 0) + (s.wa_by_status.delivered ?? 0) + (s.wa_by_status.read ?? 0)
  const waLive = whatsappConfigured()

  return (
    <div>
      <PageHeader
        title="Operator overview"
        description="Platform-wide activity across all clinics."
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Clinics" value={String(s.clinics)} icon={Building2} hint={s.suspended ? `${s.suspended} paused` : "all active"} />
        <StatCard label="Doctors / staff" value={`${s.doctors} / ${s.staff}`} icon={Users} />
        <StatCard label="Patients" value={String(s.patients)} icon={UserRound} />
        <StatCard label="Revenue (all-time)" value={formatINR(s.revenue_total)} icon={Wallet} />
        <StatCard label="Revenue today" value={formatINR(s.revenue_today)} icon={IndianRupee} />
        <StatCard label="Revenue 7d" value={formatINR(s.revenue_7d)} icon={IndianRupee} />
        <StatCard label="Appointments (7d)" value={String(s.appts_7d)} icon={CalendarClock} hint={`${s.appts_total} all-time`} />
        <StatCard label="WhatsApp failed" value={String(s.wa_failed)} icon={MessageCircleWarning} tone={s.wa_failed > 0 ? "destructive" : "default"} />
      </div>

      <div className="mb-6 rounded-xl border border-edge/20 bg-card shadow-nm-raised p-4">
        <h2 className="mb-4 font-heading text-sm font-semibold">Sign-ups (last 30 days)</h2>
        <RevenueChart data={signupSeries} kind="count" seriesLabel="Sign-ups" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-edge/20 bg-card shadow-nm-raised p-4">
          <h2 className="mb-3 text-sm font-semibold">WhatsApp delivery</h2>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs">
            <span
              className={waLive ? "size-2 rounded-full bg-success" : "size-2 rounded-full bg-warning"}
            />
            {waLive ? "Live (Meta Cloud API)" : "Dry-run — messages queued, not delivered"}
          </div>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center justify-between">
              <span className="text-muted-foreground">Delivered / sent</span>
              <span className="font-medium tabular-nums">{waSent}</span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-muted-foreground">Queued / sending</span>
              <span className="font-medium tabular-nums">
                {(s.wa_by_status.queued ?? 0) + (s.wa_by_status.sending ?? 0)}
              </span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-muted-foreground">Failed</span>
              <span className={`font-medium tabular-nums ${s.wa_failed ? "text-destructive" : ""}`}>
                {s.wa_failed}
              </span>
            </li>
          </ul>
        </div>

        <div className="rounded-xl border border-edge/20 bg-card shadow-nm-raised p-4">
          <h2 className="mb-3 text-sm font-semibold">Platform health</h2>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center justify-between">
              <span className="text-muted-foreground">Service-role key</span>
              <span className="font-medium">{hasServiceRole() ? "Configured" : "Missing"}</span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-muted-foreground">WhatsApp delivery</span>
              <span className="font-medium">{waLive ? "Live" : "Dry-run"}</span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-muted-foreground">Paused clinics</span>
              <span className="font-medium tabular-nums">{s.suspended}</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}

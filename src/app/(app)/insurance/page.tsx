import { requireClinic } from "@/lib/clinic"
import { createClient } from "@/lib/supabase/server"
import { formatINR } from "@/lib/format"
import { outstandingAmount, isOutstanding } from "@/lib/insurance"
import { PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import { Pagination, parsePage } from "@/components/pagination"
import { ClaimsManager, type ClaimRow } from "@/components/insurance/claims-manager"
import { ShieldCheck, IndianRupee, FileClock } from "lucide-react"

const PAGE_SIZE = 25

/**
 * How many claims the headline figures are allowed to read. Well past what a
 * solo practice accumulates, but finite — an unbounded aggregate on a page a
 * doctor opens daily is a query waiting to time out. If a clinic ever crosses
 * it, the page says so rather than quietly under-reporting the debt.
 */
const SUMMARY_CEILING = 2000

export default async function InsurancePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const clinic = await requireClinic()
  const { page: rawPage } = await searchParams
  const page = parsePage(rawPage)
  const supabase = await createClient()

  // Two queries, deliberately.
  //
  // This page used to run one `.limit(100)` and compute both the table and the
  // money from it. The table being cut off is a nuisance; the money being cut
  // off is a lie. "Outstanding" is the number a clinic chases its TPAs with,
  // and past a hundred claims it silently reported the debt of the newest
  // hundred only — always too low, never flagged.
  //
  // So: a light query over the whole claim set for the totals, and a paged
  // query with the heavy `claim_events` join for what is actually on screen.
  const [{ data: summaryData, count }, { data: pageData }] = await Promise.all([
    supabase
      .from("claims")
      .select("status, claimed_amount, approved_amount, settled_amount, payer:payers(name)", {
        count: "exact",
      })
      .eq("clinic_id", clinic.id)
      .range(0, SUMMARY_CEILING - 1),
    supabase
      .from("claims")
      .select(
        "id, status, claim_no, preauth_no, claimed_amount, approved_amount, settled_amount, created_at, payer:payers(name), patient:patients(full_name), events:claim_events(id, status, amount, note, created_at)",
      )
      .eq("clinic_id", clinic.id)
      .order("created_at", { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
  ])

  type SummaryRow = {
    status: string
    claimed_amount: number
    approved_amount: number | null
    settled_amount: number | null
    payer: { name: string } | null
  }
  const summary = (summaryData ?? []) as unknown as SummaryRow[]
  const claims = (pageData ?? []) as unknown as ClaimRow[]
  const total = count ?? summary.length
  const truncated = total > SUMMARY_CEILING

  // TPA-wise outstanding: what each payer still owes, biggest debtor first —
  // the list a clinic actually chases.
  const byPayer = new Map<string, { outstanding: number; open: number }>()
  for (const c of summary) {
    const name = c.payer?.name ?? "Unknown payer"
    const row = byPayer.get(name) ?? { outstanding: 0, open: 0 }
    row.outstanding += outstandingAmount(c)
    if (isOutstanding(c.status)) row.open += 1
    byPayer.set(name, row)
  }
  const payerRows = [...byPayer.entries()]
    .filter(([, v]) => v.open > 0 || v.outstanding > 0)
    .sort((a, b) => b[1].outstanding - a[1].outstanding)

  const totalOutstanding = payerRows.reduce((s, [, v]) => s + v.outstanding, 0)
  const openClaims = summary.filter((c) => isOutstanding(c.status)).length
  const settled = summary.filter((c) => c.status === "settled").length

  return (
    <div>
      <PageHeader
        title="Insurance & TPA"
        description="Pre-auth, claim submission and settlement, with what each payer still owes."
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <StatCard label="Outstanding" value={formatINR(totalOutstanding)} icon={IndianRupee} />
        <StatCard label="Open claims" value={String(openClaims)} icon={FileClock} />
        <StatCard label="Settled" value={String(settled)} icon={ShieldCheck} />
      </div>

      {truncated && (
        <p className="mb-4 rounded-lg border border-edge/20 bg-background/45 px-4 py-2.5 text-xs text-muted-foreground">
          These totals cover the most recent {SUMMARY_CEILING.toLocaleString("en-IN")} of{" "}
          {total.toLocaleString("en-IN")} claims. Export the full set if you need the exact figure.
        </p>
      )}

      {payerRows.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-2 text-sm font-semibold">Outstanding by payer</h2>
          <ul className="divide-y divide-edge/12 rounded-xl border border-edge/15 bg-background/45 shadow-nm-inset">
            {payerRows.map(([name, v]) => (
              <li key={name} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="font-medium">{name}</span>
                <span className="text-xs text-muted-foreground">
                  {v.open} open claim{v.open === 1 ? "" : "s"}
                </span>
                <span className="tabular-nums">{formatINR(v.outstanding)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ClaimsManager claims={claims} />

      {total > PAGE_SIZE && (
        <div className="mt-2 rounded-xl border border-edge/20 bg-card shadow-nm-raised">
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            baseHref="/insurance"
            noun="claims"
          />
        </div>
      )}
    </div>
  )
}

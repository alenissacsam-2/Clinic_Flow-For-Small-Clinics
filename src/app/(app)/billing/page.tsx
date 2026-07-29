import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { requireClinic } from "@/lib/clinic"
import { formatINR, formatISTDate } from "@/lib/format"
import { INVOICE_STATUS } from "@/lib/status"
import type { Enums } from "@/types/database"
import { PageHeader } from "@/components/page-header"
import { FilterChips } from "@/components/filter-chips"
import { Pagination, parsePage } from "@/components/pagination"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type Row = {
  id: string
  invoice_no: string
  status: Enums<"invoice_status">
  total_amount: number
  created_at: string
  patient: { id: string; full_name: string } | null
}

const PAGE_SIZE = 50

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>
}) {
  await requireClinic()
  const { status, page: rawPage } = await searchParams
  const page = parsePage(rawPage)
  const supabase = await createClient()

  // `count: "exact"` alongside `range()` — this replaced a bare `.limit(100)`
  // that truncated the list with nothing on screen admitting it. The count is
  // what lets the footer say how much is actually there.
  let query = supabase
    .from("invoices")
    .select("id, invoice_no, status, total_amount, created_at, patient:patients(id, full_name)", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
  if (status && ["unpaid", "partial", "paid", "void"].includes(status)) {
    query = query.eq("status", status as "unpaid")
  }
  const { data, count } = await query
  const rows = (data ?? []) as unknown as Row[]
  const total = count ?? rows.length

  const filters = [
    { key: undefined, label: "All", href: "/billing" },
    { key: "unpaid", label: "Unpaid", href: "/billing?status=unpaid" },
    { key: "partial", label: "Partial", href: "/billing?status=partial" },
    { key: "paid", label: "Paid", href: "/billing?status=paid" },
  ]

  return (
    <div>
      <PageHeader title="Billing" description="Invoices and payments." />

      <div className="mb-4">
        <FilterChips options={filters} activeKey={status} />
      </div>

      <div className="rounded-xl border border-edge/20 bg-card shadow-nm-raised">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice</TableHead>
              <TableHead>Patient</TableHead>
              <TableHead className="hidden sm:table-cell">Date</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!rows.length && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                  No invoices yet. They&apos;re created automatically when you complete a visit.
                </TableCell>
              </TableRow>
            )}
            {rows.map((i) => (
              <TableRow key={i.id}>
                <TableCell className="font-medium">
                  <Link href={`/billing/${i.id}`} className="hover:underline">
                    {i.invoice_no}
                  </Link>
                </TableCell>
                <TableCell>{i.patient?.full_name ?? "—"}</TableCell>
                <TableCell className="hidden sm:table-cell text-muted-foreground">
                  {formatISTDate(i.created_at)}
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatINR(i.total_amount)}</TableCell>
                <TableCell className="text-right">
                  <Badge variant="outline" className={INVOICE_STATUS[i.status].badge}>
                    {INVOICE_STATUS[i.status].label}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {rows.length > 0 && (
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            baseHref={status ? `/billing?status=${status}` : "/billing"}
            noun="invoices"
          />
        )}
      </div>
    </div>
  )
}

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { formatISTDateTime } from "@/lib/format"
import { csvCell, csvNumber, toCsv } from "@/lib/csv"
import { contentDisposition } from "@/lib/http"

export const runtime = "nodejs"

/** Export the clinic's payments as CSV (RLS scopes to the current clinic). */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new NextResponse("Unauthorized", { status: 401 })

  const { data } = await supabase
    .from("payments")
    .select("paid_at, amount, mode, invoice:invoices(invoice_no, patient:patients(full_name))")
    .order("paid_at", { ascending: false })
    .limit(5000)

  const rows = (data ?? []) as unknown as {
    paid_at: string
    amount: number
    mode: string
    invoice: { invoice_no: string; patient: { full_name: string } | null } | null
  }[]

  // Patient names reach this file from the public booking page, so every text
  // cell goes through `csvCell`, which neutralises the leading characters a
  // spreadsheet would evaluate as a formula. Amounts use `csvNumber` so they
  // stay numeric and sortable in Excel. See src/lib/csv.ts.
  const csv = toCsv(
    ["Date", "Invoice", "Patient", "Mode", "Amount"],
    rows.map((r) => [
      csvCell(formatISTDateTime(r.paid_at)),
      csvCell(r.invoice?.invoice_no ?? ""),
      csvCell(r.invoice?.patient?.full_name ?? ""),
      csvCell(r.mode),
      csvNumber(Number(r.amount)),
    ]),
  )

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": contentDisposition("attachment", "payments.csv"),
      "Cache-Control": "private, no-store",
    },
  })
}

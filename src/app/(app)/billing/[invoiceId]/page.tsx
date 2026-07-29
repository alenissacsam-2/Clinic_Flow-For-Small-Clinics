import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { requireClinic, clinicSettings } from "@/lib/clinic"
import { formatINR, formatISTDate, formatISTDateTime } from "@/lib/format"
import { RecordPaymentDialog } from "@/components/billing/record-payment-dialog"
import { InvoiceItemsEditor, type InvoiceItem } from "@/components/billing/invoice-items-editor"
import { UpiQrDialog } from "@/components/billing/upi-qr-dialog"
import { PaymentClaimBanner } from "@/components/billing/payment-claim-banner"
import { DispensePanel, type DispensableItem, type PayerOption } from "@/components/billing/dispense-panel"
import { expiryTier } from "@/lib/pharmacy/stock"
import { istDateKey } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { INVOICE_STATUS } from "@/lib/status"
import { cn } from "@/lib/utils"

export default async function InvoiceDetail({
  params,
}: {
  params: Promise<{ invoiceId: string }>
}) {
  const clinic = await requireClinic()
  const settings = clinicSettings(clinic)
  const { invoiceId } = await params
  const supabase = await createClient()

  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, invoice_no, status, total_amount, created_at, claimed_utr, patient:patients(id, full_name, phone)")
    .eq("id", invoiceId)
    .maybeSingle()
  if (!invoice) notFound()
  const patient = invoice.patient as unknown as { id: string; full_name: string; phone: string } | null

  const [{ data: items }, { data: payments }] = await Promise.all([
    supabase.from("invoice_items").select("id, description, qty, unit_price").eq("invoice_id", invoiceId),
    supabase.from("payments").select("id, amount, mode, paid_at").eq("invoice_id", invoiceId).order("paid_at"),
  ])

  // Pharmacy + insurance context for the side panel. Both are optional
  // modules: a clinic with no stock and no payers sees neither.
  const today = istDateKey()
  const [{ data: stockRows }, { data: payerRows }, { data: existingClaims }] = await Promise.all([
    supabase
      .from("inventory_items")
      .select("id, name, form, strength, unit, batches:stock_batches(expiry_date, qty_available, mrp)")
      .eq("is_active", true)
      .order("name"),
    supabase.from("payers").select("id, name").eq("is_active", true).order("name"),
    supabase.from("claims").select("id").eq("invoice_id", invoiceId).limit(1),
  ])

  const stock: DispensableItem[] = (stockRows ?? [])
    .map((i) => {
      const live = (i.batches ?? []).filter(
        (b) => b.qty_available > 0 && expiryTier(b.expiry_date, today) !== "expired",
      )
      return {
        id: i.id,
        name: i.name,
        form: i.form,
        strength: i.strength,
        unit: i.unit,
        onHand: live.reduce((s, b) => s + b.qty_available, 0),
        // Price from the batch going out first, so the suggestion matches
        // what FEFO will actually dispense.
        mrp: live.sort((a, b) => (a.expiry_date ?? "9999").localeCompare(b.expiry_date ?? "9999"))[0]?.mrp ?? null,
      }
    })
    .filter((i) => i.onHand > 0)

  const total = Number(invoice.total_amount)
  const paid = (payments ?? []).reduce((s, p) => s + Number(p.amount), 0)
  const due = Math.max(0, total - paid)
  const editable = invoice.status !== "paid" && invoice.status !== "void"

  return (
    <div>
      <Link
        href="/billing"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Billing
      </Link>

      <div className="mb-6 flex flex-col gap-3 rounded-xl border border-edge/20 bg-card shadow-nm-raised p-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-xl font-semibold tabular-nums">{invoice.invoice_no}</h1>
            <Badge variant="outline" className={INVOICE_STATUS[invoice.status].badge}>
              {INVOICE_STATUS[invoice.status].label}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {patient ? (
              <Link href={`/patients/${patient.id}`} className="hover:underline">
                {patient.full_name}
              </Link>
            ) : (
              "—"
            )}{" "}
            · {formatISTDate(invoice.created_at)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`/api/invoices/${invoiceId}/pdf?download=1`}
            target="_blank"
            rel="noreferrer"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            Receipt PDF
          </a>
          {due > 0 && invoice.status !== "void" && settings.upi_vpa && (
            <UpiQrDialog
              invoiceId={invoiceId}
              vpa={settings.upi_vpa}
              name={settings.upi_name || clinic.name}
              amount={due}
              note={invoice.invoice_no}
            />
          )}
          {due > 0 && invoice.status !== "void" && (
            <RecordPaymentDialog invoiceId={invoiceId} due={due} />
          )}
        </div>
      </div>

      {invoice.claimed_utr && invoice.status !== "paid" && invoice.status !== "void" && (
        <div className="mb-6">
          <PaymentClaimBanner invoiceId={invoiceId} utr={invoice.claimed_utr} />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div>
          <h2 className="mb-2 text-sm font-semibold">Line items</h2>
          <InvoiceItemsEditor
            invoiceId={invoiceId}
            items={(items ?? []) as InvoiceItem[]}
            editable={editable}
          />
        </div>

        <aside className="space-y-4">
          {patient && editable && (
            <DispensePanel
              invoiceId={invoiceId}
              patientId={patient.id}
              items={stock}
              payers={(payerRows ?? []) as PayerOption[]}
              hasClaim={(existingClaims ?? []).length > 0}
            />
          )}
          {/* Receipt-style summary — the register's running total. */}
          <div className="rounded-xl border border-edge/20 bg-card shadow-nm-raised p-4 text-sm">
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground">Total</span>
              <span className="font-medium tabular-nums">{formatINR(total)}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground">Paid</span>
              <span className="tabular-nums">{formatINR(paid)}</span>
            </div>
            <div className="mt-1 flex items-baseline justify-between border-t border-dashed pt-2">
              <span className="font-heading text-base font-semibold">Due</span>
              <span
                className={cn(
                  "font-heading text-lg font-semibold tabular-nums",
                  due > 0 ? "text-destructive" : "text-success",
                )}
              >
                {formatINR(due)}
              </span>
            </div>
          </div>

          <div>
            <h2 className="mb-2 font-heading text-sm font-semibold">Payments</h2>
            {!payments?.length ? (
              <p className="text-sm text-muted-foreground">No payments yet.</p>
            ) : (
              <ul className="divide-y divide-edge/12 rounded-xl border border-edge/15 bg-background/45 shadow-nm-inset text-sm">
                {payments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between px-3 py-2">
                    <span className="capitalize text-muted-foreground">{p.mode}</span>
                    <span className="tabular-nums">{formatINR(p.amount)}</span>
                    <span className="text-xs text-muted-foreground">{formatISTDateTime(p.paid_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}

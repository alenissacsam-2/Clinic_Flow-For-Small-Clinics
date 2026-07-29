import { requireClinic } from "@/lib/clinic"
import { createClient } from "@/lib/supabase/server"
import { istDateKey } from "@/lib/format"
import { expiryTier } from "@/lib/pharmacy/stock"
import { PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import { StockManager, type ItemRow } from "@/components/pharmacy/stock-manager"
import { Package, TriangleAlert, CircleAlert } from "lucide-react"

export default async function PharmacyPage() {
  const clinic = await requireClinic()
  const supabase = await createClient()
  const today = istDateKey()

  const { data } = await supabase
    .from("inventory_items")
    .select(
      "id, name, form, strength, unit, reorder_level, batches:stock_batches(id, batch_no, expiry_date, qty_available, mrp)",
    )
    .eq("clinic_id", clinic.id)
    .eq("is_active", true)
    .order("name")

  const items: ItemRow[] = (data ?? []).map((i) => ({
    ...i,
    // Soonest expiry first, matching the order stock will actually go out in.
    batches: [...(i.batches ?? [])]
      .filter((b) => b.qty_available > 0)
      .sort((a, b) => (a.expiry_date ?? "9999").localeCompare(b.expiry_date ?? "9999")),
  }))

  const allBatches = items.flatMap((i) => i.batches)
  const expiring = allBatches.filter((b) => {
    const t = expiryTier(b.expiry_date, today)
    return t === "critical" || t === "warning" || t === "watch"
  }).length
  const expired = allBatches.filter((b) => expiryTier(b.expiry_date, today) === "expired").length
  const lowStock = items.filter((i) => {
    if (i.reorder_level <= 0) return false
    const onHand = i.batches.reduce(
      (s, b) => (expiryTier(b.expiry_date, today) === "expired" ? s : s + b.qty_available),
      0,
    )
    return onHand <= i.reorder_level
  }).length

  return (
    <div>
      <PageHeader
        title="Pharmacy"
        description="Batch-tracked stock with expiry alerts. Dispensing is first-expiry-first-out."
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <StatCard label="Items stocked" value={String(items.length)} icon={Package} />
        <StatCard
          label="Expiring within 90 days"
          value={String(expiring)}
          icon={TriangleAlert}
          hint={expiring > 0 ? "Move these first" : undefined}
        />
        <StatCard
          label="Expired on shelf"
          value={String(expired)}
          icon={CircleAlert}
          tone={expired > 0 ? "destructive" : "default"}
          hint={lowStock > 0 ? `${lowStock} item(s) at reorder level` : undefined}
        />
      </div>

      <StockManager items={items} today={today} />
    </div>
  )
}

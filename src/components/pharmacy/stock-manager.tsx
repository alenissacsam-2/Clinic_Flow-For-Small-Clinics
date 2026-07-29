"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Plus, PackagePlus, TriangleAlert, Trash2 } from "lucide-react"
import { createInventoryItem, receiveStock, writeOffBatch } from "@/actions/pharmacy"
import { expiryTier, expiryLabel, type ExpiryTier } from "@/lib/pharmacy/stock"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { formatINR } from "@/lib/format"
import { TONE } from "@/lib/status"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

export type BatchRow = {
  id: string
  batch_no: string
  expiry_date: string | null
  qty_available: number
  mrp: number | null
}

export type ItemRow = {
  id: string
  name: string
  form: string | null
  strength: string | null
  unit: string
  reorder_level: number
  batches: BatchRow[]
}

const TIER_TONE: Record<ExpiryTier, keyof typeof TONE | null> = {
  expired: "danger",
  critical: "danger",
  warning: "warning",
  watch: "info",
  ok: null,
  none: null,
}

/**
 * Stock list with expiry alerts.
 *
 * `today` comes from the server so the tiering matches what the server would
 * compute — a client clock that is a day out must not change which batch shows
 * as expired.
 */
export function StockManager({ items, today }: { items: ItemRow[]; today: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()

  function writeOff(batchId: string) {
    start(async () => {
      const res = await writeOffBatch(batchId)
      if (res.error) toast.error(res.error)
      else {
        toast.success("Batch written off")
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <NewItemDialog />
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-edge/30 bg-background/40 shadow-nm-inset py-10 text-center text-sm text-muted-foreground">
          No items in stock yet. Add one to start tracking batches and expiry.
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => {
            const onHand = item.batches.reduce(
              (s, b) => (expiryTier(b.expiry_date, today) === "expired" ? s : s + b.qty_available),
              0,
            )
            const low = item.reorder_level > 0 && onHand <= item.reorder_level
            return (
              <li key={item.id} className="rounded-xl border border-edge/15 bg-background/45 shadow-nm-inset">
                <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">
                      {[item.name, item.strength, item.form].filter(Boolean).join(" ")}
                    </span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {onHand} {item.unit}
                      {onHand === 1 ? "" : "s"} on hand
                    </span>
                  </span>
                  {low && (
                    <Badge variant="outline" className={TONE.warning.text}>
                      At or below reorder level
                    </Badge>
                  )}
                  <ReceiveDialog itemId={item.id} itemName={item.name} />
                </div>

                {item.batches.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-muted-foreground">No batches received yet.</p>
                ) : (
                  <ul className="divide-y">
                    {item.batches.map((b) => {
                      const tier = expiryTier(b.expiry_date, today)
                      const tone = TIER_TONE[tier]
                      const label = expiryLabel(b.expiry_date, today)
                      return (
                        <li
                          key={b.id}
                          className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm"
                        >
                          <span className="font-mono text-xs">{b.batch_no}</span>
                          <span className="text-muted-foreground">
                            {b.qty_available} left
                            {b.mrp != null ? ` · MRP ${formatINR(b.mrp)}` : ""}
                          </span>
                          {b.expiry_date ? (
                            <span
                              className={cn(
                                "rounded-md px-1.5 py-0.5 text-[11px] font-medium",
                                tone ? TONE[tone].tint : "text-muted-foreground",
                              )}
                            >
                              {label ?? `Expires ${b.expiry_date}`}
                            </span>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">
                              No expiry recorded
                            </span>
                          )}
                          {tier === "expired" && b.qty_available > 0 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={pending}
                              onClick={() => writeOff(b.id)}
                            >
                              <Trash2 className="size-3.5 text-destructive" /> Write off
                            </Button>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <p className={cn("flex items-start gap-2 rounded-lg border p-3 text-xs", TONE.info.banner)}>
        <TriangleAlert className={cn("mt-0.5 size-3.5 shrink-0", TONE.info.text)} />
        <span>
          Dispensing is first-expiry-first-out, and <strong>expired batches are never
          dispensed</strong> however much is left in them. Stock can only leave against a bill line
          — that rule is enforced by the database, not just the app.
        </span>
      </p>
    </div>
  )
}

function NewItemDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    name: "",
    form: "",
    strength: "",
    unit: "strip",
    reorderLevel: "",
    gstRate: "",
  })
  const [pending, start] = useTransition()

  function submit() {
    start(async () => {
      const res = await createInventoryItem(form)
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success("Item added")
      setOpen(false)
      setForm({ name: "", form: "", strength: "", unit: "strip", reorderLevel: "", gstRate: "" })
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm">
            <Plus className="size-4" /> Add item
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a stock item</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Strength" value={form.strength} onChange={(v) => setForm({ ...form, strength: v })} />
            <Field label="Form" value={form.form} onChange={(v) => setForm({ ...form, form: v })} />
            <Field label="Unit" value={form.unit} onChange={(v) => setForm({ ...form, unit: v })} />
            <Field
              label="Reorder level"
              value={form.reorderLevel}
              onChange={(v) => setForm({ ...form, reorderLevel: v })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" disabled={pending || !form.name.trim()} onClick={submit}>
            {pending ? "Adding…" : "Add item"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ReceiveDialog({ itemId, itemName }: { itemId: string; itemName: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ batchNo: "", expiryDate: "", qty: "", costPrice: "", mrp: "" })
  const [pending, start] = useTransition()

  function submit() {
    start(async () => {
      const res = await receiveStock({ itemId, ...form })
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success("Stock received")
      setOpen(false)
      setForm({ batchNo: "", expiryDate: "", qty: "", costPrice: "", mrp: "" })
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <PackagePlus className="size-4" /> Receive
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Receive stock — {itemName}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Batch number" value={form.batchNo} onChange={(v) => setForm({ ...form, batchNo: v })} />
          <Field
            label="Expiry date"
            type="date"
            value={form.expiryDate}
            onChange={(v) => setForm({ ...form, expiryDate: v })}
          />
          <Field label="Quantity" value={form.qty} onChange={(v) => setForm({ ...form, qty: v })} />
          <Field label="MRP" value={form.mrp} onChange={(v) => setForm({ ...form, mrp: v })} />
        </div>
        <DialogFooter>
          <Button
            type="button"
            disabled={pending || !form.batchNo.trim() || !form.qty.trim()}
            onClick={submit}
          >
            {pending ? "Receiving…" : "Receive"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Field({
  label,
  value,
  onChange,
  type,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
}) {
  const id = `f-${label.toLowerCase().replace(/\s+/g, "-")}`
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

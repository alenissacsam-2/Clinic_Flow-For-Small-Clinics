"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Pill, FileHeart } from "lucide-react"
import { dispenseToInvoice } from "@/actions/pharmacy"
import { createClaim } from "@/actions/insurance"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export type DispensableItem = {
  id: string
  name: string
  form: string | null
  strength: string | null
  unit: string
  onHand: number
  mrp: number | null
}

export type PayerOption = { id: string; name: string }

/**
 * Dispense stock onto this bill, and open an insurance claim against it.
 *
 * Dispensing lives on the invoice rather than in the pharmacy screen on
 * purpose: stock can only leave against a bill line, so the bill is where the
 * action belongs.
 */
export function DispensePanel({
  invoiceId,
  patientId,
  items,
  payers,
  hasClaim,
}: {
  invoiceId: string
  patientId: string
  items: DispensableItem[]
  payers: PayerOption[]
  hasClaim: boolean
}) {
  const router = useRouter()
  const [itemId, setItemId] = useState("")
  const [qty, setQty] = useState("1")
  const [price, setPrice] = useState("")
  const [payerId, setPayerId] = useState("")
  const [pending, start] = useTransition()

  const selected = items.find((i) => i.id === itemId)

  function dispense() {
    start(async () => {
      const res = await dispenseToInvoice({ invoiceId, itemId, qty, unitPrice: price })
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success("Dispensed and billed")
      setItemId("")
      setQty("1")
      setPrice("")
      router.refresh()
    })
  }

  function claim() {
    start(async () => {
      const res = await createClaim({ patientId, payerId, invoiceId })
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success("Claim opened")
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      {items.length > 0 && (
        <div className="space-y-2 rounded-xl border border-edge/20 bg-card shadow-nm-raised p-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Pill className="size-4 text-primary" /> Dispense from stock
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="disp-item">Item</Label>
            <select
              id="disp-item"
              value={itemId}
              onChange={(e) => {
                setItemId(e.target.value)
                const it = items.find((i) => i.id === e.target.value)
                if (it?.mrp != null) setPrice(String(it.mrp))
              }}
              className="h-9 w-full rounded-lg border border-edge/50 bg-background/60 px-3 text-sm shadow-nm-inset"
            >
              <option value="">— choose —</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {[i.name, i.strength, i.form].filter(Boolean).join(" ")} ({i.onHand} left)
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="disp-qty">Quantity</Label>
              <Input id="disp-qty" value={qty} onChange={(e) => setQty(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="disp-price">Unit price</Label>
              <Input id="disp-price" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
          </div>
          {selected && Number(qty) > selected.onHand && (
            <p className="text-xs text-destructive">
              Only {selected.onHand} in stock (expired batches are never counted).
            </p>
          )}
          <Button
            type="button"
            size="sm"
            disabled={pending || !itemId || !qty.trim() || !price.trim()}
            onClick={dispense}
          >
            {pending ? "Dispensing…" : "Dispense & add to bill"}
          </Button>
        </div>
      )}

      {payers.length > 0 && !hasClaim && (
        <div className="space-y-2 rounded-xl border border-edge/20 bg-card shadow-nm-raised p-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <FileHeart className="size-4 text-primary" /> Insurance claim
          </p>
          <select
            value={payerId}
            onChange={(e) => setPayerId(e.target.value)}
            aria-label="Payer"
            className="h-9 w-full rounded-lg border border-edge/50 bg-background/60 px-3 text-sm shadow-nm-inset"
          >
            <option value="">— choose payer —</option>
            {payers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <Button type="button" size="sm" variant="outline" disabled={pending || !payerId} onClick={claim}>
            {pending ? "Opening…" : "Open claim for this bill"}
          </Button>
        </div>
      )}
    </div>
  )
}

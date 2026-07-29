"use client"

import { useActionState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { toast } from "sonner"
import { Plus, Trash2 } from "lucide-react"
import { addInvoiceItem, deleteInvoiceItem } from "@/actions/billing"
import { formatINR } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export type InvoiceItem = {
  id: string
  description: string
  qty: number
  unit_price: number
}

export function InvoiceItemsEditor({
  invoiceId,
  items,
  editable,
}: {
  invoiceId: string
  items: InvoiceItem[]
  editable: boolean
}) {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const action = addInvoiceItem.bind(null, invoiceId)
  const [state, formAction, pending] = useActionState(action, undefined)
  const [deleting, startDelete] = useTransition()

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset()
      router.refresh()
    } else if (state?.error) {
      toast.error(state.error)
    }
  }, [state, router])

  return (
    <div className="space-y-3">
      <div className="divide-y divide-edge/12 rounded-xl border border-edge/15 bg-background/45 shadow-nm-inset">
        {items.map((it) => (
          <div key={it.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
            <span className="flex-1">{it.description}</span>
            <span className="text-muted-foreground">
              {it.qty} × {formatINR(it.unit_price)}
            </span>
            <span className="w-24 text-right font-medium">{formatINR(it.qty * it.unit_price)}</span>
            {editable && (
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground"
                disabled={deleting}
                onClick={() =>
                  startDelete(async () => {
                    const res = await deleteInvoiceItem(it.id, invoiceId)
                    if (res.error) toast.error(res.error)
                    else router.refresh()
                  })
                }
                aria-label="Remove item"
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
        ))}
        {!items.length && (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">No line items.</div>
        )}
      </div>

      {editable && (
        <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-2">
          <Input name="description" placeholder="Description (e.g. Dressing)" className="flex-1 min-w-40" required />
          <Input name="qty" type="number" min="1" defaultValue="1" className="w-16" aria-label="Quantity" />
          <Input name="unit_price" type="number" min="0" step="0.01" placeholder="Price" className="w-28" required />
          <Button type="submit" variant="outline" disabled={pending}>
            <Plus className="size-4" /> Add
          </Button>
        </form>
      )}
    </div>
  )
}

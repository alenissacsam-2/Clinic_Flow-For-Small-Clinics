"use client"

import { useActionState, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { recordPayment } from "@/actions/billing"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

export function RecordPaymentDialog({ invoiceId, due }: { invoiceId: string; due: number }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const action = recordPayment.bind(null, invoiceId)
  // Success side-effects run inside the action (not an effect) so React
  // doesn't re-render twice to close the dialog.
  const [state, formAction, pending] = useActionState(
    async (prev: Parameters<typeof action>[0], formData: FormData) => {
      const res = await action(prev, formData)
      if (res?.ok) {
        toast.success("Payment recorded")
        setOpen(false)
        router.refresh()
      }
      return res
    },
    undefined,
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>Record payment</Button>} />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Amount (₹)</Label>
            <Input
              id="amount"
              name="amount"
              type="number"
              step="0.01"
              min="0"
              defaultValue={due > 0 ? due : ""}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mode">Mode</Label>
            <select
              id="mode"
              name="mode"
              defaultValue="cash"
              className="h-9 w-full rounded-lg border border-edge/50 bg-background/60 px-3 text-sm shadow-nm-inset"
            >
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="card">Card</option>
              <option value="other">Other</option>
            </select>
          </div>
          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save payment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

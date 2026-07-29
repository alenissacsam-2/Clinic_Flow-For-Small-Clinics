"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { BadgeCheck } from "lucide-react"
import { confirmClaimedPayment } from "@/actions/billing"
import { Button } from "@/components/ui/button"

/** Shown when a patient has reported a UTR they paid with, awaiting doctor confirmation. */
export function PaymentClaimBanner({ invoiceId, utr }: { invoiceId: string; utr: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()

  function markReceived() {
    start(async () => {
      const res = await confirmClaimedPayment(invoiceId)
      if (res.error) toast.error(res.error)
      else {
        toast.success("Payment recorded")
        router.refresh()
      }
    })
  }

  return (
    <div className="rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm">
      <div className="flex items-start gap-2">
        <BadgeCheck className="mt-0.5 size-4 text-warning" />
        <div className="flex-1">
          <p className="font-medium text-warning">Patient reports they&apos;ve paid</p>
          <p className="text-warning">
            UTR / reference: <span className="font-mono">{utr}</span>. Confirm once you see it in your
            UPI app.
          </p>
        </div>
      </div>
      <div className="mt-3">
        <Button size="sm" disabled={pending} onClick={markReceived}>
          {pending ? "Recording…" : "Mark received"}
        </Button>
      </div>
    </div>
  )
}

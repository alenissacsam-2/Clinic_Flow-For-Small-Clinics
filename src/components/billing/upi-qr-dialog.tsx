"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import QRCode from "qrcode"
import { QrCode, Copy, Send } from "lucide-react"
import { buildUpiLink } from "@/lib/upi"
import { requestPaymentOnWhatsApp } from "@/actions/billing"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

export function UpiQrDialog({
  invoiceId,
  vpa,
  name,
  amount,
  note,
}: {
  invoiceId: string
  vpa: string
  name: string
  amount: number
  note: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const link = buildUpiLink({ vpa, name, amount, note })

  useEffect(() => {
    if (!open || !link) return
    QRCode.toDataURL(link, { width: 240, margin: 1 }).then(setDataUrl).catch(() => setDataUrl(null))
  }, [open, link])

  function requestOnWhatsApp() {
    start(async () => {
      const res = await requestPaymentOnWhatsApp(invoiceId)
      if (res.error) toast.error(res.error)
      else {
        toast.success("Payment request sent on WhatsApp")
        router.refresh()
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline">
            <QrCode className="size-4" />
            UPI QR
          </Button>
        }
      />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Collect ₹{amount.toFixed(2)} via UPI</DialogTitle>
          <DialogDescription>Patient scans the QR or taps the link in any UPI app.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4">
          {dataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={dataUrl} alt="UPI QR code" className="size-56 rounded-lg border bg-white p-2" />
          ) : (
            <div className="flex size-56 items-center justify-center rounded-lg border text-sm text-muted-foreground">
              Generating…
            </div>
          )}
          <div className="w-full rounded-md bg-muted px-3 py-2 text-center text-sm">
            {vpa}
          </div>
          <div className="flex w-full gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                navigator.clipboard.writeText(vpa)
                toast.success("UPI ID copied")
              }}
            >
              <Copy className="size-4" />
              Copy UPI ID
            </Button>
            <Button className="flex-1" disabled={pending} onClick={requestOnWhatsApp}>
              <Send className="size-4" />
              {pending ? "Sending…" : "Send on WhatsApp"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

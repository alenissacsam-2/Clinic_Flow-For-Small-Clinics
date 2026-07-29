"use client"

import { useActionState, useEffect, useState } from "react"
import QRCode from "qrcode"
import { CheckCircle2 } from "lucide-react"
import { buildUpiLink } from "@/lib/upi"
import { submitPaymentReference } from "@/actions/pay"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

export function PayWidget({
  token,
  vpa,
  name,
  amount,
  note,
  alreadyClaimed,
}: {
  token: string
  vpa: string
  name: string
  amount: number
  note: string
  alreadyClaimed: boolean
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const link = buildUpiLink({ vpa, name, amount, note })
  const action = submitPaymentReference.bind(null, token)
  const [state, formAction, pending] = useActionState(action, undefined)

  useEffect(() => {
    if (!link) return
    QRCode.toDataURL(link, { width: 240, margin: 1 }).then(setDataUrl).catch(() => setDataUrl(null))
  }, [link])

  const claimed = alreadyClaimed || state?.ok

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-3">
        {dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={dataUrl} alt="UPI QR code" className="size-56 rounded-lg border bg-white p-2" />
        ) : (
          <div className="flex size-56 items-center justify-center rounded-lg border text-sm text-muted-foreground">
            Generating…
          </div>
        )}
        <p className="text-sm text-muted-foreground">Scan with any UPI app, or</p>
        {link && (
          <a href={link} className={cn(buttonVariants())}>
            Pay ₹{amount.toFixed(2)} in your UPI app
          </a>
        )}
        <p className="text-xs text-muted-foreground">Paying to {vpa}</p>
      </div>

      <div className="border-t pt-5">
        {claimed ? (
          <div className="flex items-center gap-2 rounded-md bg-success/10 px-3 py-3 text-sm text-success">
            <CheckCircle2 className="size-5" />
            Thanks! We&apos;ve let the clinic know. They&apos;ll confirm your payment shortly.
          </div>
        ) : (
          <form action={formAction} className="space-y-3">
            <Label htmlFor="utr">Already paid? Enter your UPI reference (UTR)</Label>
            <Input id="utr" name="utr" placeholder="e.g. 412345678901" />
            {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
            <Button type="submit" variant="outline" className="w-full" disabled={pending}>
              {pending ? "Submitting…" : "I've paid — notify the clinic"}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}

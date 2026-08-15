"use client"

import { useEffect, useState } from "react"
import QRCode from "qrcode"
import { toast } from "sonner"
import { Copy, MessageCircle, QrCode } from "lucide-react"

import { whatsappBookingLink } from "@/lib/whatsapp/link"
import { Button } from "@/components/ui/button"

/**
 * The clinic's "book on WhatsApp" link, as a poster and as a link to share.
 *
 * This is the other half of clinic routing. The platform's WhatsApp number is
 * shared across every clinic, so a patient arriving cold carries no tenant —
 * the deep link is what tells the bot which practice they mean. A clinic that
 * never shares this link has a bot that can only serve patients already on file.
 *
 * Renders nothing when `NEXT_PUBLIC_WHATSAPP_NUMBER` is unset, rather than
 * showing a button that goes nowhere.
 */
export function WhatsAppBookingCard({ slug }: { slug: string }) {
  const link = whatsappBookingLink(slug)
  const [qr, setQr] = useState<string | null>(null)
  const [showQr, setShowQr] = useState(false)

  useEffect(() => {
    if (!showQr || !link || qr) return
    // Generated in the browser rather than server-side: it is derived entirely
    // from a public string, so a round trip would buy nothing.
    QRCode.toDataURL(link, { width: 512, margin: 1 }).then(setQr).catch(() => setQr(null))
  }, [showQr, link, qr])

  if (!link) return null

  async function copy() {
    try {
      await navigator.clipboard.writeText(link!)
      toast.success("Link copied")
    } catch {
      toast.error("Could not copy — select and copy the link instead.")
    }
  }

  return (
    <div className="rounded-xl border border-edge/20 bg-card p-4 text-sm shadow-nm-raised">
      <p className="flex items-center gap-2 font-medium">
        <MessageCircle className="size-4 text-primary" /> Book on WhatsApp
      </p>

      <a
        href={link}
        target="_blank"
        rel="noreferrer"
        className="mt-1 block break-all text-primary underline"
      >
        {link}
      </a>

      <p className="mt-2 text-xs text-muted-foreground">
        Share this link, or print the QR code for your reception desk. It opens WhatsApp with a
        message that tells the assistant which clinic to book — patients just press send.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={copy} className="gap-2">
          <Copy className="size-3.5" /> Copy link
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setShowQr((v) => !v)}
          className="gap-2"
        >
          <QrCode className="size-3.5" /> {showQr ? "Hide QR code" : "Show QR code"}
        </Button>
      </div>

      {showQr && (
        <div className="mt-3">
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qr}
              alt={`WhatsApp booking QR code for ${slug}`}
              className="size-44 rounded-lg border border-edge/20 bg-white p-2"
            />
          ) : (
            <p className="text-xs text-muted-foreground">Generating…</p>
          )}
        </div>
      )}
    </div>
  )
}

import { afterEach, describe, expect, it } from "vitest"

import { whatsappBookingEnabled, whatsappBookingLink, whatsappNumber } from "@/lib/whatsapp/link"
import { parseClinicCode } from "@/lib/whatsapp/bot/codec"

const ORIGINAL = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER
afterEach(() => {
  process.env.NEXT_PUBLIC_WHATSAPP_NUMBER = ORIGINAL
})

describe("WhatsApp deep links", () => {
  it("builds a wa.me link with the booking message prefilled", () => {
    process.env.NEXT_PUBLIC_WHATSAPP_NUMBER = "+91 91234 56789"
    expect(whatsappBookingLink("sunrise-clinic")).toBe(
      "https://wa.me/919123456789?text=BOOK%20sunrise-clinic",
    )
  })

  it("strips punctuation from however the number is written", () => {
    for (const raw of ["+91 91234 56789", "919123456789", "+91-91234-56789"]) {
      process.env.NEXT_PUBLIC_WHATSAPP_NUMBER = raw
      expect(whatsappNumber()).toBe("919123456789")
    }
  })

  it("returns null rather than a broken link when unconfigured", () => {
    process.env.NEXT_PUBLIC_WHATSAPP_NUMBER = ""
    expect(whatsappBookingLink("sunrise-clinic")).toBeNull()
    expect(whatsappBookingEnabled()).toBe(false)
  })

  it("round-trips: what the link prefills is what the bot parses", () => {
    // The two halves of clinic routing live in different modules and are easy
    // to drift apart. This is the contract between them.
    process.env.NEXT_PUBLIC_WHATSAPP_NUMBER = "919123456789"
    const link = whatsappBookingLink("sunrise-clinic")!
    const prefilled = decodeURIComponent(new URL(link).searchParams.get("text")!)
    expect(prefilled).toBe("BOOK sunrise-clinic")
    expect(parseClinicCode(prefilled)).toBe("sunrise-clinic")
  })
})

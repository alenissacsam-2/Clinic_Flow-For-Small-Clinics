/**
 * Deep links into the booking bot.
 *
 * The platform's Meta number is shared by every clinic on it, so a patient
 * arriving cold carries no tenant. `wa.me/<number>?text=BOOK%20<slug>` prefills
 * the message that identifies the clinic, and the patient sends it without
 * typing anything — which is what lets `parseClinicCode` insist on the `BOOK `
 * prefix instead of trying to guess a clinic from ordinary words.
 *
 * Deliberately free of `server-only` and of `serverEnv`: the number is public
 * (it is printed on posters), it is needed in client components for QR codes
 * and buttons, and `NEXT_PUBLIC_` vars are inlined at build time.
 */

/** The clinic's WhatsApp number, digits only, no `+`. Empty when unconfigured. */
export function whatsappNumber(): string {
  return (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "").replace(/\D/g, "")
}

/** True when the bot has a number to be reached on. */
export function whatsappBookingEnabled(): boolean {
  return whatsappNumber().length >= 10
}

/**
 * A `wa.me` link that opens WhatsApp with the booking message ready to send.
 *
 * Returns null rather than a broken link when no number is configured, so
 * callers render nothing instead of a button that goes nowhere.
 */
export function whatsappBookingLink(slug: string): string | null {
  const number = whatsappNumber()
  if (!number || !slug) return null
  // `encodeURIComponent` on the whole message: the space between BOOK and the
  // slug must arrive as %20, and a slug is already URL-safe by its own charset.
  return `https://wa.me/${number}?text=${encodeURIComponent(`BOOK ${slug}`)}`
}

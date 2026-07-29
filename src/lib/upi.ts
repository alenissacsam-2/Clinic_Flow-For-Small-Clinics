/** UPI deep-link helpers (pure). */

export function isValidVpa(vpa: string): boolean {
  // handle@bank — letters/digits/.-_ then @ then a provider handle.
  return /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(vpa.trim())
}

/**
 * Build a `upi://pay` deep link. Amount is fixed to 2 decimals; all fields are
 * URL-encoded. Returns null if the VPA is invalid.
 */
export function buildUpiLink(args: {
  vpa: string
  name: string
  amount: number
  note?: string
}): string | null {
  if (!isValidVpa(args.vpa)) return null
  const params = new URLSearchParams({
    pa: args.vpa.trim(),
    pn: args.name.trim() || "Clinic",
    am: args.amount.toFixed(2),
    cu: "INR",
  })
  if (args.note) params.set("tn", args.note)
  return `upi://pay?${params.toString()}`
}

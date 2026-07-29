"use server"

import { createClient } from "@/lib/supabase/server"

export type PayState = { error?: string; ok?: boolean } | undefined

/** Public: the patient reports the UTR/reference they paid with (a claim). */
export async function submitPaymentReference(
  token: string,
  _prev: PayState,
  formData: FormData,
): Promise<PayState> {
  const utr = String(formData.get("utr") ?? "").trim()
  if (!/^[A-Za-z0-9]{6,30}$/.test(utr)) {
    return { error: "Enter the UPI reference / UTR number (6–30 letters or digits)." }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc("submit_payment_reference", {
    p_token: token,
    p_utr: utr,
  })
  if (error) return { error: "Something went wrong. Please try again." }
  const res = data as { ok?: boolean; error?: string } | null
  if (!res?.ok) {
    if (res?.error === "not_payable") return { error: "This invoice is already settled." }
    if (res?.error === "invalid_utr") return { error: "That reference doesn't look right." }
    return { error: "Could not submit. Please try again." }
  }
  return { ok: true }
}

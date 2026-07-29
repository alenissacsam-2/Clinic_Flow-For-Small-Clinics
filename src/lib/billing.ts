import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"
import { clinicSettings, type Clinic } from "@/lib/clinic"

type DB = SupabaseClient<Database>

/** Recompute an invoice's total from its items and status from its payments. */
export async function recomputeInvoice(supabase: DB, invoiceId: string): Promise<void> {
  const [{ data: items }, { data: payments }, { data: inv }] = await Promise.all([
    supabase.from("invoice_items").select("qty, unit_price").eq("invoice_id", invoiceId),
    supabase.from("payments").select("amount").eq("invoice_id", invoiceId),
    supabase.from("invoices").select("status").eq("id", invoiceId).maybeSingle(),
  ])

  if (inv?.status === "void") return

  const total = (items ?? []).reduce((s, i) => s + i.qty * Number(i.unit_price), 0)
  const paid = (payments ?? []).reduce((s, p) => s + Number(p.amount), 0)

  let status: Database["public"]["Enums"]["invoice_status"] = "unpaid"
  if (total > 0 && paid >= total) status = "paid"
  else if (paid > 0) status = "partial"

  await supabase
    .from("invoices")
    .update({ total_amount: total, status })
    .eq("id", invoiceId)
}

/**
 * Ensure a visit has a draft invoice seeded with the consultation fee.
 * Idempotent — returns the existing invoice id if one already exists.
 */
export async function ensureInvoiceForVisit(
  supabase: DB,
  clinic: Clinic,
  visitId: string,
  patientId: string,
): Promise<string | null> {
  const { data: existing } = await supabase
    .from("invoices")
    .select("id")
    .eq("visit_id", visitId)
    .maybeSingle()
  if (existing) return existing.id

  const { data: no } = await supabase.rpc("next_invoice_no", { p_clinic: clinic.id })
  if (!no) return null

  const fee = clinicSettings(clinic).consultation_fee
  const { data: invoice, error } = await supabase
    .from("invoices")
    .insert({
      clinic_id: clinic.id,
      patient_id: patientId,
      visit_id: visitId,
      invoice_no: no,
      status: "unpaid",
      total_amount: fee,
    })
    .select("id")
    .single()
  if (error || !invoice) return null

  if (fee > 0) {
    await supabase.from("invoice_items").insert({
      invoice_id: invoice.id,
      description: "Consultation",
      qty: 1,
      unit_price: fee,
    })
  }
  return invoice.id
}

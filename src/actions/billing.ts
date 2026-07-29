"use server"

import { randomBytes } from "crypto"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { requireClinic, clinicSettings } from "@/lib/clinic"
import { ownsRef, FOREIGN_REF_ERROR } from "@/lib/ownership"
import { env } from "@/lib/env"
import { recomputeInvoice } from "@/lib/billing"
import { enqueueWhatsApp } from "@/lib/whatsapp/enqueue"
import { notifyPaymentReceipt } from "@/lib/whatsapp/triggers"

type Result = { error?: string; ok?: boolean }

const itemSchema = z.object({
  description: z.string().trim().min(1, "Description required"),
  qty: z.coerce.number().int().min(1).default(1),
  unit_price: z.coerce.number().min(0),
})

export async function addInvoiceItem(
  invoiceId: string,
  _prev: Result | undefined,
  formData: FormData,
): Promise<Result> {
  const clinic = await requireClinic()
  const parsed = itemSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the item." }

  const supabase = await createClient()
  // `invoice_items` is scoped through its parent, so RLS already refuses a
  // foreign invoice — but it refuses with a raw policy-violation string. Ask
  // first so the doctor gets a sentence instead of Postgres internals.
  if (!(await ownsRef(supabase, clinic.id, "invoices", invoiceId))) {
    return { error: FOREIGN_REF_ERROR }
  }

  const { error } = await supabase.from("invoice_items").insert({
    invoice_id: invoiceId,
    description: parsed.data.description,
    qty: parsed.data.qty,
    unit_price: parsed.data.unit_price,
  })
  if (error) return { error: error.message }
  await recomputeInvoice(supabase, invoiceId)
  revalidatePath(`/billing/${invoiceId}`)
  revalidatePath("/billing")
  return { ok: true }
}

export async function deleteInvoiceItem(itemId: string, invoiceId: string): Promise<Result> {
  const clinic = await requireClinic()
  const supabase = await createClient()
  if (!(await ownsRef(supabase, clinic.id, "invoices", invoiceId))) {
    return { error: FOREIGN_REF_ERROR }
  }
  const { error } = await supabase.from("invoice_items").delete().eq("id", itemId)
  if (error) return { error: error.message }
  await recomputeInvoice(supabase, invoiceId)
  revalidatePath(`/billing/${invoiceId}`)
  return { ok: true }
}

const paymentSchema = z.object({
  amount: z.coerce.number().positive("Enter an amount"),
  mode: z.enum(["cash", "upi", "card", "other"]),
  utr_reference: z.string().trim().max(30).optional(),
})

/** Shared: insert a payment, recompute, and send the receipt when fully paid. */
async function insertPayment(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clinic: Awaited<ReturnType<typeof requireClinic>>,
  invoiceId: string,
  amount: number,
  mode: "cash" | "upi" | "card" | "other",
  utr?: string | null,
): Promise<Result> {
  // `invoice_id` arrives from the client while `clinic_id` is ours, so the
  // `tenant_all` policy on `payments` waves the row through — it only ever
  // checks the clinic_id being written. A forged invoice id would file a real
  // payment in our own books against someone else's invoice: our revenue
  // inflates by an amount we chose, and the row can never be reconciled because
  // the invoice it points at is invisible to us. See src/lib/ownership.ts.
  if (!(await ownsRef(supabase, clinic.id, "invoices", invoiceId))) {
    return { error: FOREIGN_REF_ERROR }
  }

  const { data: payment, error } = await supabase
    .from("payments")
    .insert({
      clinic_id: clinic.id,
      invoice_id: invoiceId,
      amount,
      mode,
      utr_reference: utr || null,
    })
    .select("id")
    .single()
  if (error) return { error: error.message }

  await recomputeInvoice(supabase, invoiceId)

  const { data: inv } = await supabase
    .from("invoices")
    .select("status, patient:patients(id, full_name, phone)")
    .eq("id", invoiceId)
    .maybeSingle()
  const invoice = inv as unknown as {
    status: string
    patient: { id: string; full_name: string; phone: string } | null
  } | null

  if (invoice?.status === "paid") {
    // Clear any pending patient UTR claim now the invoice is settled.
    await supabase.from("invoices").update({ claimed_utr: null, claimed_at: null }).eq("id", invoiceId)
    if (invoice.patient) {
      await notifyPaymentReceipt(supabase, clinic, {
        patient: invoice.patient,
        amount,
        receiptPath: null,
        paymentId: payment.id,
      })
    }
  }

  revalidatePath(`/billing/${invoiceId}`)
  revalidatePath("/billing")
  revalidatePath("/reports")
  return { ok: true }
}

export async function recordPayment(
  invoiceId: string,
  _prev: Result | undefined,
  formData: FormData,
): Promise<Result> {
  const clinic = await requireClinic()
  const parsed = paymentSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the payment." }

  const supabase = await createClient()
  return insertPayment(
    supabase,
    clinic,
    invoiceId,
    parsed.data.amount,
    parsed.data.mode,
    parsed.data.utr_reference,
  )
}

/** Ensure the invoice has a public pay token; returns it. */
async function ensurePayToken(
  supabase: Awaited<ReturnType<typeof createClient>>,
  invoiceId: string,
  existing: string | null,
): Promise<string> {
  if (existing) return existing
  const token = randomBytes(18).toString("base64url")
  await supabase.from("invoices").update({ pay_token: token }).eq("id", invoiceId)
  return token
}

/** Send the patient a UPI payment request on WhatsApp with a link to the pay page. */
export async function requestPaymentOnWhatsApp(invoiceId: string): Promise<Result> {
  const clinic = await requireClinic()
  const settings = clinicSettings(clinic)
  if (!settings.upi_vpa) return { error: "Add your UPI ID in Settings first." }

  const supabase = await createClient()
  const { data: inv } = await supabase
    .from("invoices")
    .select("id, invoice_no, total_amount, status, pay_token, patient:patients(id, full_name, phone)")
    .eq("id", invoiceId)
    .maybeSingle()
  const invoice = inv as unknown as {
    id: string
    invoice_no: string
    total_amount: number
    status: string
    pay_token: string | null
    patient: { id: string; full_name: string; phone: string } | null
  } | null
  if (!invoice?.patient) return { error: "No patient on this invoice." }
  if (invoice.status === "paid" || invoice.status === "void") return { error: "This invoice is already settled." }

  const { data: pays } = await supabase.from("payments").select("amount").eq("invoice_id", invoiceId)
  const paid = (pays ?? []).reduce((s, p) => s + Number(p.amount), 0)
  const due = Math.max(0, Number(invoice.total_amount) - paid)
  if (due <= 0) return { error: "Nothing due on this invoice." }

  const token = await ensurePayToken(supabase, invoiceId, invoice.pay_token)

  await enqueueWhatsApp(supabase, {
    clinicId: clinic.id,
    patientId: invoice.patient.id,
    toPhone: invoice.patient.phone,
    template: "payment_request",
    lang: settings.template_lang,
    values: [
      invoice.patient.full_name,
      due.toFixed(2),
      clinic.name,
      `${env.appUrl}/pay/${token}`,
    ],
    relatedType: "invoice",
    relatedId: invoice.id,
  })

  revalidatePath(`/billing/${invoiceId}`)
  return { ok: true }
}

/** Doctor confirms a UPI payment they saw land (optionally against the patient's UTR claim). */
export async function confirmClaimedPayment(invoiceId: string): Promise<Result> {
  const clinic = await requireClinic()
  const supabase = await createClient()
  const { data: inv } = await supabase
    .from("invoices")
    .select("total_amount, status, claimed_utr")
    .eq("id", invoiceId)
    .maybeSingle()
  if (!inv) return { error: "Invoice not found." }
  if (inv.status === "paid" || inv.status === "void") return { error: "Already settled." }

  const { data: pays } = await supabase.from("payments").select("amount").eq("invoice_id", invoiceId)
  const paid = (pays ?? []).reduce((s, p) => s + Number(p.amount), 0)
  const due = Math.max(0, Number(inv.total_amount) - paid)
  if (due <= 0) return { error: "Nothing due." }

  return insertPayment(supabase, clinic, invoiceId, due, "upi", inv.claimed_utr)
}

export async function voidInvoice(invoiceId: string): Promise<Result> {
  const clinic = await requireClinic()
  const supabase = await createClient()
  if (!(await ownsRef(supabase, clinic.id, "invoices", invoiceId))) {
    return { error: FOREIGN_REF_ERROR }
  }
  const { error } = await supabase.from("invoices").update({ status: "void" }).eq("id", invoiceId)
  if (error) return { error: error.message }
  revalidatePath(`/billing/${invoiceId}`)
  revalidatePath("/billing")
  return { ok: true }
}

"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { requireClinic } from "@/lib/clinic"
import { firstForeignRef, FOREIGN_REF_ERROR } from "@/lib/ownership"
import { CLAIM_STATUSES, type ClaimStatus } from "@/lib/insurance"
import type { Database } from "@/types/database"

type ClaimUpdate = Database["public"]["Tables"]["claims"]["Update"]

export type InsuranceState = { error?: string; ok?: boolean; id?: string }

const num = (v: unknown): number | null => {
  const t = String(v ?? "").trim()
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

export async function createPayer(input: {
  name: string
  kind?: string
  code?: string
  contact?: string
}): Promise<InsuranceState> {
  const clinic = await requireClinic()
  const name = input.name.trim()
  if (!name) return { error: "Give the payer a name." }

  const kind = ["insurer", "tpa", "government", "corporate"].includes(input.kind ?? "")
    ? input.kind!
    : "tpa"

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("payers")
    .insert({
      clinic_id: clinic.id,
      name,
      kind,
      code: input.code?.trim() || null,
      contact: input.contact?.trim() || null,
    })
    .select("id")
    .single()

  if (error) {
    return { error: error.code === "23505" ? "That payer is already on your list." : error.message }
  }
  revalidatePath("/insurance")
  return { ok: true, id: data.id }
}

/** Open a claim against an invoice. */
export async function createClaim(input: {
  patientId: string
  payerId: string
  invoiceId?: string | null
  policyId?: string | null
  claimNo?: string
  claimedAmount?: string
}): Promise<InsuranceState> {
  const clinic = await requireClinic()
  if (!input.payerId) return { error: "Choose a payer." }

  const supabase = await createClient()

  // Patient, payer, policy and invoice ids all arrive from the browser.
  const foreign = await firstForeignRef(supabase, clinic.id, [
    ["patients", input.patientId],
    ["payers", input.payerId],
    ["patient_policies", input.policyId],
    ["invoices", input.invoiceId],
  ])
  if (foreign) return { error: FOREIGN_REF_ERROR }

  // Default the claim to the invoice total — the usual case is claiming the
  // whole bill, and a wrong number here is worse than a blank one.
  let claimed = num(input.claimedAmount)
  if (claimed == null && input.invoiceId) {
    const { data: inv } = await supabase
      .from("invoices")
      .select("total_amount")
      .eq("id", input.invoiceId)
      .maybeSingle()
    claimed = inv ? Number(inv.total_amount) : 0
  }

  const { data, error } = await supabase
    .from("claims")
    .insert({
      clinic_id: clinic.id,
      patient_id: input.patientId,
      payer_id: input.payerId,
      policy_id: input.policyId || null,
      invoice_id: input.invoiceId || null,
      claim_no: input.claimNo?.trim() || null,
      status: "draft",
      claimed_amount: claimed ?? 0,
    })
    .select("id")
    .single()

  if (error) return { error: error.message }

  await supabase.from("claim_events").insert({
    claim_id: data.id,
    status: "draft",
    amount: claimed ?? 0,
    note: "Claim opened",
  })

  revalidatePath("/insurance")
  if (input.invoiceId) revalidatePath(`/billing/${input.invoiceId}`)
  return { ok: true, id: data.id }
}

/**
 * Move a claim to a new status, recording an event.
 *
 * Every transition writes to `claim_events`, so a claim that was queried and
 * resubmitted twice reads as the conversation it actually was rather than as
 * whatever state it happens to be in now.
 */
export async function advanceClaim(input: {
  claimId: string
  status: string
  amount?: string
  preauthNo?: string
  claimNo?: string
  note?: string
}): Promise<InsuranceState> {
  await requireClinic()
  if (!(CLAIM_STATUSES as readonly string[]).includes(input.status)) {
    return { error: "Unknown claim status." }
  }
  const status = input.status as ClaimStatus
  const amount = num(input.amount)

  const supabase = await createClient()
  const { data: claim } = await supabase
    .from("claims")
    .select("id, invoice_id, claimed_amount")
    .eq("id", input.claimId)
    .maybeSingle()
  if (!claim) return { error: "Claim not found." }

  const patch: ClaimUpdate = { status }
  if (input.preauthNo?.trim()) patch.preauth_no = input.preauthNo.trim()
  if (input.claimNo?.trim()) patch.claim_no = input.claimNo.trim()
  if (input.note?.trim()) patch.note = input.note.trim()

  // The three money columns mean different things and are never derived from
  // one another: a payer can approve less than claimed and settle less than
  // approved, and both shortfalls are the clinic's to chase.
  if (amount != null) {
    if (status === "preauth_approved" || status === "approved") patch.approved_amount = amount
    if (status === "settled") patch.settled_amount = amount
  }
  if (status === "submitted") patch.submitted_at = new Date().toISOString()
  if (status === "settled") {
    patch.settled_at = new Date().toISOString()
    const settled = amount ?? Number(claim.claimed_amount)
    patch.patient_payable = Math.max(0, Number(claim.claimed_amount) - settled)
  }

  const { error } = await supabase.from("claims").update(patch).eq("id", input.claimId)
  if (error) return { error: error.message }

  await supabase.from("claim_events").insert({
    claim_id: input.claimId,
    status,
    amount,
    note: input.note?.trim() || null,
  })

  revalidatePath("/insurance")
  if (claim.invoice_id) revalidatePath(`/billing/${claim.invoice_id}`)
  return { ok: true }
}

export async function addPatientPolicy(input: {
  patientId: string
  payerId: string
  policyNo: string
  memberId?: string
  validTo?: string
  sumInsured?: string
}): Promise<InsuranceState> {
  const clinic = await requireClinic()
  const policyNo = input.policyNo.trim()
  if (!policyNo) return { error: "Enter the policy number." }

  const supabase = await createClient()

  const foreign = await firstForeignRef(supabase, clinic.id, [
    ["patients", input.patientId],
    ["payers", input.payerId],
  ])
  if (foreign) return { error: FOREIGN_REF_ERROR }

  const { data, error } = await supabase
    .from("patient_policies")
    .insert({
      clinic_id: clinic.id,
      patient_id: input.patientId,
      payer_id: input.payerId,
      policy_no: policyNo,
      member_id: input.memberId?.trim() || null,
      valid_to: input.validTo?.trim() || null,
      sum_insured: num(input.sumInsured),
    })
    .select("id")
    .single()

  if (error) {
    return { error: error.code === "23505" ? "That policy is already recorded." : error.message }
  }
  revalidatePath(`/patients/${input.patientId}`)
  return { ok: true, id: data.id }
}

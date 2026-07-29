"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { requireClinic } from "@/lib/clinic"
import { firstForeignRef, FOREIGN_REF_ERROR } from "@/lib/ownership"
import { parseResultNumber, flagResult } from "@/lib/clinical/lab-result"

export type LabState = { error?: string; ok?: boolean; orderId?: string }

export type LabResultInput = {
  id: string
  valueText: string
  unit: string
  referenceLow: string
  referenceHigh: string
  referenceText: string
  note: string
}

const num = (s: string): number | null => {
  const t = s.trim()
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

/** Order one or more tests, snapshotting name and LOINC at order time. */
export async function createLabOrder(input: {
  patientId: string
  visitId?: string | null
  testIds: string[]
  labName?: string
  note?: string
}): Promise<LabState> {
  const clinic = await requireClinic()
  const testIds = [...new Set(input.testIds.filter(Boolean))]
  if (testIds.length === 0) return { error: "Choose at least one test." }

  const supabase = await createClient()

  // patientId and visitId arrive from the browser; RLS only vets the order's
  // own clinic_id, so prove the targets are ours before pointing at them.
  const foreign = await firstForeignRef(supabase, clinic.id, [
    ["patients", input.patientId],
    ["visits", input.visitId],
  ])
  if (foreign) return { error: FOREIGN_REF_ERROR }

  const { data: tests } = await supabase
    .from("lab_tests")
    .select("id, name, loinc_code, unit")
    .in("id", testIds)
  if (!tests || tests.length === 0) return { error: "Those tests are no longer available." }

  const { data: order, error: orderErr } = await supabase
    .from("lab_orders")
    .insert({
      clinic_id: clinic.id,
      patient_id: input.patientId,
      visit_id: input.visitId || null,
      status: "ordered",
      lab_name: input.labName?.trim() || null,
      note: input.note?.trim() || null,
    })
    .select("id")
    .single()
  if (orderErr || !order) return { error: orderErr?.message ?? "Could not create the order." }

  // Preserve the order the doctor picked them in.
  const byId = new Map(tests.map((t) => [t.id, t]))
  const rows = testIds
    .map((id, i) => {
      const t = byId.get(id)
      if (!t) return null
      return {
        order_id: order.id,
        lab_test_id: t.id,
        position: i,
        test_name: t.name,
        loinc_code: t.loinc_code,
        unit: t.unit,
      }
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)

  const { error: itemsErr } = await supabase.from("lab_order_items").insert(rows)
  if (itemsErr) {
    await supabase.from("lab_orders").delete().eq("id", order.id)
    return { error: itemsErr.message }
  }

  revalidatePath(`/patients/${input.patientId}`)
  return { ok: true, orderId: order.id }
}

/**
 * Record results against an order.
 *
 * The high/low flag is computed here, server-side, purely from the reference
 * range the clinic typed off the lab's own report — see
 * `src/lib/clinical/lab-result.ts`. No range entered means no flag; ClinicFlow
 * never supplies a threshold of its own.
 */
export async function saveLabResults(
  orderId: string,
  results: LabResultInput[],
): Promise<LabState> {
  await requireClinic()
  const supabase = await createClient()

  const { data: order } = await supabase
    .from("lab_orders")
    .select("id, patient_id")
    .eq("id", orderId)
    .maybeSingle()
  if (!order) return { error: "Order not found." }

  let anyResult = false

  for (const r of results) {
    const low = num(r.referenceLow)
    const high = num(r.referenceHigh)
    const parsed = parseResultNumber(r.valueText)
    const valueText = r.valueText.trim()
    if (valueText) anyResult = true

    const { error } = await supabase
      .from("lab_order_items")
      .update({
        value_text: valueText || null,
        // Only a cleanly parsed, uncensored number is stored numerically —
        // "<0.01" must not become 0.01 in a trend line.
        value_number: parsed && parsed.comparator === null ? parsed.value : null,
        unit: r.unit.trim() || null,
        reference_low: low,
        reference_high: high,
        reference_text: r.referenceText.trim() || null,
        flag: flagResult(parsed, low, high),
        note: r.note.trim() || null,
      })
      .eq("id", r.id)
      .eq("order_id", orderId)

    if (error) return { error: error.message }
  }

  if (anyResult) {
    await supabase
      .from("lab_orders")
      .update({ status: "resulted", resulted_at: new Date().toISOString() })
      .eq("id", orderId)
  }

  revalidatePath(`/patients/${order.patient_id}`)
  return { ok: true }
}

export async function setLabOrderStatus(
  orderId: string,
  status: "ordered" | "collected" | "resulted" | "cancelled",
): Promise<LabState> {
  await requireClinic()
  const supabase = await createClient()
  const { data: order } = await supabase
    .from("lab_orders")
    .select("patient_id")
    .eq("id", orderId)
    .maybeSingle()
  if (!order) return { error: "Order not found." }

  const { error } = await supabase.from("lab_orders").update({ status }).eq("id", orderId)
  if (error) return { error: error.message }
  revalidatePath(`/patients/${order.patient_id}`)
  return { ok: true }
}

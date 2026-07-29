"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { requireClinic } from "@/lib/clinic"
import { firstForeignRef, FOREIGN_REF_ERROR } from "@/lib/ownership"
import { recomputeInvoice } from "@/lib/billing"
import { allocateFefo, isExpired, type StockBatch } from "@/lib/pharmacy/stock"
import { istDateKey } from "@/lib/format"

export type PharmacyState = { error?: string; ok?: boolean; id?: string }

const num = (v: unknown): number | null => {
  const n = Number(String(v ?? "").trim())
  return Number.isFinite(n) ? n : null
}

export async function createInventoryItem(input: {
  name: string
  form?: string
  strength?: string
  unit?: string
  hsnCode?: string
  gstRate?: string
  reorderLevel?: string
}): Promise<PharmacyState> {
  const clinic = await requireClinic()
  const name = input.name.trim()
  if (!name) return { error: "Give the item a name." }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("inventory_items")
    .insert({
      clinic_id: clinic.id,
      name,
      form: input.form?.trim() || null,
      strength: input.strength?.trim() || null,
      unit: input.unit?.trim() || "unit",
      hsn_code: input.hsnCode?.trim() || null,
      gst_rate: num(input.gstRate) ?? 0,
      reorder_level: Math.max(0, Math.floor(num(input.reorderLevel) ?? 0)),
    })
    .select("id")
    .single()

  if (error) {
    return {
      error: error.code === "23505" ? "That item is already in your stock list." : error.message,
    }
  }
  revalidatePath("/pharmacy")
  return { ok: true, id: data.id }
}

/**
 * Receive a batch into stock. Every receipt writes both the batch and a
 * `receipt` movement — the batch is the balance, the movement is the history,
 * and a balance nobody can explain is worse than no balance at all.
 */
export async function receiveStock(input: {
  itemId: string
  batchNo: string
  expiryDate?: string
  qty: string
  costPrice?: string
  mrp?: string
}): Promise<PharmacyState> {
  const clinic = await requireClinic()
  const batchNo = input.batchNo.trim()
  const qty = Math.floor(num(input.qty) ?? 0)

  if (!batchNo) return { error: "Enter the batch number." }
  if (qty <= 0) return { error: "Quantity must be more than zero." }

  const expiry = input.expiryDate?.trim() || null
  // Receiving already-expired stock is almost always a typo, and letting it in
  // would put a batch on the shelf that FEFO will refuse to dispense.
  if (expiry && isExpired({ expiryDate: expiry }, istDateKey())) {
    return { error: "That expiry date has already passed." }
  }

  const supabase = await createClient()

  const foreign = await firstForeignRef(supabase, clinic.id, [["inventory_items", input.itemId]])
  if (foreign) return { error: FOREIGN_REF_ERROR }

  const { data: batch, error } = await supabase
    .from("stock_batches")
    .insert({
      clinic_id: clinic.id,
      item_id: input.itemId,
      batch_no: batchNo,
      expiry_date: expiry,
      qty_received: qty,
      qty_available: qty,
      cost_price: num(input.costPrice),
      mrp: num(input.mrp),
    })
    .select("id")
    .single()

  if (error) {
    return {
      error:
        error.code === "23505"
          ? "That batch is already recorded. Use an adjustment to correct the quantity."
          : error.message,
    }
  }

  await supabase.from("stock_movements").insert({
    clinic_id: clinic.id,
    item_id: input.itemId,
    batch_id: batch.id,
    kind: "receipt",
    qty,
    note: `Received batch ${batchNo}`,
  })

  revalidatePath("/pharmacy")
  return { ok: true, id: batch.id }
}

/**
 * Dispense against an invoice.
 *
 * Order matters: allocate first and refuse a short fill *before* touching the
 * bill, so a patient is never charged for stock the clinic does not have. The
 * bill line is created next because the database will not accept a dispense
 * without one, and the batch decrements happen in a single transaction inside
 * `dispense_stock` so a mid-way shortfall rolls the whole thing back.
 */
export async function dispenseToInvoice(input: {
  invoiceId: string
  itemId: string
  qty: string
  unitPrice: string
}): Promise<PharmacyState> {
  const clinic = await requireClinic()
  const qty = Math.floor(num(input.qty) ?? 0)
  const unitPrice = num(input.unitPrice)

  if (qty <= 0) return { error: "Quantity must be more than zero." }
  if (unitPrice == null || unitPrice < 0) return { error: "Enter a price." }

  const supabase = await createClient()

  // Both ids come from the dispense form. The invoice matters most: a bill
  // line written against another clinic's invoice would charge their patient.
  const foreign = await firstForeignRef(supabase, clinic.id, [
    ["invoices", input.invoiceId],
    ["inventory_items", input.itemId],
  ])
  if (foreign) return { error: FOREIGN_REF_ERROR }

  const [{ data: item }, { data: batchRows }] = await Promise.all([
    supabase
      .from("inventory_items")
      .select("id, name, form, strength, unit")
      .eq("id", input.itemId)
      .maybeSingle(),
    supabase
      .from("stock_batches")
      .select("id, batch_no, expiry_date, qty_available")
      .eq("item_id", input.itemId)
      .gt("qty_available", 0),
  ])

  if (!item) return { error: "Item not found." }

  const batches: StockBatch[] = (batchRows ?? []).map((b) => ({
    id: b.id,
    batchNo: b.batch_no,
    expiryDate: b.expiry_date,
    qtyAvailable: b.qty_available,
  }))

  const { allocations, shortfall, skippedExpired } = allocateFefo(batches, qty, istDateKey())

  if (shortfall > 0) {
    const expiredNote =
      skippedExpired.length > 0
        ? ` (${skippedExpired.length} expired batch${skippedExpired.length === 1 ? "" : "es"} was not used)`
        : ""
    return { error: `Only ${qty - shortfall} of ${qty} in stock${expiredNote}.` }
  }

  const label = [item.name, item.strength, item.form].filter(Boolean).join(" ")

  const { data: line, error: lineErr } = await supabase
    .from("invoice_items")
    .insert({
      invoice_id: input.invoiceId,
      description: label,
      qty,
      unit_price: unitPrice,
    })
    .select("id")
    .single()

  if (lineErr || !line) return { error: lineErr?.message ?? "Could not add the bill line." }

  const { error: dispErr } = await supabase.rpc("dispense_stock", {
    p_allocations: allocations.map((a) => ({ batch_id: a.batchId, qty: a.qty })),
    p_invoice_item_id: line.id,
    p_invoice_id: input.invoiceId,
  })

  if (dispErr) {
    // The whole dispense rolled back inside the function, so the bill line is
    // the only thing left to undo — otherwise the patient is charged for
    // stock that never moved.
    await supabase.from("invoice_items").delete().eq("id", line.id)
    return { error: dispErr.message }
  }

  await recomputeInvoice(supabase, input.invoiceId)
  revalidatePath(`/billing/${input.invoiceId}`)
  revalidatePath("/pharmacy")
  void clinic
  return { ok: true }
}

/** Write off a batch that has expired on the shelf. */
export async function writeOffBatch(batchId: string, note?: string): Promise<PharmacyState> {
  const clinic = await requireClinic()
  const supabase = await createClient()

  const { data: batch } = await supabase
    .from("stock_batches")
    .select("id, item_id, qty_available, batch_no")
    .eq("id", batchId)
    .maybeSingle()
  if (!batch) return { error: "Batch not found." }
  if (batch.qty_available <= 0) return { error: "Nothing left in that batch." }

  const { error } = await supabase
    .from("stock_batches")
    .update({ qty_available: 0 })
    .eq("id", batchId)
  if (error) return { error: error.message }

  await supabase.from("stock_movements").insert({
    clinic_id: clinic.id,
    item_id: batch.item_id,
    batch_id: batchId,
    kind: "expiry_writeoff",
    qty: -batch.qty_available,
    note: note?.trim() || `Wrote off expired batch ${batch.batch_no}`,
  })

  revalidatePath("/pharmacy")
  return { ok: true }
}

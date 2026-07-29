"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { requireClinic } from "@/lib/clinic"
import { cancelWithNotify } from "@/actions/appointments"
import { istDateTimeToUtc, istDayRangeUtc, IST_TZ } from "@/lib/format"
import { formatInTimeZone } from "date-fns-tz"

export type AffectedAppt = { id: string; name: string; time: string; token: number | null }
export type BlockPreview = {
  affected: AffectedAppt[] // will be cancelled + notified
  keptCount: number // completed / in_progress / no_show inside the window (left alone)
}
export type BlockResult = { error?: string; ok?: boolean }

const HHMM = /^\d{2}:\d{2}$/
const dateKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

type Window = { startUtc: Date; endUtc: Date }

/** Resolve the UTC window being blocked (whole day, or an IST time range). */
function resolveWindow(dateKey: string, wholeDay: boolean, startTime?: string, endTime?: string): Window {
  if (wholeDay) {
    const { start, end } = istDayRangeUtc(dateKey)
    return { startUtc: start, endUtc: end }
  }
  return {
    startUtc: istDateTimeToUtc(dateKey, startTime!),
    endUtc: istDateTimeToUtc(dateKey, endTime!),
  }
}

const previewSchema = z.object({
  dateKey: dateKeySchema,
  wholeDay: z.boolean(),
  startTime: z.string().regex(HHMM).optional(),
  endTime: z.string().regex(HHMM).optional(),
})

/** What happens if we block this window: which appointments get cancelled vs kept. */
export async function previewBlockImpact(input: {
  dateKey: string
  wholeDay: boolean
  startTime?: string
  endTime?: string
}): Promise<BlockPreview> {
  const clinic = await requireClinic()
  const parsed = previewSchema.safeParse(input)
  if (!parsed.success) return { affected: [], keptCount: 0 }
  const v = parsed.data
  if (!v.wholeDay && (!v.startTime || !v.endTime || v.startTime >= v.endTime)) {
    return { affected: [], keptCount: 0 }
  }

  const { startUtc, endUtc } = resolveWindow(v.dateKey, v.wholeDay, v.startTime, v.endTime)
  const supabase = await createClient()
  const { data } = await supabase
    .from("appointments")
    .select("id, starts_at, status, token_number, patient:patients(full_name)")
    .eq("clinic_id", clinic.id)
    .gte("starts_at", startUtc.toISOString())
    .lt("starts_at", endUtc.toISOString())
    .order("starts_at", { ascending: true })

  type Row = {
    id: string
    starts_at: string
    status: string
    token_number: number | null
    patient: { full_name: string } | null
  }
  const rows = (data ?? []) as unknown as Row[]

  const cancellable = new Set(["pending", "confirmed", "arrived"])
  const affected: AffectedAppt[] = []
  let keptCount = 0
  for (const r of rows) {
    if (cancellable.has(r.status)) {
      affected.push({
        id: r.id,
        name: r.patient?.full_name ?? "Unknown",
        time: formatInTimeZone(new Date(r.starts_at), IST_TZ, "hh:mm a"),
        token: r.token_number,
      })
    } else if (r.status === "completed" || r.status === "in_progress" || r.status === "no_show") {
      keptCount += 1
    }
  }
  return { affected, keptCount }
}

const applySchema = z.object({
  dateKey: dateKeySchema,
  wholeDay: z.boolean(),
  startTime: z.string().regex(HHMM).optional(),
  endTime: z.string().regex(HHMM).optional(),
  reason: z.string().max(120).optional(),
  cancelIds: z.array(z.string().uuid()).default([]),
})

/** Apply a block (whole day → override; else slot_blocks row) and cancel+notify the given appts. */
export async function applyBlock(input: {
  dateKey: string
  wholeDay: boolean
  startTime?: string
  endTime?: string
  reason?: string
  cancelIds: string[]
}): Promise<BlockResult> {
  const clinic = await requireClinic()
  const parsed = applySchema.safeParse(input)
  if (!parsed.success) return { error: "Check the block details." }
  const v = parsed.data
  if (!v.wholeDay && (!v.startTime || !v.endTime || v.startTime >= v.endTime)) {
    return { error: "Enter a valid start and end time." }
  }

  const supabase = await createClient()

  if (v.wholeDay) {
    const { error } = await supabase
      .from("availability_overrides")
      .upsert(
        { clinic_id: clinic.id, date: v.dateKey, closed: true, start_time: null, end_time: null },
        { onConflict: "clinic_id,date" },
      )
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase.from("slot_blocks").insert({
      clinic_id: clinic.id,
      date: v.dateKey,
      start_time: v.startTime!,
      end_time: v.endTime!,
      reason: v.reason?.trim() || null,
    })
    if (error) return { error: error.message }
  }

  // Cancel + notify each affected appointment.
  for (const id of v.cancelIds) {
    const res = await cancelWithNotify(supabase, clinic, id)
    if (res.error) return { error: res.error }
  }

  revalidatePath("/calendar")
  revalidatePath("/today")
  return { ok: true }
}

/** Remove a single slot block. */
export async function removeBlock(blockId: string): Promise<BlockResult> {
  const clinic = await requireClinic()
  if (!z.string().uuid().safeParse(blockId).success) return { error: "Invalid block." }
  const supabase = await createClient()
  const { error } = await supabase
    .from("slot_blocks")
    .delete()
    .eq("id", blockId)
    .eq("clinic_id", clinic.id)
  if (error) return { error: error.message }
  revalidatePath("/calendar")
  return { ok: true }
}

/** Re-open a whole day that was closed via an override. */
export async function reopenDay(dateKey: string): Promise<BlockResult> {
  const clinic = await requireClinic()
  if (!dateKeySchema.safeParse(dateKey).success) return { error: "Invalid date." }
  const supabase = await createClient()
  const { error } = await supabase
    .from("availability_overrides")
    .delete()
    .eq("clinic_id", clinic.id)
    .eq("date", dateKey)
  if (error) return { error: error.message }
  revalidatePath("/calendar")
  return { ok: true }
}

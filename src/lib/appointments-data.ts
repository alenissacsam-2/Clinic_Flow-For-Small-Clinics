import "server-only"
import { createClient } from "@/lib/supabase/server"
import { clinicSettings, type Clinic } from "@/lib/clinic"
import { istDayRangeUtc, IST_TZ } from "@/lib/format"
import { formatInTimeZone } from "date-fns-tz"
import { generateDaySlots, type SlotSession, type OverrideRow, type BlockRow } from "@/lib/slots"
import type { Enums } from "@/types/database"

export type BookedAppt = {
  id: string
  starts_at: string
  ends_at: string
  status: Enums<"appointment_status">
  source: Enums<"appointment_source">
  token_number: number | null
  reason: string | null
  patient: { id: string; full_name: string; phone: string } | null
}

export type DaySlot =
  | { kind: "booked"; startUtc: string; label: string; appt: BookedAppt }
  | { kind: "open"; startUtc: string; endUtc: string; label: string }
  | { kind: "blocked"; startUtc: string; label: string; reason: string | null }

const LIVE: Enums<"appointment_status">[] = ["pending", "confirmed", "arrived", "in_progress"]

/**
 * Build the slot ladder for one IST day: every generated slot is either
 * "open" or carries the appointment booked at that start time. Appointments
 * that fall outside generated slots (e.g. walk-ins at odd times) are appended.
 */
export async function getDayView(clinic: Clinic, dateKey: string): Promise<DaySlot[]> {
  const settings = clinicSettings(clinic)
  const supabase = await createClient()
  const { start, end } = istDayRangeUtc(dateKey)

  const [{ data: avail }, { data: overrides }, { data: blockRows }, { data: appts }] =
    await Promise.all([
      supabase.from("availability").select("weekday, start_time, end_time").eq("clinic_id", clinic.id),
      supabase
        .from("availability_overrides")
        .select("date, closed, start_time, end_time")
        .eq("clinic_id", clinic.id)
        .eq("date", dateKey),
      supabase
        .from("slot_blocks")
        .select("id, start_time, end_time, reason")
        .eq("clinic_id", clinic.id)
        .eq("date", dateKey),
      supabase
        .from("appointments")
        .select(
          "id, starts_at, ends_at, status, source, token_number, reason, patient:patients(id, full_name, phone)",
        )
        .eq("clinic_id", clinic.id)
        .gte("starts_at", start.toISOString())
        .lt("starts_at", end.toISOString())
        .neq("status", "cancelled")
        .order("starts_at", { ascending: true }),
    ])

  const dayBlocks = (blockRows ?? []) as {
    id: string
    start_time: string
    end_time: string
    reason: string | null
  }[]

  /** Reason of the first block covering this HH:mm label's minute, for display. */
  function blockReasonAt(hhmm: string): string | null {
    const [h, m] = hhmm.split(":").map(Number)
    const mins = h * 60 + m
    const b = dayBlocks.find((bl) => {
      const s = Number(bl.start_time.slice(0, 2)) * 60 + Number(bl.start_time.slice(3, 5))
      const e = Number(bl.end_time.slice(0, 2)) * 60 + Number(bl.end_time.slice(3, 5))
      return mins >= s && mins < e
    })
    return b?.reason ?? null
  }

  const booked = (appts ?? []) as unknown as BookedAppt[]
  const bookedByStart = new Map<string, BookedAppt>()
  for (const a of booked) {
    if (LIVE.includes(a.status) || a.status === "completed" || a.status === "no_show") {
      bookedByStart.set(new Date(a.starts_at).toISOString(), a)
    }
  }

  const takenStarts = new Set(
    booked.filter((a) => LIVE.includes(a.status)).map((a) => new Date(a.starts_at).toISOString()),
  )

  const openSlots = generateDaySlots({
    dateKey,
    sessions: (avail ?? []) as SlotSession[],
    override: (overrides?.[0] as OverrideRow) ?? null,
    slotMinutes: settings.slot_minutes,
    leadMinutes: 0, // calendar shows the whole day; booking page applies lead time
    bookedStartsUtc: takenStarts,
    blocks: dayBlocks as BlockRow[],
    includeBlocked: true, // keep blocked slots so the calendar can show them
  })

  const rows: DaySlot[] = []
  const usedApptIds = new Set<string>()

  for (const slot of openSlots) {
    const appt = bookedByStart.get(slot.startUtc)
    if (appt) {
      rows.push({ kind: "booked", startUtc: slot.startUtc, label: slot.label, appt })
      usedApptIds.add(appt.id)
    } else if (slot.blocked) {
      const hhmm = formatInTimeZone(new Date(slot.startUtc), IST_TZ, "HH:mm")
      rows.push({ kind: "blocked", startUtc: slot.startUtc, label: slot.label, reason: blockReasonAt(hhmm) })
    } else {
      rows.push({ kind: "open", startUtc: slot.startUtc, endUtc: slot.endUtc, label: slot.label })
    }
  }

  // Booked appointments not aligned to a generated slot (walk-ins, old bookings)
  for (const a of booked) {
    if (usedApptIds.has(a.id)) continue
    rows.push({
      kind: "booked",
      startUtc: new Date(a.starts_at).toISOString(),
      label: new Intl.DateTimeFormat("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
        timeZone: "Asia/Kolkata",
      }).format(new Date(a.starts_at)),
      appt: a,
    })
  }

  rows.sort((x, y) => x.startUtc.localeCompare(y.startUtc))
  return rows
}

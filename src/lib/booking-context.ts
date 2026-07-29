import { cache } from "react"
import { createClient } from "@/lib/supabase/server"
import type { SlotSession, OverrideRow, BlockRow } from "@/lib/slots"

export type BookingContext = {
  found: boolean
  enabled?: boolean
  clinic?: {
    id: string
    name: string
    slug: string
    doctor_name: string
    specialty: string | null
    address: string | null
    phone: string | null
    logo_path?: string | null
    settings: {
      slot_minutes?: number
      lead_time_minutes?: number
      booking_enabled?: boolean
      booking_mode?: "instant" | "approve"
    }
  }
  availability?: SlotSession[]
  overrides?: OverrideRow[]
  blocks?: (BlockRow & { date: string })[]
  booked?: string[]
}

/**
 * Public booking context for a clinic slug. Wrapped in React `cache` so the
 * page and its `generateMetadata` share one query per request.
 */
export const getBookingContext = cache(async (slug: string): Promise<BookingContext | null> => {
  const supabase = await createClient()
  const { data } = await supabase.rpc("get_booking_context", { p_slug: slug })
  return (data as unknown as BookingContext | null) ?? null
})

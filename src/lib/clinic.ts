import "server-only"
import { redirect } from "next/navigation"
import { cache } from "react"
import { createClient } from "@/lib/supabase/server"
import { isPlatformAdmin } from "@/lib/admin"
import { env } from "@/lib/env"
import type { Tables } from "@/types/database"

export type Clinic = Tables<"clinics">
export type MemberRole = "doctor" | "staff"

export type ClinicSettings = {
  slot_minutes: number
  consultation_fee: number
  reminder_offsets_hours: number[]
  template_lang: "en" | "hi"
  booking_enabled: boolean
  booking_mode: "instant" | "approve"
  lead_time_minutes: number
  timezone: string
  upi_vpa: string
  upi_name: string
}

export const DEFAULT_SETTINGS: ClinicSettings = {
  slot_minutes: 15,
  consultation_fee: 300,
  reminder_offsets_hours: [24, 2],
  template_lang: "en",
  booking_enabled: true,
  booking_mode: "instant",
  lead_time_minutes: 30,
  timezone: "Asia/Kolkata",
  upi_vpa: "",
  upi_name: "",
}

export function clinicSettings(clinic: Clinic): ClinicSettings {
  return { ...DEFAULT_SETTINGS, ...(clinic.settings as Partial<ClinicSettings>) }
}

/**
 * The signed-in user's clinic, or null if not authed / not onboarded.
 * Memoized per request so multiple callers share one query.
 */
export const getCurrentClinic = cache(async (): Promise<Clinic | null> => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  // RLS scopes this to the user's clinics; a solo doctor has exactly one.
  const { data } = await supabase.from("clinics").select("*").limit(1).maybeSingle()
  return data ?? null
})

/**
 * The signed-in user's clinic together with their role in it.
 * Memoized per request. Returns null if not authed / not onboarded.
 */
export const getMembership = cache(
  async (): Promise<{ clinic: Clinic; role: MemberRole } | null> => {
    const clinic = await getCurrentClinic()
    if (!clinic) return null
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return null
    const { data } = await supabase
      .from("clinic_members")
      .select("role")
      .eq("clinic_id", clinic.id)
      .eq("user_id", user.id)
      .maybeSingle()
    return { clinic, role: (data?.role as MemberRole) ?? "staff" }
  },
)

/** Public URL of a logo object path (in the public `logos` bucket), or null. */
export function logoUrlFromPath(logoPath: string | null | undefined): string | null {
  if (!logoPath) return null
  return `${env.supabaseUrl}/storage/v1/object/public/logos/${logoPath}`
}

/** Public URL of a clinic's logo, or null when none is set. */
export function logoUrl(clinic: Clinic): string | null {
  return logoUrlFromPath(clinic.logo_path)
}

/**
 * Require an authed, onboarded user. Redirects otherwise:
 * - not signed in → /login
 * - signed in, no clinic, but a platform operator → /admin (not /onboarding)
 * - signed in, no clinic → /onboarding
 * - clinic paused by an operator → /suspended
 */
export async function requireClinic(): Promise<Clinic> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const clinic = await getCurrentClinic()
  if (!clinic) {
    if (await isPlatformAdmin()) redirect("/admin")
    redirect("/onboarding")
  }
  if (clinic.suspended_at) redirect("/suspended")
  return clinic
}

/** Require the current user to be a DOCTOR (owner). Staff are sent to /today. */
export async function requireDoctor(): Promise<Clinic> {
  const membership = await getMembership()
  if (!membership) redirect("/onboarding")
  if (membership.clinic.suspended_at) redirect("/suspended")
  if (membership.role !== "doctor") redirect("/today")
  return membership.clinic
}

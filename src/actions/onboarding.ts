"use server"

import { redirect } from "next/navigation"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { DEFAULT_SETTINGS } from "@/lib/clinic"
import { slugify } from "@/lib/slug"

const schema = z.object({
  name: z.string().min(2, "Clinic name is required"),
  doctor_name: z.string().min(2, "Doctor name is required"),
  qualifications: z.string().optional(),
  registration_no: z.string().optional(),
  specialty: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  consultation_fee: z.coerce.number().min(0).default(300),
  slot_minutes: z.coerce.number().min(5).max(60).default(15),
  slug: z.string().optional(),
  working_days: z.array(z.coerce.number().min(0).max(6)).default([1, 2, 3, 4, 5, 6]),
  morning_start: z.string().default("10:00"),
  morning_end: z.string().default("13:00"),
  evening_start: z.string().optional(),
  evening_end: z.string().optional(),
})

export type OnboardingState = { error?: string; ok?: boolean; slug?: string } | undefined

export async function completeOnboarding(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const parsed = schema.safeParse({
    name: formData.get("name"),
    doctor_name: formData.get("doctor_name"),
    qualifications: formData.get("qualifications") || undefined,
    registration_no: formData.get("registration_no") || undefined,
    specialty: formData.get("specialty") || undefined,
    phone: formData.get("phone") || undefined,
    address: formData.get("address") || undefined,
    consultation_fee: formData.get("consultation_fee") || 300,
    slot_minutes: formData.get("slot_minutes") || 15,
    slug: formData.get("slug") || undefined,
    working_days: formData.getAll("working_days").map(Number),
    morning_start: formData.get("morning_start") || "10:00",
    morning_end: formData.get("morning_end") || "13:00",
    evening_start: formData.get("evening_start") || undefined,
    evening_end: formData.get("evening_end") || undefined,
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form." }
  }
  const v = parsed.data

  // Already onboarded? Go straight in.
  const { data: existing } = await supabase.from("clinics").select("id").limit(1).maybeSingle()
  if (existing) redirect("/today")

  // Build availability rows (morning + optional evening per working day)
  const availability: { weekday: number; start_time: string; end_time: string }[] = []
  for (const wd of v.working_days) {
    availability.push({ weekday: wd, start_time: v.morning_start, end_time: v.morning_end })
    if (v.evening_start && v.evening_end) {
      availability.push({ weekday: wd, start_time: v.evening_start, end_time: v.evening_end })
    }
  }

  // Atomic create via SECURITY DEFINER RPC (avoids RLS bootstrap problem).
  const { data: clinicId, error } = await supabase.rpc("create_clinic", {
    p_name: v.name,
    p_slug: slugify(v.slug || v.name) || "clinic",
    p_doctor_name: v.doctor_name,
    p_qualifications: v.qualifications ?? null,
    p_registration_no: v.registration_no ?? null,
    p_specialty: v.specialty ?? null,
    p_phone: v.phone ?? null,
    p_address: v.address ?? null,
    p_email: user.email ?? null,
    p_settings: {
      ...DEFAULT_SETTINGS,
      consultation_fee: v.consultation_fee,
      slot_minutes: v.slot_minutes,
    },
    p_availability: availability,
  })
  if (error) return { error: error.message }

  // The RPC may have de-duplicated the slug; read back the final one so the
  // finish screen can show the real booking link.
  const { data: created } = await supabase
    .from("clinics")
    .select("slug")
    .eq("id", clinicId as string)
    .maybeSingle()

  return { ok: true, slug: created?.slug ?? (slugify(v.slug || v.name) || "clinic") }
}

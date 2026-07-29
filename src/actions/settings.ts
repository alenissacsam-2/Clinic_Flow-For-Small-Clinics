"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { requireDoctor, clinicSettings } from "@/lib/clinic"

export type SettingsState = { error?: string; ok?: boolean } | undefined

const profileSchema = z.object({
  name: z.string().min(2),
  doctor_name: z.string().min(2),
  qualifications: z.string().optional(),
  registration_no: z.string().optional(),
  specialty: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
})

export async function updateClinicProfile(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const clinic = await requireDoctor()
  const parsed = profileSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." }
  const v = parsed.data

  const supabase = await createClient()
  const { error } = await supabase
    .from("clinics")
    .update({
      name: v.name,
      doctor_name: v.doctor_name,
      qualifications: v.qualifications || null,
      registration_no: v.registration_no || null,
      specialty: v.specialty || null,
      phone: v.phone || null,
      address: v.address || null,
    })
    .eq("id", clinic.id)
  if (error) return { error: error.message }
  revalidatePath("/settings")
  return { ok: true }
}

/** Upload (or replace) the clinic logo. Stored in the public `logos` bucket
 *  under {clinic_id}/... and referenced by clinics.logo_path. */
export async function uploadClinicLogo(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const clinic = await requireDoctor()
  const file = formData.get("logo")
  if (!(file instanceof File) || file.size === 0) return { error: "Choose an image first." }
  if (file.size > 1_000_000) return { error: "Image must be under 1 MB." }
  if (!file.type.startsWith("image/")) return { error: "Choose a PNG, JPG or WebP image." }

  const ext =
    file.type === "image/png" ? "png"
    : file.type === "image/jpeg" ? "jpg"
    : file.type === "image/webp" ? "webp"
    : "png"
  const path = `${clinic.id}/logo-${Date.now()}.${ext}`

  const supabase = await createClient()
  const { error: upErr } = await supabase.storage
    .from("logos")
    .upload(path, file, { upsert: true, contentType: file.type })
  if (upErr) return { error: "Upload failed. Please try again." }

  const oldPath = clinic.logo_path
  const { error } = await supabase.from("clinics").update({ logo_path: path }).eq("id", clinic.id)
  if (error) return { error: error.message }
  // Best-effort cleanup of the previous file.
  if (oldPath && oldPath !== path) await supabase.storage.from("logos").remove([oldPath])

  revalidatePath("/settings")
  revalidatePath("/today")
  return { ok: true }
}

/** Remove the clinic logo (falls back to the "+" mark everywhere). */
export async function removeClinicLogo(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  void formData // required by the useActionState signature; unused here
  const clinic = await requireDoctor()
  const supabase = await createClient()
  if (clinic.logo_path) await supabase.storage.from("logos").remove([clinic.logo_path])
  const { error } = await supabase.from("clinics").update({ logo_path: null }).eq("id", clinic.id)
  if (error) return { error: error.message }
  revalidatePath("/settings")
  revalidatePath("/today")
  return { ok: true }
}

const prefsSchema = z.object({
  consultation_fee: z.coerce.number().min(0),
  slot_minutes: z.coerce.number().min(5).max(60),
  template_lang: z.enum(["en", "hi"]),
  booking_mode: z.enum(["instant", "approve"]),
  reminder_24h: z.union([z.literal("on"), z.boolean()]).optional(),
  reminder_2h: z.union([z.literal("on"), z.boolean()]).optional(),
  booking_enabled: z.union([z.literal("on"), z.boolean()]).optional(),
})

export async function updateClinicPrefs(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const clinic = await requireDoctor()
  const parsed = prefsSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." }
  const v = parsed.data

  const offsets: number[] = []
  if (v.reminder_24h === "on" || v.reminder_24h === true) offsets.push(24)
  if (v.reminder_2h === "on" || v.reminder_2h === true) offsets.push(2)

  const supabase = await createClient()
  const { error } = await supabase
    .from("clinics")
    .update({
      settings: {
        ...clinicSettings(clinic),
        consultation_fee: v.consultation_fee,
        slot_minutes: v.slot_minutes,
        template_lang: v.template_lang,
        booking_mode: v.booking_mode,
        reminder_offsets_hours: offsets,
        booking_enabled: v.booking_enabled === "on" || v.booking_enabled === true,
      },
    })
    .eq("id", clinic.id)
  if (error) return { error: error.message }
  revalidatePath("/settings")
  return { ok: true }
}

const paymentsSchema = z.object({
  upi_vpa: z
    .string()
    .trim()
    .max(256)
    .refine((s) => s === "" || /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(s), "Enter a valid UPI ID like name@bank")
    .optional(),
  upi_name: z.string().trim().max(120).optional(),
})

export async function updatePaymentSettings(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const clinic = await requireDoctor()
  const parsed = paymentsSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." }

  const supabase = await createClient()
  const { error } = await supabase
    .from("clinics")
    .update({
      settings: {
        ...clinicSettings(clinic),
        upi_vpa: parsed.data.upi_vpa ?? "",
        upi_name: parsed.data.upi_name ?? "",
      },
    })
    .eq("id", clinic.id)
  if (error) return { error: error.message }
  revalidatePath("/settings")
  return { ok: true }
}

const hoursSchema = z.object({
  working_days: z.array(z.coerce.number().min(0).max(6)).default([]),
  morning_start: z.string(),
  morning_end: z.string(),
  evening_start: z.string().optional(),
  evening_end: z.string().optional(),
})

export async function updateHours(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const clinic = await requireDoctor()
  const parsed = hoursSchema.safeParse({
    working_days: formData.getAll("working_days").map(Number),
    morning_start: formData.get("morning_start") || "10:00",
    morning_end: formData.get("morning_end") || "13:00",
    evening_start: formData.get("evening_start") || undefined,
    evening_end: formData.get("evening_end") || undefined,
  })
  if (!parsed.success) return { error: "Check the hours." }
  const v = parsed.data

  const rows: { clinic_id: string; weekday: number; start_time: string; end_time: string }[] = []
  for (const wd of v.working_days) {
    rows.push({ clinic_id: clinic.id, weekday: wd, start_time: v.morning_start, end_time: v.morning_end })
    if (v.evening_start && v.evening_end) {
      rows.push({ clinic_id: clinic.id, weekday: wd, start_time: v.evening_start, end_time: v.evening_end })
    }
  }

  const supabase = await createClient()
  // Replace the whole schedule.
  await supabase.from("availability").delete().eq("clinic_id", clinic.id)
  if (rows.length) {
    const { error } = await supabase.from("availability").insert(rows)
    if (error) return { error: error.message }
  }
  revalidatePath("/settings")
  revalidatePath("/calendar")
  return { ok: true }
}

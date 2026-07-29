"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { normalizePhone, formatISTTime, formatISTDate } from "@/lib/format"
import { getBookingContext } from "@/lib/booking-context"
import { buildBookingDays, type BookingDay } from "@/lib/booking-days"
import { hasServiceRole } from "@/lib/env"
import { deliverOtp } from "@/lib/otp"
import { notifyApptConfirmed } from "@/lib/whatsapp/triggers"
import { createIntakeRequest } from "@/lib/intake"
import type { Clinic, ClinicSettings } from "@/lib/clinic"

export type BookingState = { error?: string; ok?: boolean } | undefined

/* ────────────────────────────────────────────────────────────────────────────
 * Approve mode (unchanged): create a pending request the doctor accepts.
 * ──────────────────────────────────────────────────────────────────────────── */
export async function submitBooking(
  slug: string,
  _prev: BookingState,
  formData: FormData,
): Promise<BookingState> {
  const name = String(formData.get("name") ?? "").trim()
  const phoneRaw = String(formData.get("phone") ?? "").trim()
  const startsAt = String(formData.get("starts_at") ?? "")
  const reason = String(formData.get("reason") ?? "").trim()
  const consent = formData.get("consent") != null

  if (!name || name.length < 2) return { error: "Please enter your name." }
  if (!startsAt) return { error: "Please pick a time slot." }

  let phone: string
  try {
    phone = normalizePhone(phoneRaw)
  } catch {
    return { error: "Enter a valid 10-digit mobile number." }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc("create_booking", {
    p_slug: slug,
    p_name: name,
    p_phone: phone,
    p_starts_at: startsAt,
    p_reason: reason || null,
    p_consent: consent,
  })

  if (error) return { error: "Something went wrong. Please try again." }
  const res = data as { ok?: boolean; error?: string } | null
  if (!res?.ok) return { error: res?.error ?? "Could not book. Please try again." }
  return { ok: true }
}

/* ────────────────────────────────────────────────────────────────────────────
 * Instant mode: OTP-verify the phone, then confirm the slot immediately.
 * ──────────────────────────────────────────────────────────────────────────── */

const OTP_ERRORS: Record<string, string> = {
  clinic_not_found: "Clinic not found.",
  booking_disabled: "Online booking is currently unavailable.",
  invalid_phone: "Enter a valid 10-digit mobile number.",
  cooldown: "Please wait a moment before requesting another code.",
  rate_limited: "Too many attempts. Please try again later.",
  otp_unavailable: "Online verification isn't set up yet. Please call the clinic to book.",
}

export type RequestOtpResult = {
  ok: boolean
  otpId?: string
  resendAfter?: number
  devCode?: string
  error?: string
}

/** Step 1: issue and deliver a 6-digit code (service-role RPC + out-of-band send). */
export async function requestBookingOtp(slug: string, phoneRaw: string): Promise<RequestOtpResult> {
  let phone: string
  try {
    phone = normalizePhone(phoneRaw)
  } catch {
    return { ok: false, error: OTP_ERRORS.invalid_phone }
  }

  // The issuer returns the plaintext code, so it is service-role only.
  if (!hasServiceRole()) return { ok: false, error: OTP_ERRORS.otp_unavailable }

  const admin = createAdminClient()
  const { data: clinic } = await admin
    .from("clinics")
    .select("id, settings")
    .eq("slug", slug)
    .maybeSingle()
  if (!clinic) return { ok: false, error: OTP_ERRORS.clinic_not_found }

  const { data, error } = await admin.rpc("issue_booking_otp", { p_slug: slug, p_phone: phone })
  if (error) return { ok: false, error: "Couldn't send the code. Please try again." }
  const res = data as { ok?: boolean; error?: string; otp_id?: string; code?: string; resend_after?: number } | null
  if (!res?.ok || !res.code || !res.otp_id) {
    return { ok: false, error: OTP_ERRORS[res?.error ?? ""] ?? "Couldn't send the code." }
  }

  const lang = ((clinic.settings as Partial<ClinicSettings>)?.template_lang as "en" | "hi") ?? "en"
  const delivered = await deliverOtp({ clinicId: clinic.id, phone, code: res.code, lang })
  if (!delivered.ok) return { ok: false, error: "Couldn't send the code. Please try again." }

  return { ok: true, otpId: res.otp_id, resendAfter: res.resend_after ?? 45, devCode: delivered.devCode }
}

export type VerifyOtpResult = {
  ok: boolean
  verifyToken?: string
  knownName?: string
  attemptsLeft?: number
  error?: string
}

/** Step 2: verify the code, returning a short-lived token + returning-patient name. */
export async function verifyBookingOtp(
  slug: string,
  phoneRaw: string,
  otpId: string,
  code: string,
): Promise<VerifyOtpResult> {
  let phone: string
  try {
    phone = normalizePhone(phoneRaw)
  } catch {
    return { ok: false, error: OTP_ERRORS.invalid_phone }
  }
  if (!/^\d{6}$/.test(code)) return { ok: false, error: "Enter the 6-digit code." }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc("verify_booking_otp", {
    p_slug: slug,
    p_phone: phone,
    p_otp_id: otpId,
    p_code: code,
  })
  if (error) return { ok: false, error: "Something went wrong. Please try again." }
  const res = data as {
    ok?: boolean
    error?: string
    verify_token?: string
    attempts_left?: number
    patient?: { full_name?: string } | null
  } | null

  if (!res?.ok) {
    if (res?.error === "wrong_code") {
      return { ok: false, attemptsLeft: res.attempts_left, error: "Incorrect code. Please try again." }
    }
    if (res?.error === "too_many_attempts") {
      return { ok: false, error: "Too many attempts. Request a new code." }
    }
    if (res?.error === "expired") {
      return { ok: false, error: "That code expired. Request a new one." }
    }
    return { ok: false, error: "Verification failed. Please try again." }
  }

  return { ok: true, verifyToken: res.verify_token, knownName: res.patient?.full_name }
}

export type ConfirmResult = {
  ok: boolean
  slotTaken?: boolean
  tokenNumber?: number
  timeLabel?: string
  dateLabel?: string
  startsAtUtc?: string
  appointmentId?: string
  error?: string
}

/** Step 3: create the confirmed booking, then fire confirmation + intake link. */
export async function confirmVerifiedBooking(
  slug: string,
  verifyToken: string,
  input: { name: string; startsAt: string; reason?: string; consent: boolean },
): Promise<ConfirmResult> {
  if (!input.name || input.name.trim().length < 2) return { ok: false, error: "Please enter your name." }
  if (!input.startsAt) return { ok: false, error: "Please pick a time slot." }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc("create_verified_booking", {
    p_slug: slug,
    p_verify_token: verifyToken,
    p_name: input.name.trim(),
    p_starts_at: input.startsAt,
    p_reason: input.reason?.trim() || null,
    p_consent: input.consent,
  })
  if (error) return { ok: false, error: "Something went wrong. Please try again." }
  const res = data as {
    ok?: boolean
    error?: string
    appointment_id?: string
    token_number?: number
    starts_at?: string
  } | null

  if (!res?.ok) {
    if (res?.error === "slot_taken") return { ok: false, slotTaken: true }
    if (res?.error === "invalid_token") return { ok: false, error: "Your session expired. Please verify again." }
    return { ok: false, error: "Could not confirm the booking. Please try again." }
  }

  // Best-effort confirmation + intake link (needs the service role).
  if (hasServiceRole() && res.appointment_id) {
    try {
      const admin = createAdminClient()
      const { data: clinicRow } = await admin.from("clinics").select("*").eq("slug", slug).maybeSingle()
      const clinic = clinicRow as Clinic | null
      if (clinic) {
        await notifyApptConfirmed(admin, clinic, res.appointment_id)
        await createIntakeRequest(admin, clinic, res.appointment_id)
      }
    } catch {
      // Non-fatal: the booking is confirmed regardless of the notification.
    }
  }

  return {
    ok: true,
    tokenNumber: res.token_number,
    timeLabel: res.starts_at ? formatISTTime(res.starts_at) : undefined,
    dateLabel: res.starts_at ? formatISTDate(res.starts_at) : undefined,
    // The confirmed instant, echoed back from the server rather than reused
    // from the client's selection: the RPC is the authority on what was
    // actually booked, and the calendar file must agree with the appointment
    // row, not with what the browser last had selected.
    startsAtUtc: res.starts_at ?? undefined,
    appointmentId: res.appointment_id ?? undefined,
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * Slot freshness
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Re-read the day grid for a clinic.
 *
 * The booking page is server-rendered once. A patient who opens the link,
 * gets distracted, and comes back twenty minutes later is looking at a slot
 * board that may have been taken out from under them — and the failure only
 * surfaces at the very end of the flow, after they have entered a phone number
 * and typed an OTP. The widget calls this when the tab regains focus so a gone
 * slot disappears while they are still choosing, which is the only point where
 * losing it costs them nothing.
 */
export async function refreshBookingDays(slug: string): Promise<BookingDay[] | null> {
  const ctx = await getBookingContext(slug)
  if (!ctx?.found || !ctx.clinic || ctx.enabled === false) return null
  return buildBookingDays({
    availability: ctx.availability,
    overrides: ctx.overrides,
    blocks: ctx.blocks,
    booked: ctx.booked,
    slotMinutes: ctx.clinic.settings.slot_minutes,
    leadMinutes: ctx.clinic.settings.lead_time_minutes,
  })
}

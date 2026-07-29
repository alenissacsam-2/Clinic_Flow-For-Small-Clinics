import "server-only"
import { createAdminClient } from "@/lib/supabase/admin"
import { toWhatsAppNumber } from "@/lib/format"
import { serverEnv, hasMsg91 } from "@/lib/env"
import { whatsappConfigured, sendTemplateMessage } from "@/lib/whatsapp/client"
import { renderPreview } from "@/lib/whatsapp/templates"

export type DeliverResult = { ok: boolean; devCode?: string; error?: string }

/**
 * Deliver a booking OTP to a phone. Does NOT go through enqueueWhatsApp — the
 * recipient may not be a patient yet and auth messages are not opt-in gated.
 * Channels in priority order: WhatsApp auth template → MSG91 SMS → dry-run.
 * Logs a wa_messages row (patient_id null) for the clinic's message timeline.
 */
export async function deliverOtp(args: {
  clinicId: string
  phone: string // E.164
  code: string
  lang?: "en" | "hi"
}): Promise<DeliverResult> {
  const lang = args.lang ?? "en"
  const admin = createAdminClient()
  const preview = renderPreview("otp_code", lang, [args.code])

  // WhatsApp (real credentials configured).
  if (whatsappConfigured()) {
    const res = await sendTemplateMessage({
      to: toWhatsAppNumber(args.phone),
      template: "otp_code",
      lang,
      bodyParams: [args.code],
    })
    await logOtpMessage(admin, args.clinicId, args.phone, preview, res.id ? "sent" : "failed", res.id, res.error)
    return res.id ? { ok: true } : { ok: false, error: res.error ?? "send_failed" }
  }

  // MSG91 SMS fallback.
  if (hasMsg91()) {
    const err = await sendViaMsg91(args.phone, args.code)
    await logOtpMessage(admin, args.clinicId, args.phone, preview, err ? "failed" : "sent", undefined, err)
    return err ? { ok: false, error: err } : { ok: true }
  }

  // Dry-run: no provider. Log it and (in dev only) surface the code to the widget.
  await logOtpMessage(admin, args.clinicId, args.phone, preview, "sent", `dryrun-otp`, null)
  console.log(`[OTP dry-run] ${args.phone} → ${args.code}`)
  if (process.env.NODE_ENV !== "production") return { ok: true, devCode: args.code }
  return { ok: false, error: "otp_delivery_not_configured" }
}

async function logOtpMessage(
  admin: ReturnType<typeof createAdminClient>,
  clinicId: string,
  phone: string,
  body: string,
  status: "sent" | "failed",
  waMessageId?: string,
  error?: string | null,
) {
  try {
    await admin.from("wa_messages").insert({
      clinic_id: clinicId,
      patient_id: null,
      to_phone: phone,
      direction: "out",
      template_name: "otp_code",
      body,
      status,
      wa_message_id: waMessageId ?? null,
      error: error ?? null,
      related_type: "otp",
      sent_at: status === "sent" ? new Date().toISOString() : null,
    })
  } catch {
    // Non-fatal: the OTP itself still went out.
  }
}

/** Returns an error string on failure, undefined on success. */
async function sendViaMsg91(phone: string, code: string): Promise<string | undefined> {
  const m = serverEnv.msg91
  try {
    const res = await fetch("https://control.msg91.com/api/v5/otp", {
      method: "POST",
      headers: { "Content-Type": "application/json", authkey: m.authKey },
      body: JSON.stringify({
        template_id: m.otpTemplateId,
        mobile: toWhatsAppNumber(phone), // digits, country code, no +
        otp: code,
        ...(m.senderId ? { sender: m.senderId } : {}),
      }),
    })
    if (!res.ok) return `msg91_http_${res.status}`
    const json = (await res.json()) as { type?: string; message?: string }
    return json.type === "success" ? undefined : (json.message ?? "msg91_error")
  } catch (e) {
    return e instanceof Error ? e.message : "msg91_network_error"
  }
}

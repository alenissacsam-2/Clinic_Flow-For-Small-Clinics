import { NextResponse, type NextRequest } from "next/server"
import crypto from "node:crypto"
import { serverEnv, hasServiceRole } from "@/lib/env"
import { createAdminClient } from "@/lib/supabase/admin"
import { normalizePhone } from "@/lib/format"

export const runtime = "nodejs"

/** Webhook verification handshake (Meta calls this once on setup). */
export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams
  const mode = p.get("hub.mode")
  const token = p.get("hub.verify_token")
  const challenge = p.get("hub.challenge")
  if (mode === "subscribe" && token && token === serverEnv.whatsapp.verifyToken) {
    return new NextResponse(challenge ?? "", { status: 200 })
  }
  return new NextResponse("Forbidden", { status: 403 })
}

type StatusEntry = { id: string; status: string; errors?: { title?: string }[] }
type InboundMsg = { from: string; text?: { body: string } }

export async function POST(request: NextRequest) {
  const raw = await request.text()

  // This endpoint is unauthenticated and writes with the service role: it can
  // opt a patient out of WhatsApp, flag an appointment for cancellation, and
  // append to a patient's message history — all keyed off a phone number an
  // attacker chooses. The HMAC is the ONLY thing separating Meta from anyone
  // on the internet, so an unverifiable payload is never acted on.
  //
  // A missing app secret therefore fails closed rather than open. We still ack
  // 200 so Meta does not disable the subscription over a local misconfiguration,
  // but nothing is processed.
  const appSecret = serverEnv.whatsapp.appSecret
  if (!appSecret) {
    console.error(
      "[wa-webhook] WHATSAPP_APP_SECRET is not set — payload ignored. Inbound WhatsApp is disabled until it is configured.",
    )
    return NextResponse.json({ ok: true, ignored: "unverified" })
  }

  const sig = request.headers.get("x-hub-signature-256") ?? ""
  const expected = "sha256=" + crypto.createHmac("sha256", appSecret).update(raw).digest("hex")
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return new NextResponse("Invalid signature", { status: 401 })
  }

  // Always ack Meta quickly; process best-effort if the service role is set.
  if (!hasServiceRole()) return NextResponse.json({ ok: true })

  let payload: {
    entry?: { changes?: { value?: { statuses?: StatusEntry[]; messages?: InboundMsg[] } }[] }[]
  }
  try {
    payload = JSON.parse(raw)
  } catch {
    return NextResponse.json({ ok: true })
  }

  const admin = createAdminClient()

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value ?? {}

      // Delivery status updates
      for (const st of value.statuses ?? []) {
        const status = mapStatus(st.status)
        if (!status) continue
        await admin
          .from("wa_messages")
          .update({
            status,
            error: st.errors?.[0]?.title ?? null,
          })
          .eq("wa_message_id", st.id)
      }

      // Inbound messages
      for (const msg of value.messages ?? []) {
        await handleInbound(admin, msg)
      }
    }
  }

  return NextResponse.json({ ok: true })
}

function mapStatus(s: string): "sent" | "delivered" | "read" | "failed" | null {
  if (s === "sent" || s === "delivered" || s === "read" || s === "failed") return s
  return null
}

async function handleInbound(
  admin: ReturnType<typeof createAdminClient>,
  msg: InboundMsg,
) {
  let phone: string
  try {
    phone = normalizePhone(msg.from)
  } catch {
    return
  }
  const body = msg.text?.body?.trim() ?? ""

  const { data: patients } = await admin
    .from("patients")
    .select("id, clinic_id")
    .eq("phone", phone)
    .is("deleted_at", null)

  for (const p of patients ?? []) {
    await admin.from("wa_messages").insert({
      clinic_id: p.clinic_id,
      patient_id: p.id,
      to_phone: phone,
      direction: "in",
      body,
      status: "delivered",
    })

    if (/^stop$/i.test(body)) {
      await admin.from("patients").update({ whatsapp_opt_in: false }).eq("id", p.id)
    } else if (/^cancel$/i.test(body)) {
      const { data: next } = await admin
        .from("appointments")
        .select("id")
        .eq("patient_id", p.id)
        .in("status", ["pending", "confirmed"])
        .gte("starts_at", new Date().toISOString())
        .order("starts_at", { ascending: true })
        .limit(1)
        .maybeSingle()
      if (next) {
        await admin
          .from("appointments")
          .update({ cancellation_requested: true })
          .eq("id", next.id)
      }
    }
  }
}

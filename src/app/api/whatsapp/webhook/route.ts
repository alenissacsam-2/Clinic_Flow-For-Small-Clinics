import { NextResponse, type NextRequest } from "next/server"
import crypto from "node:crypto"
import { serverEnv, hasServiceRole } from "@/lib/env"
import { createAdminClient } from "@/lib/supabase/admin"
import { normalizePhone } from "@/lib/format"
import { handleBotMessage } from "@/lib/whatsapp/bot/handler"
import type { Inbound } from "@/lib/whatsapp/bot/types"

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

/**
 * Meta's inbound message shape, narrowed to what the bot reads.
 *
 * Button taps and list selections arrive under `interactive` with different
 * inner keys, which is Meta's distinction, not ours — the bot only cares which
 * id came back. Everything else (audio, image, location, sticker) is something
 * it cannot read, and is answered honestly rather than ignored.
 */
type InboundMsg = {
  id: string
  from: string
  type?: string
  text?: { body: string }
  interactive?: {
    type?: string
    button_reply?: { id: string; title?: string }
    list_reply?: { id: string; title?: string }
  }
}

function toInbound(msg: InboundMsg): Inbound {
  const reply = msg.interactive?.button_reply?.id ?? msg.interactive?.list_reply?.id
  if (reply) return { type: "reply", id: reply }
  if (typeof msg.text?.body === "string") return { type: "text", body: msg.text.body }
  return { type: "unsupported" }
}

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

/**
 * Hand one inbound message to the booking bot.
 *
 * This replaces a loop that fanned every message out across *every* clinic the
 * phone number appeared in, wrote a log row to each, and let a bare "CANCEL"
 * flag an appointment at all of them at once. That was tolerable while inbound
 * only ever set a flag; it is not tolerable now that a message can create an
 * appointment. `resolveClinic` picks exactly one tenant or asks.
 *
 * Failures are swallowed on purpose. Meta retries anything that is not a prompt
 * 2xx, and a message that throws every time would be redelivered until the
 * subscription is disabled — taking every *other* clinic's bot down with it.
 * The insert in `claimInbound` has already recorded the message, so nothing is
 * lost, and the error goes to the logs for a human.
 */
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
  if (!msg.id) return

  try {
    await handleBotMessage(admin, {
      phone,
      waMessageId: msg.id,
      message: toInbound(msg),
    })
  } catch (e) {
    console.error("[wa-webhook] bot failed for", msg.id, e)
  }
}

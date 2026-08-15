import "server-only"
import { serverEnv } from "@/lib/env"
import type { Outbound } from "./bot/types"

/** Whether real Meta Cloud API credentials are configured. */
export function whatsappConfigured(): boolean {
  const w = serverEnv.whatsapp
  return Boolean(w.accessToken && w.phoneNumberId)
}

export type SendArgs = {
  to: string // digits, no +
  template: string
  lang: "en" | "hi"
  bodyParams: string[]
  document?: { link: string; filename: string }
}

export type SendResult = { id?: string; error?: string; code?: number; dryRun?: boolean }

/**
 * Meta error codes worth recognising by number rather than by message text.
 *
 * `131047` is the one that matters for the bot: it means the 24-hour customer
 * service window has closed, so a free-form reply is no longer permitted. It is
 * not a bug and not worth retrying — the only lawful way to reopen the
 * conversation is an approved template, which is `templates.ts`'s job. Storing
 * the code makes that distinguishable in `wa_messages.error` from a genuine
 * failure like a bad token or a malformed payload.
 */
export const WA_ERROR = {
  outsideWindow: 131047,
  /** Malformed interactive payload — usually a limit in `WA_LIMITS` exceeded. */
  badParameter: 131009,
} as const

/**
 * Send a template message via the Meta WhatsApp Cloud API.
 * If credentials are absent, runs in dry-run mode: no network call, returns a
 * synthetic id so the rest of the pipeline (queue, status, UI) can be exercised.
 */
export async function sendTemplateMessage(args: SendArgs): Promise<SendResult> {
  if (!whatsappConfigured()) return dryRun()

  const components: unknown[] = []
  if (args.document) {
    components.push({
      type: "header",
      parameters: [
        { type: "document", document: { link: args.document.link, filename: args.document.filename } },
      ],
    })
  }
  if (args.bodyParams.length > 0) {
    components.push({
      type: "body",
      parameters: args.bodyParams.map((text) => ({ type: "text", text })),
    })
  }
  // Meta AUTHENTICATION templates require a copy-code button carrying the code.
  if (args.template === "otp_code" && args.bodyParams[0]) {
    components.push({
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [{ type: "text", text: args.bodyParams[0] }],
    })
  }

  const payload = {
    messaging_product: "whatsapp",
    to: args.to,
    type: "template",
    template: { name: args.template, language: { code: args.lang }, components },
  }

  return post(payload)
}

/* ────────────────────────────────────────────────────────────────────────────
 * Session messages — the bot's half of the API.
 *
 * Templates are for messages *we* start. These are replies, and Meta allows
 * free-form content for 24 hours after the patient's last inbound message. That
 * window is the whole reason the booking bot needs no approved template and can
 * ship the day the code does: every message it sends is a response to one it
 * just received.
 *
 * Send outside the window and Meta rejects it (error 131047), which is correct
 * and is why nothing here is used to *begin* a conversation.
 * ──────────────────────────────────────────────────────────────────────────── */

/** Shared transport for both template and session sends. */
async function post(payload: unknown): Promise<SendResult> {
  const w = serverEnv.whatsapp
  const url = `https://graph.facebook.com/${w.apiVersion}/${w.phoneNumberId}/messages`
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${w.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })
    const json = await res.json()
    if (!res.ok) {
      const code = typeof json?.error?.code === "number" ? json.error.code : undefined
      return { error: json?.error?.message ?? `HTTP ${res.status}`, code }
    }
    return { id: json?.messages?.[0]?.id }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Network error" }
  }
}

function dryRun(): SendResult {
  return { id: `dryrun-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, dryRun: true }
}

/**
 * Translate one of the reducer's `Outbound` values into a Cloud API payload.
 *
 * Exported for tests: getting this mapping wrong is invisible until Meta
 * rejects a live message with an opaque code, so it is worth asserting the
 * shape directly rather than only through a send.
 */
export function toCloudApiPayload(to: string, out: Outbound): Record<string, unknown> {
  const base = { messaging_product: "whatsapp", recipient_type: "individual", to }

  if (out.type === "text") {
    // `preview_url: false` matters: the confirmation contains a date and time,
    // and letting WhatsApp hunt for a link to unfurl in a clinical message is
    // both pointless and a way to leak a preview fetch to a third party.
    return { ...base, type: "text", text: { body: out.body, preview_url: false } }
  }

  if (out.type === "buttons") {
    return {
      ...base,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: out.body },
        action: {
          buttons: out.buttons.map((b) => ({ type: "reply", reply: { id: b.id, title: b.title } })),
        },
      },
    }
  }

  return {
    ...base,
    type: "interactive",
    interactive: {
      type: "list",
      body: { text: out.body },
      action: {
        button: out.button,
        sections: out.sections.map((s) => ({
          title: s.title,
          rows: s.rows.map((r) => ({
            id: r.id,
            title: r.title,
            ...(r.description ? { description: r.description } : {}),
          })),
        })),
      },
    },
  }
}

/**
 * Send one bot reply. Dry-runs to a synthetic id when credentials are absent,
 * exactly as `sendTemplateMessage` does, so the whole conversation can be
 * driven end to end against a real database with no Meta account at all.
 */
export async function sendSessionMessage(to: string, out: Outbound): Promise<SendResult> {
  if (!whatsappConfigured()) return dryRun()
  return post(toCloudApiPayload(to, out))
}

import "server-only"
import { serverEnv } from "@/lib/env"

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

export type SendResult = { id?: string; error?: string; dryRun?: boolean }

/**
 * Send a template message via the Meta WhatsApp Cloud API.
 * If credentials are absent, runs in dry-run mode: no network call, returns a
 * synthetic id so the rest of the pipeline (queue, status, UI) can be exercised.
 */
export async function sendTemplateMessage(args: SendArgs): Promise<SendResult> {
  if (!whatsappConfigured()) {
    return { id: `dryrun-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, dryRun: true }
  }

  const w = serverEnv.whatsapp
  const url = `https://graph.facebook.com/${w.apiVersion}/${w.phoneNumberId}/messages`

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
      return { error: json?.error?.message ?? `HTTP ${res.status}` }
    }
    return { id: json?.messages?.[0]?.id }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Network error" }
  }
}

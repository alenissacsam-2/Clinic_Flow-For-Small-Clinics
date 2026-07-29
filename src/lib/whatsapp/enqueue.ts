import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database, Json } from "@/types/database"
import { toWhatsAppNumber } from "@/lib/format"
import { sendTemplateMessage, whatsappConfigured } from "./client"
import { renderPreview, hasDocument, type TemplateName, type Lang } from "./templates"
import { createAdminClient } from "@/lib/supabase/admin"

type DB = SupabaseClient<Database>

export type EnqueueArgs = {
  clinicId: string
  patientId: string
  toPhone: string // E.164
  template: TemplateName
  lang: Lang
  values: string[]
  documentPath?: string | null // storage path in rx-pdfs / receipts
  relatedType?: string
  relatedId?: string
  offset?: number // for reminder idempotency
}

/**
 * The single entry point for all outbound WhatsApp. Checks opt-in, writes a
 * queued row (audit + retry + timeline), then attempts delivery immediately.
 * `supabase` is the caller's scoped client (user session for triggers).
 */
export async function enqueueWhatsApp(supabase: DB, args: EnqueueArgs): Promise<void> {
  // Respect opt-out.
  const { data: patient } = await supabase
    .from("patients")
    .select("whatsapp_opt_in")
    .eq("id", args.patientId)
    .maybeSingle()
  if (!patient?.whatsapp_opt_in) return

  const params = { values: args.values, lang: args.lang } as {
    values: string[]
    lang: Lang
    offset?: string
  }
  if (typeof args.offset === "number") params.offset = String(args.offset)

  const { data: row, error } = await supabase
    .from("wa_messages")
    .insert({
      clinic_id: args.clinicId,
      patient_id: args.patientId,
      to_phone: args.toPhone,
      direction: "out",
      template_name: args.template,
      params: params as unknown as Json,
      document_path: args.documentPath ?? null,
      body: renderPreview(args.template, args.lang, args.values),
      status: "queued",
      related_type: args.relatedType ?? null,
      related_id: args.relatedId ?? null,
    })
    .select("id")
    .single()

  // Duplicate reminder (unique index) or other insert error → nothing to send.
  if (error || !row) return

  await sendQueuedMessage(supabase, row.id)
}

/** Claim a queued/failed message and attempt delivery. Safe to call repeatedly. */
export async function sendQueuedMessage(supabase: DB, messageId: string): Promise<void> {
  // Claim atomically: only transition from queued/failed.
  const { data: claimed } = await supabase
    .from("wa_messages")
    .update({ status: "sending" })
    .eq("id", messageId)
    .in("status", ["queued", "failed"])
    .select("id, to_phone, template_name, params, document_path, attempts")
    .maybeSingle()
  if (!claimed) return

  const params = (claimed.params ?? {}) as { values?: string[]; lang?: Lang }
  const template = claimed.template_name as TemplateName
  const values = params.values ?? []
  const lang = params.lang ?? "en"

  await supabase
    .from("wa_messages")
    .update({ attempts: (claimed.attempts ?? 0) + 1 })
    .eq("id", messageId)

  // Resolve document link for document templates (real mode only).
  let document: { link: string; filename: string } | undefined
  if (claimed.document_path && hasDocument(template) && whatsappConfigured()) {
    try {
      const admin = createAdminClient()
      const bucket = claimed.document_path.startsWith("receipts/") ? "receipts" : "rx-pdfs"
      const path = claimed.document_path.replace(/^(rx-pdfs|receipts)\//, "")
      const { data: signed } = await admin.storage.from(bucket).createSignedUrl(path, 60 * 60 * 24)
      if (signed?.signedUrl) {
        document = { link: signed.signedUrl, filename: "document.pdf" }
      }
    } catch {
      // fall through — send without document rather than failing hard
    }
  }

  const result = await sendTemplateMessage({
    to: toWhatsAppNumber(claimed.to_phone),
    template,
    lang,
    bodyParams: values,
    document,
  })

  if (result.id) {
    await supabase
      .from("wa_messages")
      .update({ status: "sent", wa_message_id: result.id, sent_at: new Date().toISOString(), error: null })
      .eq("id", messageId)
  } else {
    await supabase
      .from("wa_messages")
      .update({ status: "failed", error: result.error ?? "Unknown error" })
      .eq("id", messageId)
  }
}

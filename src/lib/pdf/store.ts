import "server-only"
import { createAdminClient } from "@/lib/supabase/admin"
import { hasServiceRole } from "@/lib/env"
import { getRxData } from "./rx-data"
import { renderRxToBuffer } from "./generate"
import type { Clinic } from "@/lib/clinic"

/**
 * Render the Rx PDF and upload it to the private `rx-pdfs` bucket so it can be
 * attached to a WhatsApp document message. Returns the storage path, or null
 * when the service role isn't configured (dev / dry-run) — the message then
 * sends without an attachment.
 */
export async function storeRxPdf(clinic: Clinic, prescriptionId: string): Promise<string | null> {
  if (!hasServiceRole()) return null
  try {
    const admin = createAdminClient()
    const data = await getRxData(admin, prescriptionId)
    if (!data) return null
    const buffer = await renderRxToBuffer(data)
    const path = `${clinic.id}/${prescriptionId}.pdf`
    const { error } = await admin.storage
      .from("rx-pdfs")
      .upload(path, buffer, { contentType: "application/pdf", upsert: true })
    if (error) return null
    return `rx-pdfs/${path}`
  } catch {
    return null
  }
}

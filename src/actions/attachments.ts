"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { requireClinic } from "@/lib/clinic"
import { firstForeignRef, FOREIGN_REF_ERROR } from "@/lib/ownership"
import { ATTACHMENT_KINDS, MAX_ATTACHMENT_BYTES, ALLOWED_ATTACHMENT_TYPES } from "@/lib/attachments"

export type AttachmentState = { error?: string; ok?: boolean }

const BUCKET = "visit-files"

function extensionFor(file: File): string {
  const fromName = file.name.includes(".") ? file.name.split(".").pop()!.toLowerCase() : ""
  if (/^[a-z0-9]{1,5}$/.test(fromName)) return fromName
  return file.type === "application/pdf" ? "pdf" : "bin"
}

/**
 * Upload a file against a patient (and optionally a visit).
 *
 * Runs on the doctor's own session, not the service role — the `visit-files`
 * bucket has member-scoped storage policies, so uploads work in dev without
 * SUPABASE_SERVICE_ROLE_KEY being set.
 */
export async function uploadAttachment(formData: FormData): Promise<AttachmentState> {
  const clinic = await requireClinic()

  const file = formData.get("file")
  const patientId = String(formData.get("patient_id") ?? "")
  const visitIdRaw = String(formData.get("visit_id") ?? "")
  const kindRaw = String(formData.get("kind") ?? "other")
  const note = String(formData.get("note") ?? "").trim()

  if (!patientId) return { error: "Missing patient." }
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file first." }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return { error: `Files must be under ${Math.round(MAX_ATTACHMENT_BYTES / 1_000_000)} MB.` }
  }
  if (!ALLOWED_ATTACHMENT_TYPES.includes(file.type)) {
    return { error: "Upload a PDF or an image (JPG, PNG, WebP, HEIC)." }
  }
  const kind = (ATTACHMENT_KINDS as readonly string[]).includes(kindRaw) ? kindRaw : "other"

  const supabase = await createClient()

  // The patient and visit ids come from the form. Check them before writing
  // anything: the storage path is built from patientId, so an unchecked id
  // would also file the object under a folder for a patient we do not own.
  const foreign = await firstForeignRef(supabase, clinic.id, [
    ["patients", patientId],
    ["visits", visitIdRaw || null],
  ])
  if (foreign) return { error: FOREIGN_REF_ERROR }

  // Folder layout is {clinic}/{patient}/… — the storage policy checks folder[1]
  // against the caller's clinics, so the path is the access control.
  const path = `${clinic.id}/${patientId}/${crypto.randomUUID()}.${extensionFor(file)}`

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false })
  if (upErr) return { error: "Upload failed. Please try again." }

  const { error } = await supabase.from("visit_attachments").insert({
    clinic_id: clinic.id,
    patient_id: patientId,
    visit_id: visitIdRaw || null,
    storage_path: `${BUCKET}/${path}`,
    file_name: file.name,
    mime_type: file.type,
    size_bytes: file.size,
    kind,
    note: note || null,
  })

  if (error) {
    // Don't leave an orphaned object behind if the row failed to write.
    await supabase.storage.from(BUCKET).remove([path])
    return { error: error.message }
  }

  revalidatePath(`/patients/${patientId}`)
  return { ok: true }
}

/**
 * A short-lived signed URL for viewing one attachment. Five minutes is plenty
 * to open a file and short enough that a copied link is not a lasting leak.
 */
export async function getAttachmentUrl(attachmentId: string): Promise<{ url?: string; error?: string }> {
  await requireClinic()
  const supabase = await createClient()

  const { data: row } = await supabase
    .from("visit_attachments")
    .select("storage_path")
    .eq("id", attachmentId)
    .maybeSingle()
  if (!row) return { error: "File not found." }

  const path = row.storage_path.replace(new RegExp(`^${BUCKET}/`), "")
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 300)
  if (error || !data?.signedUrl) return { error: "Could not open that file." }
  return { url: data.signedUrl }
}

export async function deleteAttachment(attachmentId: string): Promise<AttachmentState> {
  await requireClinic()
  const supabase = await createClient()

  const { data: row } = await supabase
    .from("visit_attachments")
    .select("id, patient_id, storage_path")
    .eq("id", attachmentId)
    .maybeSingle()
  if (!row) return { error: "File not found." }

  const { error } = await supabase.from("visit_attachments").delete().eq("id", attachmentId)
  if (error) return { error: error.message }

  // Best-effort: the record is gone either way, and an orphaned object is
  // preferable to a row pointing at a file that no longer exists.
  await supabase.storage.from(BUCKET).remove([row.storage_path.replace(new RegExp(`^${BUCKET}/`), "")])

  revalidatePath(`/patients/${row.patient_id}`)
  return { ok: true }
}

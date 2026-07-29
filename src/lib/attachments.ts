/**
 * Attachment vocabulary shared by the server action and the client UI.
 *
 * Lives outside `src/actions/attachments.ts` because a `"use server"` module
 * may only export async functions — a plain const there is rewritten into an
 * action reference and reaches the client as a function.
 */

export const ATTACHMENT_KINDS = ["scan", "lab_report", "discharge", "photo", "other"] as const
export type AttachmentKind = (typeof ATTACHMENT_KINDS)[number]

export const ATTACHMENT_KIND_LABELS: Record<AttachmentKind, string> = {
  scan: "Scan / X-ray",
  lab_report: "Lab report",
  discharge: "Discharge summary",
  photo: "Clinical photo",
  other: "Other",
}

/** Must stay in step with the bucket's `file_size_limit` in 0022. */
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024

/** Must stay in step with the bucket's `allowed_mime_types` in 0022. */
export const ALLOWED_ATTACHMENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/pdf",
]

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return ""
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

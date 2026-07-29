"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Paperclip, UploadCloud, Trash2, FileText, Image as ImageIcon, ExternalLink } from "lucide-react"
import { uploadAttachment, getAttachmentUrl, deleteAttachment } from "@/actions/attachments"
import {
  ATTACHMENT_KINDS,
  ATTACHMENT_KIND_LABELS,
  MAX_ATTACHMENT_BYTES,
  formatBytes,
  type AttachmentKind,
} from "@/lib/attachments"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatISTDate } from "@/lib/format"

export type AttachmentRow = {
  id: string
  file_name: string
  mime_type: string | null
  size_bytes: number | null
  kind: string
  note: string | null
  created_at: string
}

/**
 * Files on a visit — scans, lab reports, discharge summaries, photos.
 *
 * Uploads go through the doctor's own session against the member-scoped
 * `visit-files` bucket, so this works without a service-role key. Files are
 * read back through 5-minute signed URLs, never public links.
 */
export function AttachmentPanel({
  patientId,
  visitId,
  attachments,
}: {
  patientId: string
  visitId?: string | null
  attachments: AttachmentRow[]
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [kind, setKind] = useState<AttachmentKind>("lab_report")
  const [note, setNote] = useState("")
  const [pending, start] = useTransition()

  function reset() {
    setFile(null)
    setNote("")
    if (inputRef.current) inputRef.current.value = ""
  }

  function submit() {
    if (!file) return
    const fd = new FormData()
    fd.set("file", file)
    fd.set("patient_id", patientId)
    if (visitId) fd.set("visit_id", visitId)
    fd.set("kind", kind)
    fd.set("note", note)

    start(async () => {
      const res = await uploadAttachment(fd)
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success("File attached")
      reset()
      router.refresh()
    })
  }

  function open(id: string) {
    // Open the tab synchronously on the click, then point it at the signed
    // URL once it arrives — opening after the await would be popup-blocked.
    const tab = window.open("", "_blank")
    start(async () => {
      const res = await getAttachmentUrl(id)
      if (res.error || !res.url) {
        tab?.close()
        toast.error(res.error ?? "Could not open that file.")
        return
      }
      if (tab) tab.location.href = res.url
      else window.location.href = res.url
    })
  }

  function remove(id: string) {
    start(async () => {
      const res = await deleteAttachment(id)
      if (res.error) toast.error(res.error)
      else {
        toast.success("File removed")
        router.refresh()
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Paperclip className="size-4 text-primary" /> Attachments
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {attachments.length > 0 && (
          <ul className="divide-y divide-edge/12 rounded-xl border border-edge/15 bg-background/45 shadow-nm-inset">
            {attachments.map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                {a.mime_type?.startsWith("image/") ? (
                  <ImageIcon className="size-4 shrink-0 text-muted-foreground" />
                ) : (
                  <FileText className="size-4 shrink-0 text-muted-foreground" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{a.file_name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {ATTACHMENT_KIND_LABELS[a.kind as AttachmentKind] ?? a.kind}
                    {a.size_bytes ? ` · ${formatBytes(a.size_bytes)}` : ""} ·{" "}
                    {formatISTDate(a.created_at)}
                    {a.note ? ` · ${a.note}` : ""}
                  </span>
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={pending}
                  onClick={() => open(a.id)}
                  aria-label={`Open ${a.file_name}`}
                >
                  <ExternalLink className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={pending}
                  onClick={() => remove(a.id)}
                  aria-label={`Remove ${a.file_name}`}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        {!file ? (
          <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-edge/30 px-6 py-6 text-center transition-colors hover:border-primary/40 hover:bg-accent/40">
            <UploadCloud className="size-5 text-muted-foreground" />
            <span className="text-sm font-medium">Attach a scan or report</span>
            <span className="text-xs text-muted-foreground">
              PDF or image, up to {Math.round(MAX_ATTACHMENT_BYTES / 1_000_000)} MB
            </span>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
        ) : (
          <div className="space-y-3 rounded-xl border border-edge/15 bg-background/45 p-4 shadow-nm-inset">
            <p className="truncate text-sm font-medium">
              {file.name}{" "}
              <span className="text-xs font-normal text-muted-foreground">
                {formatBytes(file.size)}
              </span>
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as AttachmentKind)}
                aria-label="File type"
                className="h-9 rounded-lg border border-edge/50 bg-background/60 px-3 text-sm shadow-nm-inset"
              >
                {ATTACHMENT_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {ATTACHMENT_KIND_LABELS[k]}
                  </option>
                ))}
              </select>
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Note (optional)"
                aria-label="Note"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={pending} onClick={submit}>
                {pending ? "Uploading…" : "Upload"}
              </Button>
              <Button type="button" variant="outline" disabled={pending} onClick={reset}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

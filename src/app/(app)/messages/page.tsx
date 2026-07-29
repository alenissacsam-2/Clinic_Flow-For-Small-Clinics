import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { requireClinic } from "@/lib/clinic"
import { whatsappConfigured } from "@/lib/whatsapp/client"
import { formatISTDateTime, formatPhoneDisplay } from "@/lib/format"
import { MESSAGE_STATUS, TONE } from "@/lib/status"
import type { Enums } from "@/types/database"
import { cn } from "@/lib/utils"
import { TriangleAlert } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { RetryButton } from "@/components/messages/retry-button"
import { Pagination, parsePage } from "@/components/pagination"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type Row = {
  id: string
  direction: "in" | "out"
  template_name: string | null
  body: string | null
  status: Enums<"wa_status">
  to_phone: string
  created_at: string
  patient: { id: string; full_name: string } | null
}

const PAGE_SIZE = 50

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  await requireClinic()
  const { page: rawPage } = await searchParams
  const page = parsePage(rawPage)
  const supabase = await createClient()

  // The delivery log is the fastest-growing table in the product — every
  // reminder, confirmation and receipt lands here — so a bare `.limit(100)`
  // meant it stopped being a log within about a fortnight of real use.
  const { data, count } = await supabase
    .from("wa_messages")
    .select(
      "id, direction, template_name, body, status, to_phone, created_at, patient:patients(id, full_name)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

  const rows = (data ?? []) as unknown as Row[]
  const total = count ?? rows.length

  return (
    <div>
      <PageHeader title="Messages" description="WhatsApp delivery log." />

      {!whatsappConfigured() && (
        <div className={cn("mb-4 flex gap-2.5 rounded-lg border p-3 text-sm text-warning", TONE.warning.banner)}>
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <p>
            WhatsApp isn&apos;t connected yet — messages run in <strong>dry-run</strong> mode (queued
            and marked sent, but not actually delivered). Add your Meta Cloud API credentials in the
            environment to go live.
          </p>
        </div>
      )}

      <div className="rounded-xl border border-edge/20 bg-card shadow-nm-raised">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Patient</TableHead>
              <TableHead className="hidden md:table-cell">Message</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden sm:table-cell">Time</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!rows.length && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  No messages yet. They&apos;ll appear here as appointments and prescriptions go out.
                </TableCell>
              </TableRow>
            )}
            {rows.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">
                  {m.patient ? (
                    <Link href={`/patients/${m.patient.id}`} className="hover:underline">
                      {m.patient.full_name}
                    </Link>
                  ) : (
                    formatPhoneDisplay(m.to_phone)
                  )}
                </TableCell>
                <TableCell className="hidden max-w-xs truncate md:table-cell text-muted-foreground">
                  {m.body ?? "—"}
                </TableCell>
                <TableCell className="text-xs">
                  {m.direction === "in" ? (
                    <Badge variant="secondary">Inbound</Badge>
                  ) : (
                    <span className="text-muted-foreground">{m.template_name}</span>
                  )}
                </TableCell>
                <TableCell>
                  <span className={`text-sm ${MESSAGE_STATUS[m.status].text}`}>
                    {MESSAGE_STATUS[m.status].label}
                  </span>
                </TableCell>
                <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                  {formatISTDateTime(m.created_at)}
                </TableCell>
                <TableCell className="text-right">
                  {m.status === "failed" && <RetryButton messageId={m.id} />}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {rows.length > 0 && (
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            baseHref="/messages"
            noun="messages"
          />
        )}
      </div>
    </div>
  )
}

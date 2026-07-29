"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Check, X, BellRing } from "lucide-react"
import { acceptBooking, rejectBooking } from "@/actions/appointments"
import { formatISTDateTime, formatPhoneDisplay } from "@/lib/format"
import { TONE } from "@/lib/status"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

export type PendingRow = {
  id: string
  starts_at: string
  reason: string | null
  patient: { full_name: string; phone: string } | null
}

export function PendingBookings({ rows, total }: { rows: PendingRow[]; total?: number }) {
  const router = useRouter()
  const [pending, start] = useTransition()

  if (!rows.length) return null
  // The badge counts everything waiting, not just what fits on screen.
  const count = total ?? rows.length
  const hidden = Math.max(0, count - rows.length)

  function act(fn: () => Promise<{ error?: string }>, msg: string) {
    start(async () => {
      const res = await fn()
      if (res.error) toast.error(res.error)
      else {
        toast.success(msg)
        router.refresh()
      }
    })
  }

  return (
    <div className={cn("mb-6 rounded-lg border p-4", TONE.warning.banner)}>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-warning">
        <BellRing className="size-4" />
        Online booking requests
        <span className="rounded-full bg-warning/15 px-2 py-0.5 text-xs tabular-nums text-warning">
          {count}
        </span>
      </h2>
      <div className="space-y-2">
        {rows.map((r) => (
          <div
            key={r.id}
            className="flex flex-wrap items-center gap-3 rounded-md border bg-card p-3"
          >
            <div className="min-w-0 flex-1">
              <p className="font-medium">{r.patient?.full_name ?? "Unknown"}</p>
              <p className="text-xs text-muted-foreground">
                {r.patient ? formatPhoneDisplay(r.patient.phone) : ""} · {formatISTDateTime(r.starts_at)}
                {r.reason ? ` · ${r.reason}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                disabled={pending}
                onClick={() => act(() => acceptBooking(r.id), "Booking confirmed")}
              >
                <Check className="size-4" /> Accept
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-muted-foreground"
                disabled={pending}
                onClick={() => act(() => rejectBooking(r.id), "Booking declined")}
              >
                <X className="size-4" /> Decline
              </Button>
            </div>
          </div>
        ))}
        {hidden > 0 && (
          <p className="px-1 pt-1 text-xs text-muted-foreground">
            and {hidden} more request{hidden === 1 ? "" : "s"} waiting — clear some to see them.
          </p>
        )}
      </div>
    </div>
  )
}

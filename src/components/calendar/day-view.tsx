"use client"

import Link from "next/link"
import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Ban, CalendarOff, X } from "lucide-react"
import { EmptyState } from "@/components/empty-state"
import { cancelAppointment } from "@/actions/appointments"
import { removeBlock, reopenDay } from "@/actions/blocks"
import { BookSlotDialog } from "./book-slot-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { APPOINTMENT_STATUS } from "@/lib/status"
import { cn } from "@/lib/utils"
import { initials } from "@/lib/name"
import type { DaySlot } from "@/lib/appointments-data"

export type BlockChip = { id: string; start_time: string; end_time: string; reason: string | null }

function to12h(hhmmss: string): string {
  const h = Number(hhmmss.slice(0, 2))
  const m = hhmmss.slice(3, 5)
  const ap = h >= 12 ? "PM" : "AM"
  const h12 = h % 12 || 12
  return `${h12}:${m} ${ap}`
}

export function DayView({
  rows,
  dateKey,
  blocks,
  dayClosed,
}: {
  rows: DaySlot[]
  dateKey: string
  blocks: BlockChip[]
  dayClosed: boolean
}) {
  const router = useRouter()
  const [pending, start] = useTransition()

  function cancel(id: string) {
    start(async () => {
      const res = await cancelAppointment(id)
      if (res.error) toast.error(res.error)
      else {
        toast.success("Appointment cancelled")
        router.refresh()
      }
    })
  }

  function unblock(id: string) {
    start(async () => {
      const res = await removeBlock(id)
      if (res.error) toast.error(res.error)
      else {
        toast.success("Block removed")
        router.refresh()
      }
    })
  }

  function reopen() {
    start(async () => {
      const res = await reopenDay(dateKey)
      if (res.error) toast.error(res.error)
      else {
        toast.success("Day reopened")
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-4">
      {dayClosed && (
        <div className="flex items-center justify-between rounded-xl border border-dashed border-edge/30 bg-background/40 shadow-nm-inset px-4 py-3 text-sm">
          <span className="font-medium">This day is closed.</span>
          <Button size="sm" variant="outline" onClick={reopen} disabled={pending}>
            Reopen day
          </Button>
        </div>
      )}

      {blocks.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {blocks.map((b) => (
            <span
              key={b.id}
              // A block is time struck out of the day, so it sits recessed —
              // the same gesture as the hatched rows it corresponds to.
              className="inline-flex items-center gap-1.5 rounded-full border border-edge/25 bg-muted/50 py-1 pl-3 pr-1 text-xs font-medium shadow-nm-inset"
            >
              <Ban className="size-3 text-muted-foreground" />
              {to12h(b.start_time)}–{to12h(b.end_time)}
              {b.reason ? ` · ${b.reason}` : ""}
              <button
                type="button"
                onClick={() => unblock(b.id)}
                disabled={pending}
                title="Remove block"
                className="rounded-full p-0.5 hover:bg-card"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {!rows.length ? (
        <EmptyState
          icon={CalendarOff}
          title="No slots on this day"
          description="The clinic is closed, or every slot is blocked. Check your hours in Settings."
        />
      ) : (
        <div className="divide-y divide-edge/12 overflow-hidden rounded-xl border border-edge/15 bg-background/45 shadow-nm-inset">
          {rows.map((row) => {
            const st = row.kind === "booked" ? APPOINTMENT_STATUS[row.appt.status] : null
            return (
              <div
                key={row.startUtc + (row.kind === "booked" ? row.appt.id : row.kind)}
                className={cn(
                  "relative flex items-center gap-4 py-2.5 pr-4 pl-5 transition-colors",
                  row.kind === "booked" && "hover:bg-accent/30",
                  row.kind === "blocked" && "bg-hatch",
                )}
              >
                {/* Status rail (booked rows only) — mirrors the queue. */}
                {st && (
                  <span
                    aria-hidden
                    className={cn("absolute inset-y-0 left-0 w-1", st.rail)}
                  />
                )}

                <div className="w-20 shrink-0 text-sm font-medium tabular-nums text-muted-foreground">
                  {row.label}
                </div>

                {row.kind === "open" ? (
                  <>
                    <div className="flex-1 text-sm text-muted-foreground">Available</div>
                    <BookSlotDialog startUtc={row.startUtc} label={row.label} />
                  </>
                ) : row.kind === "blocked" ? (
                  <div className="flex flex-1 items-center gap-2 text-sm text-muted-foreground">
                    <Ban className="size-3.5" />
                    Blocked{row.reason ? ` · ${row.reason}` : ""}
                  </div>
                ) : (
                  <>
                    <Avatar className="hidden shrink-0 sm:flex" size="sm">
                      <AvatarFallback className="bg-primary/10 text-[10px] font-medium text-primary">
                        {initials(row.appt.patient?.full_name ?? "?")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/patients/${row.appt.patient?.id}`}
                        className="font-medium hover:underline"
                      >
                        {row.appt.patient?.full_name ?? "Unknown"}
                      </Link>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {row.appt.token_number ? `Token ${row.appt.token_number}` : ""}
                        {row.appt.reason ? ` · ${row.appt.reason}` : ""}
                      </span>
                    </div>
                    <Badge variant="outline" className={st!.badge}>
                      {st!.label}
                    </Badge>
                    {["pending", "confirmed", "arrived"].includes(row.appt.status) && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-muted-foreground"
                        disabled={pending}
                        onClick={() => cancel(row.appt.id)}
                      >
                        Cancel
                      </Button>
                    )}
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

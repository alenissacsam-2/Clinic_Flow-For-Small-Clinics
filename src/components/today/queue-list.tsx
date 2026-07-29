"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { MoreVertical } from "lucide-react"
import { setAppointmentStatus, cancelAppointment } from "@/actions/appointments"
import { formatISTTime } from "@/lib/format"
import { APPOINTMENT_STATUS, TONE } from "@/lib/status"
import { cn } from "@/lib/utils"
import { initials } from "@/lib/name"
import { EmptyState } from "@/components/empty-state"
import { ClipboardList } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Enums } from "@/types/database"

export type QueueRow = {
  id: string
  starts_at: string
  status: Enums<"appointment_status">
  source: Enums<"appointment_source">
  token_number: number | null
  reason: string | null
  patient: { id: string; full_name: string; phone: string } | null
  intakeDone?: boolean
}

export function QueueList({ rows }: { rows: QueueRow[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()

  function act(fn: () => Promise<{ error?: string }>, okMsg?: string) {
    start(async () => {
      const res = await fn()
      if (res.error) toast.error(res.error)
      else {
        if (okMsg) toast.success(okMsg)
        router.refresh()
      }
    })
  }

  if (!rows.length) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="The queue is empty"
        description="Nobody has checked in yet. Add a walk-in, or book someone from the calendar."
      />
    )
  }

  return (
    <div className="space-y-2.5">
      {rows.map((r) => {
        const s = APPOINTMENT_STATUS[r.status]
        const canCancel =
          r.status === "pending" || r.status === "confirmed" || r.status === "arrived"
        const hasMenu = r.status === "arrived" || canCancel
        // Depth carries the queue's meaning: everyone waiting sits recessed IN
        // the day-plane, and the single patient in consultation lifts OUT of
        // it. Scanning the list for "who am I seeing right now" becomes a
        // glance at which row is raised, before reading a single word.
        const active = r.status === "in_progress"
        return (
          <div
            key={r.id}
            className={cn(
              "relative flex flex-wrap items-center gap-3 overflow-hidden rounded-xl transition-shadow duration-200 p-3 pl-4",
              active
                ? "border border-primary/30 bg-card shadow-nm-float"
                : "border border-edge/15 bg-background/55 shadow-nm-inset",
            )}
          >
            {/* Status rail — colour-coded margin, unchanged from status.ts. */}
            <span
              aria-hidden
              className={cn("absolute inset-y-0 left-0 w-1 transition-colors", s.rail)}
            />

            {/* Token stamp — pressed into a waiting row, raised on the active
                one, so the chip agrees with the row it sits on. */}
            <div
              className={cn(
                "flex size-11 shrink-0 items-center justify-center rounded-xl",
                active
                  ? "bg-primary text-primary-foreground shadow-nm-raised"
                  : "bg-muted/70 text-muted-foreground shadow-nm-inset",
              )}
            >
              <span className="font-heading text-lg font-bold tabular-nums leading-none">
                {r.token_number ?? "—"}
              </span>
            </div>

            <Avatar className="hidden shrink-0 sm:flex">
              <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
                {initials(r.patient?.full_name ?? "?")}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Link href={`/patients/${r.patient?.id}`} className="font-medium hover:underline">
                  {r.patient?.full_name ?? "Unknown"}
                </Link>
                {r.source === "walk_in" && (
                  <Badge variant="secondary" className="text-[10px]">
                    Walk-in
                  </Badge>
                )}
                {r.source === "online" && (
                  <Badge variant="secondary" className="text-[10px]">
                    Online
                  </Badge>
                )}
                {r.intakeDone && (
                  <Badge className={cn("text-[10px]", TONE.success.tint)}>Intake ✓</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {formatISTTime(r.starts_at)}
                {r.reason ? ` · ${r.reason}` : ""}
              </p>
            </div>

            {/* Status and actions share a wrapper that is `w-full` below `sm`,
                which makes it wrap onto its own line. Without it the row's
                flex children all compete for 390px and the *name* is what
                loses — measured at 390px, "Vikram Reddy · Diabetes follow-up"
                was breaking across three lines while a 96px button sat beside
                it. The patient's name is the one thing in the row that must
                never wrap. */}
            <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
              <Badge variant="outline" className={cn(s.badge, "transition-all duration-200")}>
                {s.label}
              </Badge>

              <div className="flex items-center gap-1.5">
                {(r.status === "pending" || r.status === "confirmed") && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() =>
                      act(() => setAppointmentStatus(r.id, "arrived"), "Marked arrived")
                    }
                  >
                    Mark arrived
                  </Button>
                )}
                {r.status === "arrived" && (
                  <Button
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const res = await setAppointmentStatus(r.id, "in_progress")
                        if (res.error) toast.error(res.error)
                        else router.push(`/visit/${r.id}`)
                      })
                    }
                  >
                    Start visit
                  </Button>
                )}
                {r.status === "in_progress" && (
                  <Button
                    size="sm"
                    disabled={pending}
                    onClick={() => router.push(`/visit/${r.id}`)}
                  >
                    Resume visit
                  </Button>
                )}

                {hasMenu && (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      aria-label="More actions"
                      disabled={pending}
                      className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}
                    >
                      <MoreVertical />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {r.status === "arrived" && (
                        <DropdownMenuItem
                          onClick={() => act(() => setAppointmentStatus(r.id, "no_show"))}
                        >
                          Mark no-show
                        </DropdownMenuItem>
                      )}
                      {canCancel && (
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => act(() => cancelAppointment(r.id))}
                        >
                          Cancel appointment
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

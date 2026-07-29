"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { ArrowRight, CheckCircle2, Clock3, Coffee, Stethoscope } from "lucide-react"

import { setAppointmentStatus } from "@/actions/appointments"
import { formatISTTime } from "@/lib/format"
import { initials } from "@/lib/name"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Elapsed } from "@/components/elapsed"
import type { QueueRow } from "./queue-list"

/**
 * The single most important thing on the Today screen: who is in the room, and
 * who is coming in next.
 *
 * ── Why this is not just the top of the queue list ────────────────────────
 * The list answers "what does the day look like". It answers it by making you
 * read nine rows. But between two patients a doctor has exactly two questions,
 * and both have one-word answers: *who now* and *who next*. Making them scan a
 * list for that is making them do lookup work in the ten seconds they have
 * while someone walks in.
 *
 * So the two rows the queue would have buried are lifted out and given the
 * screen's only large type and its only primary buttons. The list below still
 * holds the whole day — this is a focus, not a replacement.
 *
 * The depth grammar is the same one the rest of the app uses: the active
 * consultation is `shadow-nm-float`, standing furthest off the page, because
 * it is the one thing happening. Up-next is raised but flatter. Everything
 * else on the screen is recessed.
 */
export function DayFocus({ rows }: { rows: QueueRow[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()

  const current = rows.find((r) => r.status === "in_progress") ?? null
  // "Next" is whoever is physically here and waiting, in token order; only if
  // nobody has arrived does it fall back to the next confirmed booking. A
  // patient sitting outside always outranks one who is still at home.
  const queue = rows.filter((r) => r.id !== current?.id)
  const next =
    queue.find((r) => r.status === "arrived") ?? queue.find((r) => r.status === "confirmed") ?? null

  if (!current && !next) return null

  function begin(id: string) {
    start(async () => {
      const res = await setAppointmentStatus(id, "in_progress")
      if (res.error) toast.error(res.error)
      else router.push(`/visit/${id}`)
    })
  }

  return (
    <div className="mb-6 grid gap-4 lg:grid-cols-[1.25fr_1fr]">
      {/* ── In the room ─────────────────────────────────────────────────── */}
      {current ? (
        <Panel
          tone="active"
          eyebrow={
            <>
              <span className="animate-live-dot size-1.5 rounded-full bg-primary" />
              In consultation
            </>
          }
        >
          <Person row={current} big />
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button size="sm" disabled={pending} onClick={() => router.push(`/visit/${current.id}`)}>
              Resume visit
              <ArrowRight />
            </Button>
            <span className="text-xs text-muted-foreground">
              Started {formatISTTime(current.starts_at)} ·{" "}
              <Elapsed iso={current.starts_at} fallback="in progress" className="font-medium" />
            </span>
          </div>
        </Panel>
      ) : (
        <Panel
          tone="idle"
          eyebrow={
            <>
              <Coffee className="size-3.5" />
              Nobody in the room
            </>
          }
        >
          <p className="mt-1 text-sm text-muted-foreground">
            {next
              ? "Free right now — start the next patient whenever you're ready."
              : "The consultation room is free."}
          </p>
        </Panel>
      )}

      {/* ── Up next ─────────────────────────────────────────────────────── */}
      {next ? (
        <Panel
          tone="next"
          eyebrow={
            <>
              <Clock3 className="size-3.5" />
              {next.status === "arrived" ? "Waiting outside" : "Next booking"}
            </>
          }
        >
          <Person row={next} />
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant={current ? "outline" : "default"}
              disabled={pending}
              onClick={() => begin(next.id)}
            >
              <Stethoscope />
              Start visit
            </Button>
            {next.status === "arrived" && (
              <span className="text-xs text-muted-foreground">
                Waiting <Elapsed iso={next.starts_at} fallback="" className="font-medium" />
              </span>
            )}
          </div>
        </Panel>
      ) : (
        <Panel
          tone="idle"
          eyebrow={
            <>
              <CheckCircle2 className="size-3.5" />
              Queue clear
            </>
          }
        >
          <p className="mt-1 text-sm text-muted-foreground">
            Nobody else is waiting. Everything booked for today has been seen.
          </p>
        </Panel>
      )}
    </div>
  )
}

function Panel({
  tone,
  eyebrow,
  children,
}: {
  tone: "active" | "next" | "idle"
  eyebrow: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl p-5",
        tone === "active" && "border border-primary/30 bg-card shadow-nm-float",
        tone === "next" && "border border-edge/20 bg-card shadow-nm-raised",
        tone === "idle" && "border border-edge/15 bg-background/55 shadow-nm-inset",
      )}
    >
      {tone === "active" && (
        // A wash of the primary, top-left, so the active card is warmer than
        // the one beside it even in a black-and-white screenshot of the page.
        <span
          aria-hidden
          className="glow-primary pointer-events-none absolute -top-16 -left-10 size-52 rounded-full opacity-40 blur-2xl"
        />
      )}
      <p className="relative flex items-center gap-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {eyebrow}
      </p>
      <div className="relative">{children}</div>
    </div>
  )
}

function Person({ row, big = false }: { row: QueueRow; big?: boolean }) {
  return (
    <div className={cn("mt-3 flex items-center gap-3")}>
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-xl font-heading font-bold tabular-nums leading-none",
          big
            ? "size-14 bg-primary text-2xl text-primary-foreground shadow-nm-raised"
            : "size-11 bg-muted/70 text-lg text-muted-foreground shadow-nm-inset",
        )}
      >
        {row.token_number ?? initials(row.patient?.full_name ?? "?")}
      </span>
      <div className="min-w-0">
        <Link
          href={`/patients/${row.patient?.id}`}
          className={cn(
            "block truncate font-heading font-bold tracking-[-0.02em] hover:underline",
            big ? "text-2xl" : "text-lg",
          )}
        >
          {row.patient?.full_name ?? "Unknown"}
        </Link>
        <p className="truncate text-sm text-muted-foreground">
          {row.reason || "No reason recorded"}
          {row.intakeDone && <span className="ml-2 text-success">· intake done</span>}
        </p>
      </div>
    </div>
  )
}

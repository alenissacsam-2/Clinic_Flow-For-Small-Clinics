"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Ban } from "lucide-react"
import { previewBlockImpact, applyBlock, type BlockPreview } from "@/actions/blocks"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

type Mode = "day" | "range"

export function BlockTimeDialog({ dateKey }: { dateKey: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<Mode>("range")
  const [startTime, setStartTime] = useState("13:00")
  const [endTime, setEndTime] = useState("14:00")
  const [reason, setReason] = useState("")
  const [preview, setPreview] = useState<BlockPreview | null>(null)
  const [pending, start] = useTransition()

  function reset() {
    setPreview(null)
    setReason("")
    setMode("range")
  }

  function loadPreview() {
    const wholeDay = mode === "day"
    if (!wholeDay && startTime >= endTime) {
      toast.error("End time must be after start time")
      return
    }
    start(async () => {
      const p = await previewBlockImpact({ dateKey, wholeDay, startTime, endTime })
      setPreview(p)
    })
  }

  function confirm() {
    const wholeDay = mode === "day"
    start(async () => {
      const res = await applyBlock({
        dateKey,
        wholeDay,
        startTime,
        endTime,
        reason,
        cancelIds: preview?.affected.map((a) => a.id) ?? [],
      })
      if (res.error) {
        toast.error(res.error)
        return
      }
      const n = preview?.affected.length ?? 0
      toast.success(n > 0 ? `Blocked · ${n} patient${n > 1 ? "s" : ""} notified` : "Time blocked")
      setOpen(false)
      reset()
      router.refresh()
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) reset()
      }}
    >
      <DialogTrigger
        render={
          <Button variant="outline">
            <Ban className="size-4" />
            Block time
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Block time</DialogTitle>
          <DialogDescription>
            Close a session or the whole day. Patients already booked in that window are cancelled
            and notified on WhatsApp.
          </DialogDescription>
        </DialogHeader>

        {!preview ? (
          <div className="space-y-4">
            <div className="flex gap-2">
              <ModeButton active={mode === "range"} onClick={() => setMode("range")}>
                Time range
              </ModeButton>
              <ModeButton active={mode === "day"} onClick={() => setMode("day")}>
                Whole day
              </ModeButton>
            </div>

            {mode === "range" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="block_start">From</Label>
                  <Input
                    id="block_start"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="block_end">To</Label>
                  <Input
                    id="block_end"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="block_reason">Reason (optional)</Label>
              <Input
                id="block_reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Lunch, surgery, personal…"
              />
            </div>

            <DialogFooter>
              <Button onClick={loadPreview} disabled={pending}>
                {pending ? "Checking…" : "Continue"}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            {preview.affected.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No booked patients in this window. Nothing will be cancelled.
              </p>
            ) : (
              <div className="space-y-2">
                <p className="text-sm font-medium text-destructive">
                  {preview.affected.length} patient{preview.affected.length > 1 ? "s" : ""} will be
                  cancelled and notified on WhatsApp:
                </p>
                <ul className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-edge/15 bg-background/45 p-2 text-sm shadow-nm-inset">
                  {preview.affected.map((a) => (
                    <li key={a.id} className="flex justify-between">
                      <span>{a.name}</span>
                      <span className="text-muted-foreground">
                        {a.time}
                        {a.token ? ` · #${a.token}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {preview.keptCount > 0 && (
              <p className="text-xs text-muted-foreground">
                {preview.keptCount} completed/ongoing visit{preview.keptCount > 1 ? "s" : ""} in this
                window will be left untouched.
              </p>
            )}
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setPreview(null)} disabled={pending}>
                Back
              </Button>
              <Button variant="destructive" onClick={confirm} disabled={pending}>
                {pending ? "Blocking…" : "Block & notify"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors " +
        (active ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted")
      }
    >
      {children}
    </button>
  )
}

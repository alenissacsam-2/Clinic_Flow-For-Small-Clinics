"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ShieldCheck } from "lucide-react"
import { requestPatientConsent } from "@/actions/abdm"
import { HI_TYPES } from "@/lib/abdm/consent"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { formatISTDate } from "@/lib/format"
import { TONE } from "@/lib/status"
import { cn } from "@/lib/utils"

export type ConsentRow = {
  id: string
  status: string
  hi_types: string[]
  created_at: string
  expires_at: string | null
  request_id: string | null
}

const STATUS_TONE: Record<string, keyof typeof TONE> = {
  requested: "info",
  granted: "success",
  denied: "danger",
  expired: "warning",
  revoked: "warning",
}

const DEFAULT_TYPES = ["OPConsultation", "Prescription"]

/**
 * ABDM consent — request a patient's records from other providers.
 *
 * The copy is deliberately blunt about dry-run: a clinic must never believe a
 * consent request reached the gateway when no credentials are configured.
 */
export function AbdmConsent({
  patientId,
  hasAbhaAddress,
  live,
  artefacts,
}: {
  patientId: string
  hasAbhaAddress: boolean
  live: boolean
  artefacts: ConsentRow[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<string[]>(DEFAULT_TYPES)
  const [pending, start] = useTransition()

  function toggle(type: string) {
    setSelected((s) => (s.includes(type) ? s.filter((t) => t !== type) : [...s, type]))
  }

  function submit() {
    start(async () => {
      const res = await requestPatientConsent({ patientId, hiTypes: selected })
      if (res.error) {
        toast.error(res.error)
        return
      }
      setOpen(false)
      toast.success(
        res.dryRun
          ? "Recorded locally — the ABDM gateway is not configured, so nothing was sent."
          : "Consent request sent. The patient approves it in their ABHA app.",
      )
      router.refresh()
    })
  }

  return (
    <div className="space-y-3">
      {!live && (
        <p className={cn("rounded-lg border p-3 text-xs", TONE.info.banner)}>
          The ABDM gateway is not configured, so requests are recorded here but never sent. Going
          live needs NHA registration and the <code className="font-mono">ABDM_*</code> environment
          variables — see the README.
        </p>
      )}

      {artefacts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-edge/30 bg-background/40 shadow-nm-inset py-8 text-center text-sm text-muted-foreground">
          No consent requested yet.
        </div>
      ) : (
        <ul className="divide-y divide-edge/12 rounded-xl border border-edge/15 bg-background/45 shadow-nm-inset">
          {artefacts.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
              <span>{formatISTDate(a.created_at)}</span>
              <span className="text-xs text-muted-foreground">{a.hi_types.join(", ")}</span>
              <Badge variant="outline" className={TONE[STATUS_TONE[a.status] ?? "info"].text}>
                {a.status}
              </Badge>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger
          render={
            <Button variant="outline" size="sm" disabled={!hasAbhaAddress}>
              <ShieldCheck className="size-4" /> Request consent
            </Button>
          }
        />
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request health records</DialogTitle>
            <DialogDescription>
              The patient approves this in their own ABHA app. Nothing is fetched until they do.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            {HI_TYPES.map((type) => (
              <label key={type} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selected.includes(type)}
                  onChange={() => toggle(type)}
                  className="size-4 rounded border-input"
                />
                {type}
              </label>
            ))}
            <p className="pt-1 text-xs text-muted-foreground">
              Covers the last 12 months. The consent expires after 30 days.
            </p>
          </div>

          <DialogFooter>
            <Button disabled={pending || selected.length === 0} onClick={submit}>
              {pending ? "Requesting…" : "Request consent"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {!hasAbhaAddress && (
        <p className="text-xs text-muted-foreground">
          Add this patient&apos;s ABHA address to request their records.
        </p>
      )}
    </div>
  )
}

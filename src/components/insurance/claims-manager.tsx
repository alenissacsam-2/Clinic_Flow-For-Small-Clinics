"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Plus, ChevronDown, ChevronRight } from "lucide-react"
import { createPayer, advanceClaim } from "@/actions/insurance"
import {
  CLAIM_STATUS_LABELS,
  CLAIM_STATUS_TONE,
  CLAIM_NEXT,
  PAYER_KINDS,
  PAYER_KIND_LABELS,
  type ClaimStatus,
  type PayerKind,
} from "@/lib/insurance"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { formatINR, formatISTDate } from "@/lib/format"
import { TONE } from "@/lib/status"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

export type ClaimEventRow = {
  id: string
  status: string
  amount: number | null
  note: string | null
  created_at: string
}

export type ClaimRow = {
  id: string
  status: string
  claim_no: string | null
  preauth_no: string | null
  claimed_amount: number
  approved_amount: number | null
  settled_amount: number | null
  created_at: string
  payer: { name: string } | null
  patient: { full_name: string } | null
  events: ClaimEventRow[]
}

export function ClaimsManager({ claims }: { claims: ClaimRow[] }) {
  return (
    <div className="space-y-3">
      <NewPayerDialog />
      {claims.length === 0 ? (
        <div className="rounded-xl border border-dashed border-edge/30 bg-background/40 shadow-nm-inset py-10 text-center text-sm text-muted-foreground">
          No claims yet. Open one from an invoice.
        </div>
      ) : (
        <ul className="space-y-2">
          {claims.map((c) => (
            <ClaimCard key={c.id} claim={c} />
          ))}
        </ul>
      )}
    </div>
  )
}

function ClaimCard({ claim }: { claim: ClaimRow }) {
  const router = useRouter()
  const [expanded, setExpanded] = useState(false)
  const [amount, setAmount] = useState("")
  const [note, setNote] = useState("")
  const [pending, start] = useTransition()

  const status = claim.status as ClaimStatus
  const next = CLAIM_NEXT[status] ?? []

  function move(to: ClaimStatus) {
    start(async () => {
      const res = await advanceClaim({ claimId: claim.id, status: to, amount, note })
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success(`Claim marked ${CLAIM_STATUS_LABELS[to].toLowerCase()}`)
      setAmount("")
      setNote("")
      router.refresh()
    })
  }

  return (
    <li className="rounded-xl border border-edge/15 bg-background/45 shadow-nm-inset">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full flex-wrap items-center gap-2 px-4 py-2.5 text-left text-sm"
      >
        {expanded ? (
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        )}
        <span className="min-w-0 flex-1 truncate font-medium">
          {claim.patient?.full_name ?? "Patient"}
        </span>
        <span className="text-xs text-muted-foreground">{claim.payer?.name}</span>
        <span className="tabular-nums">{formatINR(claim.claimed_amount)}</span>
        <Badge variant="outline" className={TONE[CLAIM_STATUS_TONE[status] ?? "info"].text}>
          {CLAIM_STATUS_LABELS[status] ?? claim.status}
        </Badge>
      </button>

      {expanded && (
        <div className="space-y-3 border-t px-4 py-3">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
            <Money label="Claimed" value={claim.claimed_amount} />
            <Money label="Approved" value={claim.approved_amount} />
            <Money label="Settled" value={claim.settled_amount} />
            <div>
              <dt className="text-xs text-muted-foreground">Claim no.</dt>
              <dd className="font-mono text-xs">{claim.claim_no ?? "—"}</dd>
            </div>
          </dl>

          {claim.events.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">History</p>
              <ul className="space-y-1 text-xs">
                {claim.events.map((e) => (
                  <li key={e.id} className="flex flex-wrap gap-x-2 text-muted-foreground">
                    <span>{formatISTDate(e.created_at)}</span>
                    <span className="font-medium text-foreground">
                      {CLAIM_STATUS_LABELS[e.status as ClaimStatus] ?? e.status}
                    </span>
                    {e.amount != null && <span>{formatINR(e.amount)}</span>}
                    {e.note && <span>· {e.note}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {next.length > 0 && (
            <div className="space-y-2">
              <div className="grid gap-2 sm:grid-cols-2">
                <Input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Amount (for approve / settle)"
                  aria-label="Amount"
                />
                <Input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Note (what the payer said)"
                  aria-label="Note"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {next.map((s) => (
                  <Button
                    key={s}
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => move(s)}
                  >
                    {CLAIM_STATUS_LABELS[s]}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </li>
  )
}

function Money({ label, value }: { label: string; value: number | null }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("tabular-nums", value == null && "text-muted-foreground")}>
        {value == null ? "—" : formatINR(value)}
      </dd>
    </div>
  )
}

function NewPayerDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: "", kind: "tpa" as PayerKind, code: "", contact: "" })
  const [pending, start] = useTransition()

  function submit() {
    start(async () => {
      const res = await createPayer(form)
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success("Payer added")
      setOpen(false)
      setForm({ name: "", kind: "tpa", code: "", contact: "" })
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm">
            <Plus className="size-4" /> Add payer
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add an insurer or TPA</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="payer-name">Name</Label>
            <Input
              id="payer-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="payer-kind">Type</Label>
            <select
              id="payer-kind"
              value={form.kind}
              onChange={(e) => setForm({ ...form, kind: e.target.value as PayerKind })}
              className="h-9 w-full rounded-lg border border-edge/50 bg-background/60 px-3 text-sm shadow-nm-inset"
            >
              {PAYER_KINDS.map((k) => (
                <option key={k} value={k}>
                  {PAYER_KIND_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="payer-code">Provider code (optional)</Label>
            <Input
              id="payer-code"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" disabled={pending || !form.name.trim()} onClick={submit}>
            {pending ? "Adding…" : "Add payer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

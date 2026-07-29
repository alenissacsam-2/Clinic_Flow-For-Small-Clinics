"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { FlaskConical, X, ChevronDown, ChevronRight } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { createLabOrder, saveLabResults, setLabOrderStatus, type LabResultInput } from "@/actions/labs"
import { formatRange, type LabFlag } from "@/lib/clinical/lab-result"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatISTDate } from "@/lib/format"
import { TONE } from "@/lib/status"
import { cn } from "@/lib/utils"

type Test = {
  id: string
  name: string
  short_name: string | null
  category: string | null
  loinc_code: string | null
  unit: string | null
}

export type LabItemRow = {
  id: string
  test_name: string
  loinc_code: string | null
  unit: string | null
  value_text: string | null
  reference_low: number | null
  reference_high: number | null
  reference_text: string | null
  flag: string | null
  note: string | null
}

export type LabOrderRow = {
  id: string
  status: string
  lab_name: string | null
  ordered_at: string
  resulted_at: string | null
  items: LabItemRow[]
}

const FLAG_TONE: Record<LabFlag, keyof typeof TONE> = {
  low: "warning",
  high: "warning",
  abnormal: "danger",
  normal: "success",
}

const STATUS_TONE: Record<string, keyof typeof TONE> = {
  ordered: "info",
  collected: "info",
  resulted: "success",
  cancelled: "warning",
}

/**
 * Lab & radiology orders with results.
 *
 * The high/low flag beside a result is arithmetic on the reference range the
 * clinic copied off the lab's own report — ClinicFlow ships no reference
 * ranges, because they are method-, lab-, age- and sex-specific. No range
 * entered means no flag, and the result still records fine.
 */
export function LabPanel({
  patientId,
  visitId,
  orders,
}: {
  patientId: string
  visitId?: string | null
  orders: LabOrderRow[]
}) {
  const router = useRouter()
  const [term, setTerm] = useState("")
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<Test[]>([])
  const [picked, setPicked] = useState<Test[]>([])
  const [labName, setLabName] = useState("")
  const [pending, start] = useTransition()
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const supabase = createClient()
    const t = setTimeout(async () => {
      const q = term.trim()
      let query = supabase
        .from("lab_tests")
        .select("id, name, short_name, category, loinc_code, unit")
        .limit(8)
      if (q) query = query.or(`name.ilike.%${q}%,short_name.ilike.${q}%`)
      const { data } = await query.order("name")
      setResults(data ?? [])
    }, 200)
    return () => clearTimeout(t)
  }, [term, open])

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [])

  function add(t: Test) {
    setPicked((prev) => (prev.some((p) => p.id === t.id) ? prev : [...prev, t]))
    setTerm("")
    setOpen(false)
  }

  function order() {
    start(async () => {
      const res = await createLabOrder({
        patientId,
        visitId,
        testIds: picked.map((p) => p.id),
        labName,
      })
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success(`${picked.length} test${picked.length > 1 ? "s" : ""} ordered`)
      setPicked([])
      setLabName("")
      router.refresh()
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FlaskConical className="size-4 text-primary" /> Labs &amp; imaging
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {orders.length > 0 && (
          <ul className="space-y-2">
            {orders.map((o) => (
              <OrderRow key={o.id} order={o} onDone={() => router.refresh()} />
            ))}
          </ul>
        )}

        <div className="space-y-2">
          <div ref={boxRef} className="relative">
            <Input
              value={term}
              placeholder="Add a test — search by name (CBC, HbA1c, USG…)"
              onChange={(e) => {
                setTerm(e.target.value)
                setOpen(true)
              }}
              onFocus={() => setOpen(true)}
              autoComplete="off"
            />
            {open && results.length > 0 && (
              <ul className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-edge/25 bg-popover p-1.5 shadow-nm-float">
                {results.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      className="flex w-full items-baseline justify-between gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
                      onClick={() => add(t)}
                    >
                      <span className="truncate">
                        {t.name}
                        {t.short_name ? (
                          <span className="ml-1.5 text-xs text-muted-foreground">{t.short_name}</span>
                        ) : null}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">{t.category}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {picked.length > 0 && (
            <>
              <ul className="flex flex-wrap gap-1.5">
                {picked.map((t) => (
                  <li
                    key={t.id}
                    className="inline-flex items-center gap-1.5 rounded-full bg-accent py-0.5 pl-2 pr-1 text-xs text-accent-foreground"
                  >
                    {t.short_name ?? t.name}
                    <button
                      type="button"
                      aria-label={`Remove ${t.name}`}
                      onClick={() => setPicked((p) => p.filter((x) => x.id !== t.id))}
                      className="rounded-full p-0.5 transition-colors hover:bg-primary/15"
                    >
                      <X className="size-3" />
                    </button>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={labName}
                  onChange={(e) => setLabName(e.target.value)}
                  placeholder="Lab name (optional)"
                  aria-label="Lab name"
                  className="max-w-56"
                />
                <Button type="button" disabled={pending} onClick={order}>
                  {pending ? "Ordering…" : `Order ${picked.length} test${picked.length > 1 ? "s" : ""}`}
                </Button>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function OrderRow({ order, onDone }: { order: LabOrderRow; onDone: () => void }) {
  const [expanded, setExpanded] = useState(order.status !== "resulted")
  const [rows, setRows] = useState<LabResultInput[]>(() =>
    order.items.map((i) => ({
      id: i.id,
      valueText: i.value_text ?? "",
      unit: i.unit ?? "",
      referenceLow: i.reference_low?.toString() ?? "",
      referenceHigh: i.reference_high?.toString() ?? "",
      referenceText: i.reference_text ?? "",
      note: i.note ?? "",
    })),
  )
  const [pending, start] = useTransition()

  function patch(idx: number, p: Partial<LabResultInput>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...p } : r)))
  }

  function save() {
    start(async () => {
      const res = await saveLabResults(order.id, rows)
      if (res.error) toast.error(res.error)
      else {
        toast.success("Results saved")
        onDone()
      }
    })
  }

  function cancel() {
    start(async () => {
      const res = await setLabOrderStatus(order.id, "cancelled")
      if (res.error) toast.error(res.error)
      else onDone()
    })
  }

  return (
    <li className="rounded-xl border border-edge/15 bg-background/45 shadow-nm-inset">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
      >
        {expanded ? (
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        )}
        <span className="min-w-0 flex-1 truncate">
          {order.items.map((i) => i.test_name).join(", ")}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {formatISTDate(order.ordered_at)}
        </span>
        <Badge variant="outline" className={TONE[STATUS_TONE[order.status] ?? "info"].text}>
          {order.status}
        </Badge>
      </button>

      {expanded && (
        <div className="space-y-3 border-t px-3 py-3">
          {order.lab_name && (
            <p className="text-xs text-muted-foreground">Lab: {order.lab_name}</p>
          )}
          <ul className="space-y-3">
            {order.items.map((item, idx) => (
              <li key={item.id} className="space-y-1.5">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-sm font-medium">{item.test_name}</span>
                  {item.loinc_code && (
                    <span className="font-mono text-[11px] text-muted-foreground">
                      LOINC {item.loinc_code}
                    </span>
                  )}
                  {item.flag && (
                    <span
                      className={cn(
                        "rounded-md px-1.5 py-0.5 text-[11px] font-medium",
                        TONE[FLAG_TONE[item.flag as LabFlag] ?? "info"].tint,
                      )}
                    >
                      {item.flag}
                    </span>
                  )}
                  {formatRange(item.reference_low, item.reference_high, item.reference_text) && (
                    <span className="text-[11px] text-muted-foreground">
                      Ref {formatRange(item.reference_low, item.reference_high, item.reference_text)}
                    </span>
                  )}
                </div>
                <div className="grid gap-2 sm:grid-cols-[1fr_5rem_5rem_5rem]">
                  <Input
                    value={rows[idx]?.valueText ?? ""}
                    onChange={(e) => patch(idx, { valueText: e.target.value })}
                    placeholder="Result"
                    aria-label={`${item.test_name} result`}
                  />
                  <Input
                    value={rows[idx]?.unit ?? ""}
                    onChange={(e) => patch(idx, { unit: e.target.value })}
                    placeholder="Unit"
                    aria-label={`${item.test_name} unit`}
                  />
                  <Input
                    value={rows[idx]?.referenceLow ?? ""}
                    onChange={(e) => patch(idx, { referenceLow: e.target.value })}
                    placeholder="Ref low"
                    aria-label={`${item.test_name} reference low`}
                  />
                  <Input
                    value={rows[idx]?.referenceHigh ?? ""}
                    onChange={(e) => patch(idx, { referenceHigh: e.target.value })}
                    placeholder="Ref high"
                    aria-label={`${item.test_name} reference high`}
                  />
                </div>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            High/low is worked out from the reference range you enter off the lab&apos;s report.
            Leave it blank and the result is recorded without an interpretation.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" disabled={pending} onClick={save}>
              {pending ? "Saving…" : "Save results"}
            </Button>
            {order.status !== "cancelled" && (
              <Button type="button" size="sm" variant="outline" disabled={pending} onClick={cancel}>
                Cancel order
              </Button>
            )}
          </div>
        </div>
      )}
    </li>
  )
}

"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Papa from "papaparse"
import { toast } from "sonner"
import { UploadCloud, TriangleAlert } from "lucide-react"
import {
  importMedicines,
  type MedicineImportRow,
  type MedicineImportResult,
} from "@/actions/medicines-import"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { TONE } from "@/lib/status"
import { cn } from "@/lib/utils"

const TARGETS: { key: string; label: string; required?: boolean; synonyms: string[] }[] = [
  { key: "name", label: "Medicine name", required: true, synonyms: ["name", "medicine", "drug", "brand", "product"] },
  { key: "composition", label: "Composition (active ingredients)", synonyms: ["composition", "generic", "ingredient", "ingredients", "salt", "molecule"] },
  { key: "form", label: "Form", synonyms: ["form", "type", "dosageform"] },
  { key: "strength", label: "Strength", synonyms: ["strength", "dose", "dosage", "power", "mg"] },
]

const MAX_ROWS = 5000
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "")

type Step = "upload" | "map" | "done"

/**
 * CSV import for the clinic's medicine list — the path from the curated seed to
 * a full drug database. Mirrors the patient import wizard (upload → map →
 * report) so the interaction is already familiar.
 */
export function MedicineImport() {
  const router = useRouter()
  const [step, setStep] = useState<Step>("upload")
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<Record<string, string>[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [result, setResult] = useState<MedicineImportResult | null>(null)
  const [pending, start] = useTransition()

  function onFile(file: File) {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const hdrs = (res.meta.fields ?? []).filter(Boolean)
        const data = res.data.filter((r) => Object.values(r).some((v) => String(v ?? "").trim()))
        if (data.length === 0) {
          toast.error("No data rows found in that file.")
          return
        }
        if (data.length > MAX_ROWS) {
          toast.error(`That file has ${data.length} rows. The limit is ${MAX_ROWS} per import.`)
          return
        }
        const guess: Record<string, string> = {}
        for (const t of TARGETS) {
          const hit = hdrs.find((h) => {
            const n = norm(h)
            return n === norm(t.key) || t.synonyms.some((s) => n === s || n.includes(s))
          })
          if (hit) guess[t.key] = hit
        }
        setHeaders(hdrs)
        setRows(data)
        setMapping(guess)
        setStep("map")
      },
      error: () => toast.error("Could not read that file."),
    })
  }

  function runImport() {
    const mapped: MedicineImportRow[] = rows.map((r) => {
      const out: MedicineImportRow = {}
      for (const t of TARGETS) {
        const col = mapping[t.key]
        if (col) out[t.key] = String(r[col] ?? "").trim()
      }
      return out
    })
    start(async () => {
      const res = await importMedicines(mapped)
      if (res.error) {
        toast.error(res.error)
        return
      }
      setResult(res)
      setStep("done")
      toast.success(`${res.inserted} medicines added.`)
      router.refresh()
    })
  }

  if (step === "upload") {
    return (
      <div className="space-y-4">
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-edge/30 border-border bg-card px-6 py-10 text-center transition-colors hover:border-primary/40 hover:bg-accent/40">
          <UploadCloud className="size-6 text-muted-foreground" />
          <span className="text-sm font-medium">Choose a CSV file</span>
          <span className="text-xs text-muted-foreground">
            Up to {MAX_ROWS.toLocaleString("en-IN")} rows per import
          </span>
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onFile(f)
            }}
          />
        </label>
        <div className="rounded-xl border border-edge/20 bg-card shadow-nm-raised p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Expected columns</p>
          <p className="mt-1">
            <code className="font-mono">name</code> (required),{" "}
            <code className="font-mono">composition</code>, <code className="font-mono">form</code>,{" "}
            <code className="font-mono">strength</code>. Column names are matched automatically and
            can be corrected on the next step.
          </p>
        </div>
      </div>
    )
  }

  if (step === "map") {
    const nameMapped = Boolean(mapping.name)
    const compositionMapped = Boolean(mapping.composition)
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {rows.length.toLocaleString("en-IN")} rows found. Confirm which column is which.
        </p>

        <div className="space-y-3">
          {TARGETS.map((t) => (
            <div key={t.key} className="grid gap-1.5 sm:grid-cols-[1fr_1fr] sm:items-center">
              <Label htmlFor={`map-${t.key}`}>
                {t.label}
                {t.required && <span className="ml-1 text-destructive">*</span>}
              </Label>
              <select
                id={`map-${t.key}`}
                value={mapping[t.key] ?? ""}
                onChange={(e) => setMapping((m) => ({ ...m, [t.key]: e.target.value }))}
                className="h-9 rounded-lg border border-edge/50 bg-background/60 px-3 text-sm shadow-nm-inset"
              >
                <option value="">— not in file —</option>
                {headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>

        {!compositionMapped && (
          <p className={cn("flex items-start gap-2 rounded-lg border p-3 text-xs", TONE.warning.banner)}>
            <TriangleAlert className={cn("mt-0.5 size-3.5 shrink-0", TONE.warning.text)} />
            <span>
              No composition column mapped. These medicines will autocomplete, but the medicine
              name will be used as the ingredient — so allergy and interaction checks will only
              match generics, not brand names.
            </span>
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={!nameMapped || pending} onClick={runImport}>
            {pending ? "Importing…" : `Import ${rows.length.toLocaleString("en-IN")} rows`}
          </Button>
          <Button type="button" variant="outline" onClick={() => setStep("upload")} disabled={pending}>
            Choose a different file
          </Button>
        </div>
      </div>
    )
  }

  const errors = result?.results.filter((r) => r.status === "error").slice(0, 10) ?? []
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Added" value={result?.inserted ?? 0} />
        <Stat label="Already present" value={result?.skipped ?? 0} />
        <Stat label="Errors" value={result?.errored ?? 0} tone={result?.errored ? "bad" : undefined} />
      </div>

      {errors.length > 0 && (
        <div className="rounded-xl border border-edge/20 bg-card shadow-nm-raised p-3">
          <p className="text-sm font-medium">First errors</p>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            {errors.map((e) => (
              <li key={e.row}>
                Row {e.row}: {e.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Button type="button" onClick={() => { setStep("upload"); setResult(null) }}>
        Import another file
      </Button>
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "bad" }) {
  return (
    <div className="rounded-xl border border-edge/20 bg-card shadow-nm-raised p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "font-heading text-2xl font-semibold tabular-nums",
          tone === "bad" ? TONE.danger.text : undefined,
        )}
      >
        {value.toLocaleString("en-IN")}
      </p>
    </div>
  )
}

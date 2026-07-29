"use client"

import { useState, useMemo, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import Papa from "papaparse"
import { toast } from "sonner"
import { UploadCloud, ArrowLeft } from "lucide-react"
import { patientSchema } from "@/lib/validation/patient"
import { importPatients, type ImportRow, type ImportResult } from "@/actions/patients-import"
import { Button, buttonVariants } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

const TARGETS: { key: string; label: string; required?: boolean; synonyms: string[] }[] = [
  { key: "full_name", label: "Full name", required: true, synonyms: ["name", "fullname", "patient", "patientname"] },
  { key: "phone", label: "Mobile number", required: true, synonyms: ["phone", "mobile", "number", "contact", "cell"] },
  { key: "gender", label: "Gender", synonyms: ["gender", "sex"] },
  { key: "age_years", label: "Age", synonyms: ["age", "years"] },
  { key: "dob", label: "Date of birth", synonyms: ["dob", "birth", "birthdate", "dateofbirth"] },
  { key: "address", label: "Address", synonyms: ["address", "addr", "location"] },
  { key: "blood_group", label: "Blood group", synonyms: ["blood", "bloodgroup"] },
  { key: "allergies", label: "Allergies", synonyms: ["allergy", "allergies"] },
  { key: "chronic_conditions", label: "Chronic conditions", synonyms: ["chronic", "conditions", "history"] },
  { key: "notes", label: "Notes", synonyms: ["notes", "note", "remarks"] },
  { key: "tags", label: "Tags", synonyms: ["tags", "labels"] },
]

const MAX_ROWS = 2000
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "")

type Step = "upload" | "map" | "preview" | "done"

export function ImportWizard() {
  const router = useRouter()
  const [step, setStep] = useState<Step>("upload")
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<Record<string, string>[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [consent, setConsent] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
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
          toast.error(`That file has ${data.length} rows. The limit is ${MAX_ROWS}.`)
          return
        }
        // Auto-guess mapping.
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
      error: () => toast.error("Couldn't read that CSV file."),
    })
  }

  const mapped: ImportRow[] = useMemo(
    () =>
      rows.map((r) => {
        const out: ImportRow = {}
        for (const t of TARGETS) {
          const col = mapping[t.key]
          if (col) out[t.key] = String(r[col] ?? "").trim()
        }
        return out
      }),
    [rows, mapping],
  )

  const validation = useMemo(() => {
    let valid = 0
    let invalid = 0
    const phones = new Set<string>()
    let dupInFile = 0
    for (const m of mapped) {
      const p = patientSchema.safeParse({ ...m, gender: m.gender ?? "", age_years: m.age_years ?? "" })
      if (!p.success) {
        invalid++
        continue
      }
      if (phones.has(p.data.phone)) {
        dupInFile++
        continue
      }
      phones.add(p.data.phone)
      valid++
    }
    return { valid, invalid, dupInFile }
  }, [mapped])

  const canContinue = Boolean(mapping.full_name && mapping.phone)

  function runImport() {
    start(async () => {
      const res = await importPatients(mapped, consent)
      if (res.error) {
        toast.error(res.error)
        return
      }
      setResult(res)
      setStep("done")
      router.refresh()
    })
  }

  if (step === "done" && result) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Imported" value={result.inserted} className="text-success" />
          <Stat label="Skipped (duplicate)" value={result.skipped} className="text-warning" />
          <Stat label="Errors" value={result.errored} className="text-destructive" />
        </div>
        {(result.errored > 0 || result.skipped > 0) && (
          <div className="max-h-72 overflow-y-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Row</th>
                  <th className="px-3 py-2">Result</th>
                  <th className="px-3 py-2">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {result.results
                  .filter((r) => r.status !== "inserted")
                  .map((r) => (
                    <tr key={r.row}>
                      <td className="px-3 py-1.5">{r.row}</td>
                      <td className="px-3 py-1.5 capitalize">{r.status.replace("-", " ")}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{r.reason}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
        <Link href="/patients" className={cn(buttonVariants())}>
          Go to patients
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {step === "upload" && (
        <label className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border border-dashed bg-card/60 p-12 text-center hover:bg-muted/30">
          <UploadCloud className="size-8 text-muted-foreground" />
          <div>
            <p className="font-medium">Upload a CSV file</p>
            <p className="text-sm text-muted-foreground">
              Exporting from Excel? Use File → Save As → CSV. Max {MAX_ROWS} rows.
            </p>
          </div>
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
      )}

      {step === "map" && (
        <div className="space-y-4">
          <BackButton onClick={() => setStep("upload")} />
          <p className="text-sm text-muted-foreground">
            Matched {rows.length} rows. Confirm which column maps to each field.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {TARGETS.map((t) => (
              <div key={t.key} className="space-y-1.5">
                <Label>
                  {t.label}
                  {t.required && <span className="text-destructive"> *</span>}
                </Label>
                <select
                  value={mapping[t.key] ?? ""}
                  onChange={(e) => setMapping((m) => ({ ...m, [t.key]: e.target.value }))}
                  className="h-9 w-full rounded-lg border border-edge/50 bg-background/60 px-3 text-sm shadow-nm-inset"
                >
                  <option value="">— ignore —</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          {!canContinue && (
            <p className="text-sm text-destructive">Map both Full name and Mobile number to continue.</p>
          )}
          <Button disabled={!canContinue} onClick={() => setStep("preview")}>
            Preview
          </Button>
        </div>
      )}

      {step === "preview" && (
        <div className="space-y-4">
          <BackButton onClick={() => setStep("map")} />
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Ready to import" value={validation.valid} className="text-success" />
            <Stat label="Invalid (skipped)" value={validation.invalid} className="text-destructive" />
            <Stat label="Duplicate in file" value={validation.dupInFile} className="text-warning" />
          </div>
          <label className="flex items-start gap-2 rounded-xl border border-edge/20 bg-card shadow-nm-raised p-3 text-sm">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 size-4 rounded border-input"
            />
            <span className="text-muted-foreground">
              I confirm these patients have consented to receive WhatsApp updates. If unchecked,
              they&apos;re imported with messaging off (you can enable it later).
            </span>
          </label>
          <Button disabled={pending || validation.valid === 0} onClick={runImport}>
            {pending ? "Importing…" : `Import ${validation.valid} patient${validation.valid === 1 ? "" : "s"}`}
          </Button>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, className }: { label: string; value: number; className?: string }) {
  return (
    <div className="rounded-xl border border-edge/20 bg-card shadow-nm-raised p-4 text-center">
      <p className={`text-2xl font-semibold ${className ?? ""}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-3.5" /> Back
    </button>
  )
}

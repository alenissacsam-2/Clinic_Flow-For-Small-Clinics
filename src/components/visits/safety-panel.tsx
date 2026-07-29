"use client"

import { useEffect, useState } from "react"
import { TriangleAlert, ShieldCheck, Info } from "lucide-react"
import { checkPrescriptionSafety } from "@/actions/clinical"
import type { SafetyReport } from "@/lib/clinical/safety"
import { TONE } from "@/lib/status"
import { cn } from "@/lib/utils"

/**
 * Advisory allergy and interaction warnings for the prescription being written.
 *
 * Deliberately NON-BLOCKING: it never disables saving and never gates the
 * finalise action. A prescriber overriding a warning is a normal, informed
 * decision; the software's job is to make sure the information was in front of
 * them, not to overrule them.
 *
 * The check re-runs on a debounce as medicines are typed. `setState` only ever
 * happens inside the timeout/async callbacks — never synchronously in the effect
 * body — which is what the React Compiler lint rule requires.
 */
export function SafetyPanel({
  patientId,
  medicineNames,
}: {
  patientId: string
  medicineNames: string[]
}) {
  const [report, setReport] = useState<SafetyReport | null>(null)
  const [checking, setChecking] = useState(false)

  const names = medicineNames.map((n) => n.trim()).filter(Boolean)
  // Case-insensitive so re-typing the same drug in different case doesn't refetch.
  // Used only as the effect key — the request itself sends the original casing.
  const key = names.join("|").toLowerCase()

  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(async () => {
      const list = key ? key.split("|") : []
      if (list.length === 0) {
        setReport(null)
        return
      }
      setChecking(true)
      try {
        // `names` is intentionally read here rather than from `key`: it preserves
        // the doctor's original capitalisation for display. It changes exactly
        // when `key` does, so there is no stale-closure risk.
        const result = await checkPrescriptionSafety({ patientId, medicineNames: names })
        if (!cancelled) setReport(result)
      } catch {
        // A failed check must not look like a clean check.
        if (!cancelled) setReport(null)
      } finally {
        if (!cancelled) setChecking(false)
      }
    }, 500)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `names` tracks `key`
  }, [key, patientId])

  if (!report) return null

  const { allergies, interactions, unresolved } = report
  const hasFindings = allergies.length > 0 || interactions.length > 0
  const checkedCount = names.length - unresolved.length

  return (
    <div className="space-y-3" aria-live="polite">
      {allergies.length > 0 && (
        // The one element in the whole visit editor that is RAISED. Everything
        // else on this screen is a recessed field the doctor types into; an
        // advisory that must be noticed has to come off the page, not sit in it.
        <div className={cn("rounded-xl border p-4 shadow-nm-float", TONE.danger.banner)}>
          <p className={cn("flex items-center gap-2 text-sm font-semibold", TONE.danger.text)}>
            <TriangleAlert className="size-4 shrink-0" />
            Allergy warning
          </p>
          <ul className="mt-2 space-y-1.5 text-sm">
            {allergies.map((a, i) => (
              <li key={i}>
                <span className="font-medium">{a.drugName}</span> contains{" "}
                <span className="font-medium">{a.ingredient}</span> — patient records an allergy to{" "}
                <span className="font-medium">{a.allergyTerm}</span>
                {a.basis === "cross-class" && (
                  <span className="text-muted-foreground"> (possible cross-reactivity)</span>
                )}
                {a.basis === "class" && <span className="text-muted-foreground"> (same drug class)</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {interactions.length > 0 && (
        <div className={cn("rounded-xl border p-4 shadow-nm-float", TONE.warning.banner)}>
          <p className={cn("flex items-center gap-2 text-sm font-semibold", TONE.warning.text)}>
            <TriangleAlert className="size-4 shrink-0" />
            Interaction warning
          </p>
          <ul className="mt-2 space-y-2 text-sm">
            {interactions.map((it, i) => (
              <li key={i}>
                <span className="font-medium">
                  {it.drugA} + {it.drugB}
                </span>
                <span className={cn("ml-2 rounded px-1.5 py-0.5 text-[11px] font-medium uppercase", TONE.warning.tint)}>
                  {it.severity}
                </span>
                <span className="block text-muted-foreground">{it.description}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {unresolved.length > 0 && (
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          <span>
            Not checked (not in the medicine list): {unresolved.join(", ")}. Add them under
            Settings → Medicines to include them in future checks.
          </span>
        </p>
      )}

      {/* Wording is deliberate: "no warnings in our list", never "safe". */}
      {!hasFindings && checkedCount > 0 && !checking && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className={cn("size-3.5 shrink-0", TONE.success.text)} />
          Checked {checkedCount} {checkedCount === 1 ? "medicine" : "medicines"} — no allergy or
          interaction warnings in ClinicFlow&apos;s list.
        </p>
      )}

      {hasFindings && (
        <p className="text-xs text-muted-foreground">
          Advisory only — not a substitute for clinical judgement. The interaction list is curated
          and not exhaustive; absence of a warning does not mean a combination is safe.
        </p>
      )}
    </div>
  )
}

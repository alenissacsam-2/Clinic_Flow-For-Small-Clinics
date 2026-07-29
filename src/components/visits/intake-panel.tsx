import { ClipboardCheck } from "lucide-react"

export type IntakeAnswers = {
  age_years?: number | null
  dob?: string | null
  gender?: string | null
  allergies?: string | null
  complaints?: string | null
  medicines?: string | null
}

/** Read-only summary of the patient's submitted pre-visit intake. */
export function IntakePanel({ answers }: { answers: IntakeAnswers }) {
  const rows: { label: string; value: string }[] = []
  if (answers.complaints) rows.push({ label: "Complaints", value: answers.complaints })
  if (answers.medicines) rows.push({ label: "Current medicines", value: answers.medicines })
  if (answers.allergies) rows.push({ label: "Allergies", value: answers.allergies })
  const demo = [answers.age_years ? `${answers.age_years}y` : null, answers.gender]
    .filter(Boolean)
    .join(" / ")
  if (demo) rows.push({ label: "Age / gender", value: demo })

  return (
    <div className="rounded-lg border border-success/25 bg-success/10 p-3">
      <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-success">
        <ClipboardCheck className="size-4" />
        Pre-visit intake
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">Submitted, no details provided.</p>
      ) : (
        <dl className="space-y-2 text-sm">
          {rows.map((r) => (
            <div key={r.label}>
              <dt className="text-xs text-muted-foreground">{r.label}</dt>
              <dd className="whitespace-pre-wrap">{r.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}

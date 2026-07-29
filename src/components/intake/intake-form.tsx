"use client"

import { useActionState } from "react"
import { CheckCircle2 } from "lucide-react"
import { submitIntake } from "@/actions/intake"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export type IntakePrefill = {
  full_name: string
  age_years: number | null
  dob: string | null
  gender: string | null
  allergies: string | null
}

export function IntakeForm({ token, prefill }: { token: string; prefill: IntakePrefill }) {
  const action = submitIntake.bind(null, token)
  const [state, formAction, pending] = useActionState(action, undefined)

  if (state?.ok) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center">
        <CheckCircle2 className="mx-auto mb-3 size-12 text-success" />
        <h2 className="text-lg font-semibold">Thank you!</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Your details have been shared with the clinic. See you at your appointment.
        </p>
      </div>
    )
  }

  return (
    <form action={formAction} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="age_years">Age</Label>
          <Input
            id="age_years"
            name="age_years"
            type="number"
            min={0}
            max={120}
            defaultValue={prefill.age_years ?? ""}
            placeholder="e.g. 34"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="gender">Gender</Label>
          <select
            id="gender"
            name="gender"
            defaultValue={prefill.gender ?? ""}
            className="h-9 w-full rounded-lg border border-edge/50 bg-background/60 px-3 text-sm shadow-nm-inset"
          >
            <option value="">Select…</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="allergies">Allergies (if any)</Label>
        <Input
          id="allergies"
          name="allergies"
          defaultValue={prefill.allergies ?? ""}
          placeholder="e.g. Penicillin, none"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="complaints">What brings you in?</Label>
        <Textarea id="complaints" name="complaints" rows={3} placeholder="Describe your symptoms or reason for the visit" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="medicines">Medicines you currently take</Label>
        <Textarea id="medicines" name="medicines" rows={2} placeholder="List any ongoing medicines" />
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Submitting…" : "Submit"}
      </Button>
    </form>
  )
}

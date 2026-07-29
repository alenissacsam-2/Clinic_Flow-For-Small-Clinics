import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { formatAbhaNumber } from "@/lib/abdm/abha"
import type { PatientFormValues } from "@/actions/patients"
import type { Tables } from "@/types/database"

/**
 * Shared patient form fields, used by both create and edit forms.
 *
 * `values` is the previous submission echoed back by a rejected action. It
 * takes precedence over the saved `patient` so a validation error leaves the
 * doctor's other edits on screen — React 19 resets an uncontrolled form once
 * the action settles, so without this every field silently reverts.
 */
export function PatientFields({
  patient,
  values,
}: {
  patient?: Tables<"patients">
  values?: PatientFormValues
}) {
  // A rejected submission wins; otherwise fall back to the saved record.
  const v = <K extends keyof PatientFormValues>(key: K, saved: string): string =>
    values ? String(values[key] ?? "") : saved

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="full_name">Full name *</Label>
          <Input id="full_name" name="full_name" required defaultValue={v("full_name", patient?.full_name ?? "")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Mobile number *</Label>
          <Input
            id="phone"
            name="phone"
            required
            placeholder="98765 43210"
            defaultValue={v("phone", patient?.phone ?? "")}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="gender">Gender</Label>
          <select
            id="gender"
            name="gender"
            defaultValue={v("gender", patient?.gender ?? "")}
            className="h-9 w-full rounded-lg border border-edge/50 bg-background/60 px-3 text-sm shadow-nm-inset"
          >
            <option value="">—</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="age_years">Age</Label>
          <Input
            id="age_years"
            name="age_years"
            type="number"
            min={0}
            max={120}
            defaultValue={v("age_years", patient?.age_years != null ? String(patient.age_years) : "")}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="blood_group">Blood group</Label>
          <Input id="blood_group" name="blood_group" placeholder="O+" defaultValue={v("blood_group", patient?.blood_group ?? "")} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="address">Address</Label>
        <Textarea id="address" name="address" rows={2} defaultValue={v("address", patient?.address ?? "")} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="allergies">Allergies</Label>
          <Input id="allergies" name="allergies" defaultValue={v("allergies", patient?.allergies ?? "")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="chronic_conditions">Chronic conditions</Label>
          <Input
            id="chronic_conditions"
            name="chronic_conditions"
            placeholder="Diabetes, Hypertension"
            defaultValue={v("chronic_conditions", patient?.chronic_conditions ?? "")}
          />
        </div>
      </div>

      {/* ABDM identity — optional. A clinic that never touches ABDM can
          ignore both fields and nothing downstream changes. */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="abha_number">ABHA number</Label>
          <Input
            id="abha_number"
            name="abha_number"
            inputMode="numeric"
            placeholder="91-1122-3344-5564"
            defaultValue={v("abha_number", patient?.abha_number ? formatAbhaNumber(patient.abha_number) : "")}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="abha_address">ABHA address</Label>
          <Input
            id="abha_address"
            name="abha_address"
            placeholder="aarav.shah@sbx"
            defaultValue={v("abha_address", patient?.abha_address ?? "")}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="tags">Tags (comma-separated)</Label>
        <Input id="tags" name="tags" placeholder="regular, senior" defaultValue={v("tags", patient?.tags?.join(", ") ?? "")} />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="whatsapp_opt_in"
          defaultChecked={values ? values.whatsapp_opt_in : patient ? patient.whatsapp_opt_in : true}
          className="size-4 rounded border-input"
        />
        Patient consents to receive WhatsApp messages (reminders, prescriptions, receipts)
      </label>
    </div>
  )
}

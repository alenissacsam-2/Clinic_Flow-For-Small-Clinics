"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Plus, Trash2, FileText } from "lucide-react"
import { saveVisit, type RxItemInput, type SaveVisitInput } from "@/actions/visits"
import { putDraft, deleteDraft, isOnline } from "@/lib/offline/draft-store"
import { MedicineCombobox } from "./medicine-combobox"
import { SafetyPanel } from "./safety-panel"
import { Icd10Picker } from "./icd10-picker"
import { DictationPanel, type Applied } from "./dictation-panel"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { InputGroup, InputGroupInput, InputGroupAddon, InputGroupText } from "@/components/ui/input-group"
import { cn } from "@/lib/utils"

type Item = { medicine_name: string; dosage: string; duration_days: string; instructions: string }

const DOSE_CHIPS = ["1-0-1", "1-1-1", "0-0-1", "1-0-0", "0-1-0", "SOS"]

export type VisitEditorProps = {
  appointmentId?: string | null
  patientId: string
  visitId?: string | null
  /** Whether the AI scribe is configured on this deployment. */
  scribeAvailable?: boolean
  initial?: {
    vitals?: Record<string, number>
    complaints?: string
    diagnosis?: string
    advice?: string
    followupDate?: string
    diagnosisCodes?: string[]
    items?: RxItemInput[]
  }
}

export function VisitEditor({
  appointmentId,
  patientId,
  visitId,
  scribeAvailable = false,
  initial,
}: VisitEditorProps) {
  const router = useRouter()
  const [pending, start] = useTransition()

  const v0 = initial?.vitals ?? {}
  const [vitals, setVitals] = useState({
    bp_sys: v0.bp_sys?.toString() ?? "",
    bp_dia: v0.bp_dia?.toString() ?? "",
    pulse: v0.pulse?.toString() ?? "",
    temp_f: v0.temp_f?.toString() ?? "",
    weight_kg: v0.weight_kg?.toString() ?? "",
    spo2: v0.spo2?.toString() ?? "",
  })
  const [complaints, setComplaints] = useState(initial?.complaints ?? "")
  const [diagnosis, setDiagnosis] = useState(initial?.diagnosis ?? "")
  const [advice, setAdvice] = useState(initial?.advice ?? "")
  const [followupDate, setFollowupDate] = useState(initial?.followupDate ?? "")
  const [diagnosisCodes, setDiagnosisCodes] = useState<string[]>(initial?.diagnosisCodes ?? [])
  const [items, setItems] = useState<Item[]>(
    initial?.items && initial.items.length > 0
      ? initial.items.map((i) => ({
          medicine_name: i.medicine_name,
          dosage: i.dosage ?? "",
          duration_days: i.duration_days?.toString() ?? "",
          instructions: i.instructions ?? "",
        }))
      : [{ medicine_name: "", dosage: "", duration_days: "", instructions: "" }],
  )

  function setItem(idx: number, patch: Partial<Item>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
  }
  function addItem() {
    setItems((prev) => [...prev, { medicine_name: "", dosage: "", duration_days: "", instructions: "" }])
  }
  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx))
  }

  /**
   * Accept a dictation suggestion. Appends medicines onto the prescription
   * rather than replacing it — the doctor may already have typed some, and
   * silently discarding those would be the worst possible behaviour here.
   */
  function applyDictation(patch: Applied) {
    if (patch.complaints !== undefined) setComplaints(patch.complaints)
    if (patch.diagnosis !== undefined) setDiagnosis(patch.diagnosis)
    if (patch.advice !== undefined) setAdvice(patch.advice)
    if (patch.medicines) {
      const additions = patch.medicines.map((name) => ({
        medicine_name: name,
        dosage: "",
        duration_days: "",
        instructions: "",
      }))
      setItems((prev) => {
        const kept = prev.filter((i) => i.medicine_name.trim())
        return [...kept, ...additions]
      })
    }
  }

  function num(s: string): number | undefined {
    const n = Number(s)
    return s.trim() && !Number.isNaN(n) ? n : undefined
  }

  function persist(finalize: boolean) {
    const payloadItems: RxItemInput[] = items
      .filter((it) => it.medicine_name.trim())
      .map((it) => ({
        medicine_name: it.medicine_name.trim(),
        dosage: it.dosage || undefined,
        duration_days: num(it.duration_days) ?? null,
        instructions: it.instructions || undefined,
      }))

    const payload: SaveVisitInput = {
      appointmentId,
      patientId,
      visitId,
      vitals: {
        bp_sys: num(vitals.bp_sys),
        bp_dia: num(vitals.bp_dia),
        pulse: num(vitals.pulse),
        temp_f: num(vitals.temp_f),
        weight_kg: num(vitals.weight_kg),
        spo2: num(vitals.spo2),
      },
      complaints,
      diagnosis,
      diagnosisCodes,
      advice,
      followupDate: followupDate || null,
      items: payloadItems,
      finalize,
    }
    // Key on the appointment (or visit) so re-saving the same consultation
    // replaces its draft instead of queueing a second copy of it.
    const draftKey = appointmentId ?? `visit:${visitId ?? patientId}`

    start(async () => {
      // Written to the device *before* the network call, so a connection that
      // drops mid-save still leaves the consultation recorded somewhere.
      await putDraft(draftKey, payload, false)

      if (!isOnline()) {
        await putDraft(draftKey, payload, true)
        toast.warning("Offline — saved on this device. It will sync when you reconnect.")
        return
      }

      const res = await saveVisit(payload)
      if (res.error) {
        await putDraft(draftKey, payload, true)
        toast.error(`${res.error} Saved on this device — use Sync when you are back online.`)
        return
      }
      await deleteDraft(draftKey)
      if (finalize) {
        toast.success("Visit completed")
        if (res.prescriptionId && payloadItems.length > 0) {
          window.open(`/api/prescriptions/${res.prescriptionId}/pdf`, "_blank")
        }
        router.push("/today")
      } else {
        toast.success("Draft saved")
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-6">
      <DictationPanel available={scribeAvailable} onApply={applyDictation} />

      <Card>
        <CardHeader>
          <CardTitle>Vitals</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
            <VitalField label="BP Sys" unit="mmHg" value={vitals.bp_sys} onChange={(x) => setVitals({ ...vitals, bp_sys: x })} />
            <VitalField label="BP Dia" unit="mmHg" value={vitals.bp_dia} onChange={(x) => setVitals({ ...vitals, bp_dia: x })} />
            <VitalField label="Pulse" unit="bpm" value={vitals.pulse} onChange={(x) => setVitals({ ...vitals, pulse: x })} />
            <VitalField label="Temp" unit="°F" value={vitals.temp_f} onChange={(x) => setVitals({ ...vitals, temp_f: x })} />
            <VitalField label="Weight" unit="kg" value={vitals.weight_kg} onChange={(x) => setVitals({ ...vitals, weight_kg: x })} />
            <VitalField label="SpO₂" unit="%" value={vitals.spo2} onChange={(x) => setVitals({ ...vitals, spo2: x })} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Clinical notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="complaints">Complaints</Label>
            <Textarea id="complaints" rows={2} value={complaints} onChange={(e) => setComplaints(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="diagnosis">Diagnosis</Label>
            <Textarea id="diagnosis" rows={2} value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} />
            {/* Optional coding — the free text above stays the primary record. */}
            <Icd10Picker value={diagnosisCodes} onChange={setDiagnosisCodes} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="advice">Advice</Label>
            <Textarea id="advice" rows={2} value={advice} onChange={(e) => setAdvice(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="followup">Follow-up date</Label>
            <Input
              id="followup"
              type="date"
              className="w-48"
              value={followupDate}
              onChange={(e) => setFollowupDate(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Prescription</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Allergy / interaction advisories. Never blocks saving. */}
          <SafetyPanel patientId={patientId} medicineNames={items.map((i) => i.medicine_name)} />
          {items.map((it, idx) => (
            // Each medicine is a recessed well inside the Rx card — it holds
            // fields, so it sinks. No hover lift, no tilt: this is the screen
            // a doctor fills in with a patient sitting opposite them, and
            // movement here is noise, not delight.
            <div
              key={idx}
              className="rounded-xl border border-edge/15 bg-background/45 p-4 shadow-nm-inset"
            >
              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <MedicineCombobox
                  value={it.medicine_name}
                  onChange={(name) => setItem(idx, { medicine_name: name })}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground"
                  onClick={() => removeItem(idx)}
                  aria-label="Remove medicine"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {DOSE_CHIPS.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => setItem(idx, { dosage: chip })}
                    // Dose chips are a real selection control, so they get the
                    // same raised→pressed gesture as the booking slots.
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs font-medium transition-[box-shadow,background-color,color]",
                      it.dosage === chip
                        ? "border-primary/45 bg-accent text-accent-foreground shadow-nm-pressed"
                        : "border-edge/35 bg-card text-muted-foreground shadow-nm-raised hover:text-primary",
                    )}
                  >
                    {chip}
                  </button>
                ))}
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                <Input
                  placeholder="Dosage (e.g. 1-0-1)"
                  value={it.dosage}
                  onChange={(e) => setItem(idx, { dosage: e.target.value })}
                />
                <Input
                  placeholder="Duration (days)"
                  type="number"
                  min={0}
                  value={it.duration_days}
                  onChange={(e) => setItem(idx, { duration_days: e.target.value })}
                />
                <Input
                  placeholder="Notes (after food…)"
                  value={it.instructions}
                  onChange={(e) => setItem(idx, { instructions: e.target.value })}
                />
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={addItem}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-edge/35 py-3 text-sm font-semibold text-muted-foreground transition-[box-shadow,background-color,color] hover:border-primary/45 hover:bg-accent/30 hover:text-primary hover:shadow-nm-inset"
          >
            <Plus className="size-4" /> Add medicine
          </button>
        </CardContent>
      </Card>

      {/* Sticky action bar — always reachable on phones during a consult, just
          above the mobile tab bar (bottom-16). Frosted rather than solid: it
          genuinely floats above the page, which is the one thing `glass` is
          for here. It holds buttons, not prose, so there is no text sitting on
          a blurred backdrop. On desktop it stops floating and the treatment
          drops away entirely. */}
      <div className="sticky bottom-16 z-20 -mx-4 flex flex-wrap justify-end gap-2 rounded-t-2xl border-t border-edge/25 bg-[var(--glass-bg)] px-4 py-3 shadow-[0_-8px_26px_-14px_var(--nm-lo)] backdrop-blur-md md:static md:bottom-auto md:mx-0 md:border-0 md:bg-transparent md:p-0 md:shadow-none md:backdrop-blur-none">
        <Button variant="outline" disabled={pending} onClick={() => persist(false)}>
          Save draft
        </Button>
        <Button disabled={pending} onClick={() => persist(true)}>
          <FileText className="size-4" />
          {pending ? "Saving…" : "Complete & generate Rx"}
        </Button>
      </div>
    </div>
  )
}

function VitalField({
  label,
  unit,
  value,
  onChange,
}: {
  label: string
  unit: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <InputGroup>
        <InputGroupInput value={value} inputMode="decimal" onChange={(e) => onChange(e.target.value)} />
        <InputGroupAddon align="inline-end">
          <InputGroupText className="text-xs">{unit}</InputGroupText>
        </InputGroupAddon>
      </InputGroup>
    </div>
  )
}

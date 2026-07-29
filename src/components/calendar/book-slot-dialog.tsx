"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { createAppointment } from "@/actions/appointments"
import { PatientPicker, type PickedPatient } from "@/components/patients/patient-picker"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

export function BookSlotDialog({ startUtc, label }: { startUtc: string; label: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [patient, setPatient] = useState<PickedPatient | null>(null)
  const [reason, setReason] = useState("")
  const [pending, start] = useTransition()

  function submit() {
    if (!patient) {
      toast.error("Select a patient")
      return
    }
    start(async () => {
      const res = await createAppointment({ patientId: patient.id, startsAt: startUtc, reason })
      if (res.error) toast.error(res.error)
      else {
        toast.success(`Booked ${patient.full_name} at ${label}`)
        setPatient(null)
        setReason("")
        setOpen(false)
        router.refresh()
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" variant="ghost" className="text-primary">
            Book
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Book {label}</DialogTitle>
          <DialogDescription>Choose a patient for this slot.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Patient</Label>
            <PatientPicker value={patient} onChange={setPatient} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reason">Reason (optional)</Label>
            <Input
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Fever, follow-up…"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={pending || !patient}>
            {pending ? "Booking…" : "Book appointment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { UserPlus } from "lucide-react"
import { addWalkIn } from "@/actions/appointments"
import { PatientPicker, type PickedPatient } from "@/components/patients/patient-picker"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

export function WalkInDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [patient, setPatient] = useState<PickedPatient | null>(null)
  const [pending, start] = useTransition()

  function submit() {
    if (!patient) {
      toast.error("Select a patient first")
      return
    }
    start(async () => {
      const res = await addWalkIn(patient.id)
      if (res.error) toast.error(res.error)
      else {
        toast.success(`${patient.full_name} added to the queue`)
        setPatient(null)
        setOpen(false)
        router.refresh()
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline">
            <UserPlus className="size-4" />
            Walk-in
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add walk-in</DialogTitle>
          <DialogDescription>
            Pick a patient to add to today&apos;s queue. New patient? Add them from the Patients page first.
          </DialogDescription>
        </DialogHeader>
        <PatientPicker value={patient} onChange={setPatient} />
        <DialogFooter>
          <Button onClick={submit} disabled={pending || !patient}>
            {pending ? "Adding…" : "Add to queue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

"use client"

import { useActionState, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Pencil } from "lucide-react"
import { updatePatient, type PatientFormState } from "@/actions/patients"
import { PatientFields } from "./patient-fields"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import type { Tables } from "@/types/database"

export function EditPatientDialog({ patient }: { patient: Tables<"patients"> }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  // Bumped on every rejected save. React 19 resets an uncontrolled form once
  // the action settles, and `defaultValue` only applies on mount — so the
  // fields are remounted under a new key to pick up the echoed values.
  const [attempt, setAttempt] = useState(0)
  const action = updatePatient.bind(null, patient.id)
  // Success side-effects run inside the action (not an effect) so React
  // doesn't re-render twice to close the dialog.
  const [state, formAction, pending] = useActionState<PatientFormState, FormData>(
    async (prev, formData) => {
      const res = await action(prev, formData)
      if (res?.ok) {
        toast.success("Patient updated")
        setOpen(false)
        router.refresh()
      } else {
        setAttempt((n) => n + 1)
      }
      return res
    },
    undefined,
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <Pencil className="size-4" />
            Edit
          </Button>
        }
      />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit patient</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <PatientFields key={attempt} patient={patient} values={state?.values} />
          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

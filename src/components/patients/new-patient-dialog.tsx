"use client"

import { useActionState, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { UserPlus } from "lucide-react"
import { createPatient } from "@/actions/patients"
import { PatientFields } from "./patient-fields"
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

export function NewPatientDialog({
  triggerLabel = "New patient",
  onCreated,
}: {
  triggerLabel?: string
  onCreated?: (patientId: string) => void
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  // See EditPatientDialog: remount the fields after a rejected save so the
  // echoed values survive React 19's post-action form reset.
  const [attempt, setAttempt] = useState(0)
  // Success side-effects run inside the action (not an effect) so React
  // doesn't re-render twice to close the dialog.
  const [state, action, pending] = useActionState(
    async (prev: Parameters<typeof createPatient>[0], formData: FormData) => {
      const res = await createPatient(prev, formData)
      if (res?.ok && res.patientId) {
        toast.success("Patient added")
        setOpen(false)
        onCreated?.(res.patientId)
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
          <Button>
            <UserPlus className="size-4" />
            {triggerLabel}
          </Button>
        }
      />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New patient</DialogTitle>
          <DialogDescription>Name and mobile number are enough to start.</DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <PatientFields key={attempt} values={state?.values} />
          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Add patient"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

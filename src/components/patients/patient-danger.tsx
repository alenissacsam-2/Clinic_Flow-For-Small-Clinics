"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Download, Trash2, Share2 } from "lucide-react"
import { softDeletePatient } from "@/actions/patients"
import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

export function PatientDanger({ patientId }: { patientId: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()

  return (
    <div className="flex items-center gap-2">
      {/* A link styled as a button — not a Button rendering an <a>, which
          strips native button semantics (Base UI warns about this). */}
      <a
        href={`/api/patients/${patientId}/export`}
        target="_blank"
        rel="noreferrer"
        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
      >
        <Download className="size-4" /> Export
      </a>
      <a
        href={`/api/patients/${patientId}/fhir`}
        target="_blank"
        rel="noreferrer"
        title="Download this record as a FHIR R4 bundle — the format hospitals, labs and ABDM exchange records in"
        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
      >
        <Share2 className="size-4" /> FHIR
      </a>
      <Dialog>
        <DialogTrigger
          render={
            <Button variant="outline" size="sm" className="text-destructive">
              <Trash2 className="size-4" /> Delete
            </Button>
          }
        />
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete this patient?</DialogTitle>
            <DialogDescription>
              The record is hidden immediately and permanently removed after 30 days. This cannot be
              undone once purged.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await softDeletePatient(patientId)
                  if (res.error) toast.error(res.error)
                  else {
                    toast.success("Patient deleted")
                    router.push("/patients")
                  }
                })
              }
            >
              {pending ? "Deleting…" : "Delete patient"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

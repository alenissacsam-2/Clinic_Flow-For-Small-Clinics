"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { setClinicSuspended } from "@/actions/admin"
import { Button } from "@/components/ui/button"

export function SuspendButton({ clinicId, suspended }: { clinicId: string; suspended: boolean }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [confirming, setConfirming] = useState(false)

  function run() {
    start(async () => {
      const res = await setClinicSuspended(clinicId, !suspended)
      if (res?.ok) {
        toast.success(suspended ? "Clinic unpaused" : "Clinic paused")
        setConfirming(false)
        router.refresh()
      } else {
        toast.error(res?.error ?? "Something went wrong")
      }
    })
  }

  if (suspended) {
    return (
      <Button onClick={run} disabled={pending} variant="default">
        {pending ? "Working…" : "Unpause clinic"}
      </Button>
    )
  }

  if (!confirming) {
    return (
      <Button onClick={() => setConfirming(true)} variant="destructive">
        Pause clinic
      </Button>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">Pause this clinic?</span>
      <Button onClick={run} disabled={pending} variant="destructive" size="sm">
        {pending ? "Pausing…" : "Confirm"}
      </Button>
      <Button onClick={() => setConfirming(false)} disabled={pending} variant="outline" size="sm">
        Cancel
      </Button>
    </div>
  )
}

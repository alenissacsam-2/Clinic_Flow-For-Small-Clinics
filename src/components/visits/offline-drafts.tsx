"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { CloudOff, RefreshCw } from "lucide-react"
import { saveVisit, type SaveVisitInput } from "@/actions/visits"
import { pendingDrafts, deleteDraft, putDraft, isOnline } from "@/lib/offline/draft-store"
import { Button } from "@/components/ui/button"
import { TONE } from "@/lib/status"
import { cn } from "@/lib/utils"

/**
 * Shows consultations that were written while the connection was down, and
 * replays them.
 *
 * Retries are always explicit or triggered by the browser telling us the
 * connection came back — never on a timer. A silent background retry loop
 * against a clinical record is the kind of thing that quietly writes a visit
 * twice, and a doctor pressing a button knows what they asked for.
 */
export function OfflineDrafts() {
  const router = useRouter()
  const [count, setCount] = useState(0)
  const [syncing, setSyncing] = useState(false)

  async function refresh() {
    setCount((await pendingDrafts()).length)
  }

  useEffect(() => {
    // Async work happens inside the callback, never synchronously in the
    // effect body — the React Compiler rule the rest of this app follows.
    const t = setTimeout(() => {
      void refresh()
    }, 0)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    function onOnline() {
      void refresh()
    }
    window.addEventListener("online", onOnline)
    return () => window.removeEventListener("online", onOnline)
  }, [])

  async function sync() {
    if (!isOnline()) {
      toast.error("Still offline. Try again once you have a connection.")
      return
    }
    setSyncing(true)
    const drafts = await pendingDrafts()
    let saved = 0
    let failed = 0

    for (const draft of drafts) {
      const res = await saveVisit(draft.payload as SaveVisitInput)
      if (res.error) {
        failed++
        // Leave it queued: a draft that failed to save must stay pending, or
        // the consultation is gone with nothing to show for it.
        await putDraft(draft.key, draft.payload, true)
      } else {
        saved++
        await deleteDraft(draft.key)
      }
    }

    setSyncing(false)
    await refresh()

    if (saved > 0) {
      toast.success(`${saved} offline consultation${saved === 1 ? "" : "s"} synced`)
      router.refresh()
    }
    if (failed > 0) {
      toast.error(`${failed} could not be saved and are still queued.`)
    }
  }

  if (count === 0) return null

  return (
    <div className={cn("flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm", TONE.warning.banner)}>
      <CloudOff className={cn("size-4 shrink-0", TONE.warning.text)} />
      <span className="min-w-0 flex-1">
        {count} consultation{count === 1 ? "" : "s"} saved on this device but not yet sent.
      </span>
      <Button type="button" size="sm" variant="outline" disabled={syncing} onClick={sync}>
        <RefreshCw className={cn("size-4", syncing && "animate-spin")} />
        {syncing ? "Syncing…" : "Sync now"}
      </Button>
    </div>
  )
}

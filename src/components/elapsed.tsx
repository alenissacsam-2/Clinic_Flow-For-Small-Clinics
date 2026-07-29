"use client"

import { useEffect, useState } from "react"

import { useHydrated } from "@/lib/use-hydrated"

/**
 * "22 min", ticking — how long since `iso`.
 *
 * ── Why this is live and not server-rendered ──────────────────────────────
 * A server-rendered "waiting 4 min" is correct for exactly one instant and
 * then quietly lies for as long as the tab stays open. On the Today screen
 * that number is the one a doctor uses to decide whether to hurry, and a tab
 * left open through a long consultation would show a four-minute wait to
 * somebody who has now been sitting outside for forty. So it ticks.
 *
 * 30s is the interval because the unit displayed is minutes: anything faster
 * is wasted wakeups on a phone, anything slower means the reading can be most
 * of a minute stale.
 *
 * SSR and the hydrating render emit `fallback` (a fixed clock time), because
 * "now" genuinely differs between the server and the browser and rendering it
 * on both sides is a guaranteed mismatch.
 */
export function Elapsed({
  iso,
  fallback,
  className,
}: {
  iso: string
  fallback: string
  className?: string
}) {
  const hydrated = useHydrated()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  if (!hydrated) return <span className={className}>{fallback}</span>

  const mins = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000))
  if (mins < 1) return <span className={className}>just now</span>
  if (mins < 60) return <span className={className}>{mins} min</span>
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return (
    <span className={className}>
      {h}h{m ? ` ${m}m` : ""}
    </span>
  )
}

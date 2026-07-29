"use client"

import { useEffect, useState } from "react"

type WakeLockStatus = "unsupported" | "held" | "released"

/**
 * Keep the screen awake.
 *
 * A waiting-room board is a tablet propped on a shelf. Every tablet ever made
 * dims and then sleeps after a couple of minutes of no touches, and a board
 * nobody touches is exactly the case — so without this the product's most
 * visible surface is a black rectangle for most of the day, and the clinic
 * concludes it is broken. Nothing else in the app is this dependent on a
 * browser API doing its job.
 *
 * The lock is dropped by the browser whenever the tab is hidden (a switch
 * away, a lock button, a screen that slept before the lock was taken), and it
 * is never given back automatically, so re-acquiring on `visibilitychange` is
 * not belt-and-braces — it is the whole mechanism.
 */
export function useWakeLock(enabled = true): WakeLockStatus {
  const [status, setStatus] = useState<WakeLockStatus>("released")

  useEffect(() => {
    if (!enabled) return

    let sentinel: WakeLockSentinel | null = null
    let cancelled = false

    // Support detection lives inside the async function rather than as an
    // early return above it, so no `setStatus` ever runs synchronously in an
    // effect body — the pattern this codebase has been bitten by three times.
    async function acquire() {
      if (typeof navigator === "undefined" || !("wakeLock" in navigator)) {
        setStatus("unsupported")
        return
      }
      if (document.visibilityState !== "visible") return
      try {
        const lock = await navigator.wakeLock.request("screen")
        if (cancelled) {
          void lock.release()
          return
        }
        sentinel = lock
        setStatus("held")
        lock.addEventListener("release", () => setStatus("released"))
      } catch {
        // Denied (insecure context, battery saver, an OS that says no). The
        // board still works; it just sleeps like any other page.
        setStatus("released")
      }
    }

    void acquire()
    document.addEventListener("visibilitychange", acquire)

    return () => {
      cancelled = true
      document.removeEventListener("visibilitychange", acquire)
      void sentinel?.release()
    }
  }, [enabled])

  return status
}

"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"

/**
 * The last stop before a blank screen.
 *
 * Two things this used to skip. It took `error` in its props type and never
 * touched it, so a crash in production left no trace anywhere — nothing in the
 * logs, nothing on screen, and a doctor on the phone saying "it just broke".
 * And Next attaches a `digest` to every server-side error, which is the only
 * handle that ties what the user saw to the stack trace in the platform logs.
 *
 * So: log it (which reaches the hosting platform's console) and show the digest,
 * quietly, as something to quote when reporting the problem.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[app] unhandled error", error)
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      <h1 className="font-heading text-lg font-semibold">Something went wrong</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        An unexpected error occurred. Please try again.
      </p>
      <Button onClick={reset}>Try again</Button>
      {error.digest && (
        <p className="text-xs text-muted-foreground">
          Reference <code className="font-mono">{error.digest}</code>
        </p>
      )}
    </div>
  )
}

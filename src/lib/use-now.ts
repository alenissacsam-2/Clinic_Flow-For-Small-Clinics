"use client"

import { useSyncExternalStore } from "react"

/**
 * A ticking clock, as an external store.
 *
 * The obvious implementation — `useState(new Date())` plus a `setInterval` in
 * an effect — is wrong here twice over. It reads the clock during render,
 * which the React Compiler rejects as impure, and it renders a server time
 * that is guaranteed to differ from the client's, which is a hydration
 * mismatch on every single load.
 *
 * `useSyncExternalStore` fixes both: the server snapshot is `0`, so the first
 * paint is a deliberate placeholder rather than a wrong time, and the client
 * snapshot is read outside render through the store contract. This is the same
 * shape as `useHydrated`, for the same reason.
 */

let lastSecond = 0

function subscribe(onChange: () => void): () => void {
  const id = setInterval(onChange, 1000)
  return () => clearInterval(id)
}

/**
 * Bucketed to whole seconds so repeated calls inside one render return an
 * identical value — `useSyncExternalStore` re-renders in a loop if the
 * snapshot changes every time it is asked.
 */
function getSnapshot(): number {
  const second = Math.floor(Date.now() / 1000)
  if (second !== lastSecond) lastSecond = second
  return lastSecond
}

function getServerSnapshot(): number {
  return 0
}

/** Epoch **seconds**, ticking once a second. `0` until hydrated. */
export function useNowSeconds(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

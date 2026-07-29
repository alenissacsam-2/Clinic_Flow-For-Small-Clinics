"use client"

import { useSyncExternalStore } from "react"

/** No store to watch — this value changes exactly once, at hydration. */
const subscribe = () => () => {}
const onClient = () => true
const onServer = () => false

/**
 * `false` during SSR and the hydrating render, `true` from the commit onwards.
 *
 * The obvious spelling of this is `const [m, setM] = useState(false)` plus
 * `useEffect(() => setM(true), [])`, and this repo has been bitten by that
 * shape enough times to have a lint rule against it — the React Compiler's
 * `set-state-in-effect` treats a synchronous `setState` in an effect body as
 * an error, because it is a second render pass the compiler cannot see through.
 *
 * `useSyncExternalStore` expresses the same thing without the extra render:
 * React uses `getServerSnapshot` for the server pass *and* the hydrating
 * client pass, so the markup matches by construction, then switches to
 * `getSnapshot` afterwards.
 *
 * Use this only for genuinely client-only facts (stored preferences, matchMedia
 * results). It is not a licence to defer rendering — anything gated on it is
 * invisible to a visitor with JS off.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, onClient, onServer)
}

/**
 * The handshake between the hero film and the curtain that waits for it.
 *
 * `PageCurtain` has to know when the film is up, but it is a sibling of the
 * hero several levels away and must not import it (the curtain renders before
 * the hero's tree exists, and pulling `HeroVideo` in would drag the video
 * element into the curtain's own boundary). A module-scoped latch plus one
 * window event is the whole contract.
 *
 * ── Why a latch and not just an event ────────────────────────────────────
 * The two components race. `HeroVideo`'s effect can resolve before the curtain
 * has mounted its listener — a cached video fires `loadeddata` almost
 * immediately — and an event with no listener is simply lost, which would leave
 * the curtain up until its own timeout every time the file was warm in cache.
 * That is the exact opposite of the intended behaviour: the *faster* the video
 * loaded, the longer the visitor would wait. So readiness is recorded as state
 * and the event is only the notification.
 */

export const HERO_READY = "clinicflow:hero-ready"

let ready = false

/**
 * Called by `HeroVideo` once the film is playing — or once it is certain the
 * film is never going to play, which is just as good an answer and must also
 * release the curtain. Idempotent: several of the events it is wired to can
 * fire for the same load.
 */
export function signalHeroReady() {
  if (ready) return
  ready = true
  window.dispatchEvent(new Event(HERO_READY))
}

export function isHeroReady() {
  return ready
}

"use client"

import { useEffect, useRef } from "react"

import { signalHeroReady } from "./boot"

/**
 * The hero's background film — a silent 10s clinic loop behind the headline.
 *
 * ── Why playback is started in an effect and not by `autoPlay` ────────────
 * Three groups should never be made to download a decorative video at all:
 * people who asked the OS for reduced motion, people on a metered or slow
 * connection, and people whose browser has Data Saver on. That decision can only
 * be made on the client — but branching the JSX on it would hydration-mismatch,
 * because the server cannot know any of it.
 *
 * This clip is a single MP4 only — no WebM sibling. It is 2.0MB, down from an
 * 11MB original, which is the right weight for the low-end-Android audience
 * the rest of this file protects.
 *
 * ── A known visual defect ships here, by explicit decision ────────────────
 * Roughly the first five seconds carry a **green particle artifact** — a spray
 * that erupts across the frame and reads as a rendering fault, not as light.
 * Measured by worst 8×8 tile (a frame *mean* dilutes a localised spray into
 * nothing and will call a badly damaged frame clean): peak green cast 85.
 *
 * An earlier version of this file clamped playback to the clean 6.4–9.95s tail
 * to hide it, first with a JS playback-window guard, later by shipping only
 * that pre-cut 3.5s window. Both were reverted on explicit request: the full
 * 10s loop reads as less abrupt than the short one did, and that was judged
 * worth the defect being visible. If that trade is ever revisited, the cut
 * command and the measurement method are in git history on this file.
 *
 * Two things must survive any re-encode:
 *
 * 1. **`-movflags +faststart`.** It puts `moov` — the index a player needs
 *    before it can present anything — ahead of `mdat`. Without it the browser
 *    downloads the entire file before the first frame appears. This asset has
 *    lost the flag twice already coming out of two different compressors; if
 *    a tool ever produces the file without it, the fix is a remux, not a
 *    re-encode: `ffmpeg -i in.mp4 -c copy -movflags +faststart out.mp4`.
 * 2. **`public/hero-poster.jpg` must be frame 0 of whatever ships.** Everyone
 *    who opts out below sees only the poster, and everyone else sees it during
 *    load, so a poster from a different frame makes the handoff a visible cut.
 *    Regenerate with `ffmpeg -i hero.mp4 -frames:v 1 -q:v 4 hero-poster.jpg`.
 *
 * So the markup is identical for everyone: a `<video>` with a poster, no
 * `autoplay` attribute, and `preload="none"` so not a single byte is fetched
 * until we say so. The effect then decides whether to call `.play()`. Everyone
 * who opts out simply keeps looking at the poster frame, which is a still from
 * the film — so the hero is never empty and never shifts.
 *
 * `saveData` / `effectiveType` are the Network Information API, which only
 * Chromium ships. That is the right shape here rather than a gap: the audience
 * this protects — solo doctors on low-end Android in Indian clinics — is
 * overwhelmingly on Chrome, and every other browser just gets the video.
 *
 * ── Why it used to play only *sometimes* ──────────────────────────────────
 * Two separate faults, both found by instrumenting the element rather than by
 * reading it:
 *
 * 1. **The decision was taken once and never revisited.** `effectiveType` is a
 *    rolling *estimate* of the last few requests, not a description of the
 *    hardware — Chrome will report `3g` for a healthy broadband connection that
 *    happened to be congested while the page loaded. Sample that once, at the
 *    single busiest moment in the page's life, and the film silently never
 *    plays; reload a minute later and it does. That is the "sometimes". The
 *    check now re-runs on `connection.change` and on the reduced-motion media
 *    query, so a connection that recovers gets its film.
 *
 * 2. **The pause-when-buried optimisation never fired.** It tracked a local
 *    `buried` flag and returned early when the flag already matched. But
 *    `play()` is asynchronous, and at mount it is still pending: scrolling away
 *    during that window called `pause()` on a video that had not started, set
 *    the flag to "buried", and *then* the pending `play()` resolved and began
 *    playback. From then on the flag said "buried, already handled" and pause
 *    was never called again. Measured: at `scrollY: 5000`, twelve screens below
 *    a 900px stage, `paused` was `false` — the film decoded for the entire page,
 *    which is precisely the battery this code was written to save. The flag is
 *    gone; the element's own `paused` is the state now, and it is reconciled on
 *    every scroll.
 */



/**
 * Connection types where a decorative download is not worth the visitor's data.
 *
 * `3g` used to be in this set and was the single biggest cause of the film
 * silently not playing. Measured: throttle to 400kbps/400ms, load the page, then
 * restore the connection to full wifi — `effectiveType` reports `3g` at load and
 * is **still** `3g` ten seconds later, with zero `change` events fired, and it
 * stays that way for the life of the tab no matter how much the visitor scrolls.
 *
 * That is not a throttling artifact, it is how the estimate works: Chrome
 * re-estimates from observed request timings, and a landing page that has
 * finished loading issues no more requests. So the value freezes at whatever was
 * measured during load — the one moment the browser is saturating its own pipe
 * with the page's own JavaScript, and therefore the least representative sample
 * it will ever take. `3g` is only "RTT above ~270ms or downlink under ~700kbps",
 * which a perfectly healthy broadband connection hits routinely while loading.
 *
 * The listener on `connection.change` below was supposed to be the recovery
 * path. It cannot be: the event never fires, because the estimate never moves.
 *
 * So the veto is now reserved for the two buckets that mean the connection is
 * genuinely dire, where a false positive is unlikely and the data saved is real.
 * `saveData` is untouched and is the honest signal here anyway — it is the
 * visitor stating a preference rather than us guessing at one.
 */
const SLOW = new Set(["slow-2g", "2g"])

type Connection = {
  saveData?: boolean
  effectiveType?: string
  addEventListener?: (t: string, fn: () => void) => void
  removeEventListener?: (t: string, fn: () => void) => void
}

const connection = () => (navigator as Navigator & { connection?: Connection }).connection

function shouldPlay() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false

  const c = connection()
  if (c?.saveData) return false
  if (c?.effectiveType && SLOW.has(c.effectiveType)) return false

  return true
}

export function HeroVideo({ className }: { className?: string }) {
  const ref = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const v = ref.current
    if (!v) return

    // Autoplay is only permitted for muted video, and Safari additionally wants
    // the property set rather than just the attribute.
    v.muted = true

    // The hero stage is pinned, so this film stays in the layout for the entire
    // page and would otherwise keep decoding frames behind twelve screens of
    // opaque content — real battery spent rendering something nobody can see,
    // on exactly the low-end Android hardware this product is built for.
    const buried = () => window.scrollY > (v.offsetHeight || window.innerHeight)

    let retries = 0
    let retryTimer = 0

    const sync = () => {
      const wanted = shouldPlay() && !buried()

      // The boot curtain is waiting on this film (see `boot.ts`), so every path
      // that settles the question has to report — including the ones that settle
      // it as "no". A visitor on Data Saver is never going to see the film, and
      // a visitor who reloaded halfway down the page has it buried under twelve
      // screens of content; making either stare at the plate until `MAX_WAIT`
      // expires would be punishing them for the answer being cheap.
      if (!wanted) signalHeroReady()

      if (wanted === !v.paused) return
      if (wanted) {
        if (v.preload !== "auto") v.preload = "auto"
        void v.play().then(signalHeroReady, onPlayFailed)
      } else {
        v.pause()
      }
    }

    /**
     * A rejected `play()` used to be the end of the film.
     *
     * `sync` only re-runs on scroll, visibility and the media queries, so on a
     * page nobody happens to scroll, one transient refusal — an interrupted
     * load, a decoder that was not ready, a `pause()` landing on a still-pending
     * play — left the poster up permanently. Two backed-off retries cost nothing
     * and turn "the film sometimes doesn't play" into "the film starts a beat
     * late", which nobody notices from behind the curtain.
     *
     * Declared rather than assigned so `sync` can name it above: both are only
     * ever *called* after this whole effect body has run.
     */
    function onPlayFailed() {
      signalHeroReady()
      if (retries >= 2) return
      retries += 1
      retryTimer = window.setTimeout(sync, 400 * retries)
    }

    sync()

    v.addEventListener("error", signalHeroReady)

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)")
    const c = connection()
    window.addEventListener("scroll", sync, { passive: true })
    motion.addEventListener("change", sync)
    // A tab that was in the background while the page loaded may never have been
    // given frames to present. Scroll alone cannot cover this: the visitor
    // switches back, looks at a hero that fits on one screen, and has no reason
    // to scroll at all.
    document.addEventListener("visibilitychange", sync)
    // Chromium only, and it is now belt-and-braces rather than the recovery path
    // it was written to be — see the note on `SLOW` for why it never fires.
    c?.addEventListener?.("change", sync)

    return () => {
      clearTimeout(retryTimer)
      window.removeEventListener("scroll", sync)
      motion.removeEventListener("change", sync)
      document.removeEventListener("visibilitychange", sync)
      c?.removeEventListener?.("change", sync)
      v.removeEventListener("error", signalHeroReady)
    }
  }, [])

  return (
    <video
      ref={ref}
      className={className}
      poster="/hero-poster.jpg"
      preload="none"
      loop
      muted
      playsInline
      // Decorative: the headline beside it carries the same message in text.
      aria-hidden
      tabIndex={-1}
    >
      <source src="/hero.mp4" type="video/mp4" />
    </video>
  )
}

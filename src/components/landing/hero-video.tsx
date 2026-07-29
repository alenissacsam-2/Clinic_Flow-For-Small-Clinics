"use client"

import { useEffect, useRef } from "react"

import { signalHeroReady } from "./boot"

/**
 * The hero's background film — a silent 10s phone-in-hand loop behind the headline.
 *
 * ── Why playback is started in an effect and not by `autoPlay` ────────────
 * Three groups should never be made to download 11MB of decorative video: people
 * who asked the OS for reduced motion, people on a metered or slow connection,
 * and people whose browser has Data Saver on. That decision can only be made on
 * the client — but branching the JSX on it would hydration-mismatch, because
 * the server cannot know any of it.
 *
 * This clip is a single MP4 only — no WebM sibling, because there is no local
 * encoder on this machine to produce one. At 11MB (vs. the ~1MB the previous
 * clinic loop cost) it is a real weight increase for exactly the low-end-Android
 * audience the rest of this file protects; re-encoding it down (H.264, lower
 * bitrate, and a WebM/VP9 copy) is worth doing before this ships to production.
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
 * ── Only part of this clip is usable ──────────────────────────────────────
 * The source is AI-generated and carries a **transition artifact from 2.0s to
 * 5.4s**: a green particle spray that erupts across the reception and, at its
 * peak, engulfs most of the frame. It does not read as light or as an effect —
 * it reads as a rendering fault, on the most-seen surface on the site.
 *
 * Measured rather than eyeballed, and the first measurement was wrong in an
 * instructive way. Scoring each frame by its *average* green cast put the
 * artifact's end at 4.4s, and a poster cut from 4.6s on that basis still had
 * green spray across its lower third — a large neutral ceiling had diluted a
 * localised artifact below the threshold. Re-scored by **worst 8×8 tile**, which
 * is the statistic that actually matches the question, the tail runs to 5.4s.
 *
 * So playback is held inside a clean window instead of looping the whole file.
 * What is left is the best material in the clip anyway: a slow push toward a
 * clinician at a reception desk. `public/hero-poster.jpg` is cut from `FROM`
 * exactly, so the poster→video handoff is not a visible cut — and that poster
 * needed recutting regardless, because the shipped one was a screenshot of a
 * *video player* with the scrubber, pause button and "0:00 / 0:10" baked into
 * it, sitting across the bottom of the hero for every visitor who only ever
 * sees the poster.
 *
 * **The real fix is to re-cut the file**, which would also roughly halve an
 * 11MB download — there is no encoder on this machine, so it is deferred, not
 * dismissed. Trimming to this window and re-encoding is one command:
 *
 *     ffmpeg -ss 6.4 -to 9.95 -i hero.mp4 -an -c:v libx264 -crf 26 \
 *            -movflags +faststart hero.mp4
 *
 * When that lands, delete `CLIP` and put `loop` back to doing the whole job.
 */
const CLIP = { from: 6.4, to: 9.95 }

/** Connection types where a decorative download is not worth the visitor's data. */
const SLOW = new Set(["slow-2g", "2g", "3g"])

type Connection = {
  saveData?: boolean
  effectiveType?: string
  addEventListener?: (t: string, fn: () => void) => void
  removeEventListener?: (t: string, fn: () => void) => void
}

/**
 * `requestVideoFrameCallback` is the right clock for the window guard: it fires
 * once per *presented frame*, so the clip can never advance more than one frame
 * past the window before being pulled back. `timeupdate` — the obvious
 * alternative — fires roughly four times a second, which would let up to 250ms
 * of the green transition play on every loop. It is a progressive enhancement
 * (Chrome 83+, Safari 15.4+, Firefox 132+) and the fallback below is correct,
 * just coarser.
 */
type FrameCallbacks = {
  requestVideoFrameCallback?: (cb: () => void) => number
  cancelVideoFrameCallback?: (handle: number) => void
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
    //
    // An IntersectionObserver cannot answer this: the pinned stage never stops
    // *intersecting* the viewport, it stops being visible because content is
    // painted on top of it, and occlusion is not something IO reports. Scroll
    // depth past the stage's own height is the only test that means "buried".
    const buried = () => window.scrollY > (v.offsetHeight || window.innerHeight)

    // One reconciler, driven by the element's real state rather than by a flag
    // shadowing it. `v.paused` cannot drift out of sync with the video the way
    // the old boolean did, and calling play() on a playing element or pause() on
    // a paused one is a no-op, so this is safe to run on every scroll event.
    const sync = () => {
      const allowed = shouldPlay()

      // The boot curtain is waiting on this film (see `boot.ts`), so every path
      // that settles the question has to report — including the ones that settle
      // it as "no". A visitor on Data Saver is never going to see the film, and
      // making them stare at a plate until it times out would punish exactly the
      // connection this opt-out exists to protect.
      if (!allowed) signalHeroReady()

      const wanted = allowed && !buried()
      if (wanted === !v.paused) return
      if (wanted) {
        // Deferred from mount: not one byte of an 11MB decorative file is
        // fetched until we have decided we actually want it.
        if (v.preload !== "auto") v.preload = "auto"
        // `play()` settles precisely when the answer is known — it resolves once
        // frames are actually being presented, and rejects if autoplay was
        // refused. Both are "the hero has finished arriving": a refused autoplay
        // leaves the poster up, which is the intended fallback and is no less
        // finished than the film. So the same handler takes both, and no
        // `canplay`-style guesswork is needed to approximate it.
        void v.play().then(signalHeroReady, signalHeroReady)
      } else {
        v.pause()
      }
    }

    sync()

    // Hold playback inside the clean window — see `CLIP` above. Also what seeks
    // to the start in the first place: the element is `preload="none"`, so
    // `currentTime` cannot be set until metadata exists, and `loadedmetadata` is
    // the first moment this is allowed to do anything at all.
    const hold = () => {
      if (v.currentTime < CLIP.from || v.currentTime >= CLIP.to) v.currentTime = CLIP.from
    }
    v.addEventListener("loadedmetadata", hold)

    const frames = v as HTMLVideoElement & FrameCallbacks
    const rvfc = frames.requestVideoFrameCallback?.bind(v)
    let handle = 0
    if (rvfc) {
      const step = () => {
        hold()
        handle = rvfc(step)
      }
      handle = rvfc(step)
    } else {
      v.addEventListener("timeupdate", hold)
    }

    // A 404, a codec the device refuses, a truncated file: the poster stays and
    // that is the final state, so the curtain must not keep waiting for frames
    // that are never going to arrive.
    v.addEventListener("error", signalHeroReady)

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)")
    const c = connection()
    window.addEventListener("scroll", sync, { passive: true })
    motion.addEventListener("change", sync)
    // Chromium only. A visitor whose connection was merely congested while the
    // page loaded gets the film as soon as the estimate recovers, instead of
    // being written off for the life of the tab.
    c?.addEventListener?.("change", sync)

    return () => {
      window.removeEventListener("scroll", sync)
      motion.removeEventListener("change", sync)
      c?.removeEventListener?.("change", sync)
      v.removeEventListener("error", signalHeroReady)
      v.removeEventListener("loadedmetadata", hold)
      v.removeEventListener("timeupdate", hold)
      if (handle) frames.cancelVideoFrameCallback?.(handle)
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
      {/* No WebM sibling for this clip yet — see the module doc. Shipping the
          stale clinic-footage WebM alongside this MP4 would mean different
          visitors see two different videos depending on codec support, which
          is worse than one video everyone gets.

          `#t=` is a **media fragment**, and it is doing real work, not just
          restating `CLIP.from`. Without it the element starts at zero and the JS
          guard seeks — which means the browser has already begun pulling the
          file from byte zero and then has to go and fetch a second range. With
          it, the first request is for the right offset. That is only true
          because this file is faststart: `moov` sits at 28KB, ahead of a 10.6MB
          `mdat`, so the browser can read the index and range-request straight to
          6.4s. (Verified by walking the top-level atoms; if the file is ever
          re-encoded, keep `-movflags +faststart` or this silently becomes a
          full-file download before a single frame shows.)

          Fragments never reach the server, so caching is unaffected. The end of
          the range is deliberately omitted — support for it is inconsistent, and
          `hold()` owns the loop point regardless. */}
      <source src="/hero.mp4#t=6.4" type="video/mp4" />
    </video>
  )
}

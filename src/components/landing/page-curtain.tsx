"use client"

import { useEffect } from "react"

import { HERO_READY, isHeroReady } from "./boot"

/**
 * The boot sequence: hold the page until the film is up, then part the curtain.
 *
 * Without this the hero assembles in the wrong order and it is very visible —
 * type and buttons rise into place over a *poster frame*, and the film cuts in
 * underneath them a beat later when the MP4 finishes buffering. The page looks
 * assembled rather than opened. So the order is inverted: the film starts first,
 * behind a plate, and everything else arrives onto a stage that is already
 * running.
 *
 * ── The state machine lives on `<html>`, not in React ────────────────────
 * `data-boot` takes three values, and every visual consequence hangs off it in
 * CSS:
 *
 *   "loading"  the plate covers the page, the hero's `animate-rise` entrances
 *              are held at frame zero, and the document cannot scroll.
 *   "opening"  the plate parts; the entrances are released and play *into* the
 *              opening gap, so the headline is rising as it is uncovered rather
 *              than sitting there finished when the plate clears.
 *   (absent)   over. The plate is `display: none` and costs nothing.
 *
 * It is an attribute rather than state because the things it drives are spread
 * across the whole tree — the curtain here, the hero's CSS keyframes two
 * components away, the document's own scrollability — and none of them share a
 * React ancestor that could hold it without re-rendering the entire page to
 * change it.
 *
 * ── Three ways this must not trap the visitor ────────────────────────────
 * A full-page opaque plate that fails to lift is the worst bug this file could
 * have, so nothing about its removal depends on the happy path:
 *
 * 1. **No JavaScript.** The inline script never runs, `data-boot` is never set,
 *    and every rule below is inert — the page is simply the page. The plate is
 *    hidden by default and only *shown* by the attribute, which is the right way
 *    round; a plate visible by default would need JS to remove it.
 * 2. **Hydration never happens.** The inline script arms its own failsafe before
 *    React is involved at all, so the attribute clears itself on a timer even if
 *    this component never mounts.
 * 3. **The film never loads.** `MAX_WAIT` caps the wait regardless of what the
 *    video is doing, and `HeroVideo` additionally signals ready on `error` and
 *    on every opt-out path (reduced motion, Data Saver, 2G) — cases where the
 *    film is *never* going to play and waiting for it would be waiting forever.
 *
 * ── Why the script checks `readyState` ───────────────────────────────────
 * It must arm on a real document load and not on a client-side route change.
 * Next re-executes inline scripts in the RSC payload when navigating from, say,
 * `/login` back to `/`, and a boot sequence firing on an in-app navigation is a
 * full-screen flash in the middle of a session. During initial parse
 * `readyState` is `"loading"`; on a client transition it is `"complete"`. That
 * one word is the whole discriminator.
 *
 * ── The cost, stated plainly ─────────────────────────────────────────────
 * Holding the `<h1>`'s entrance holds the LCP element, so this trades a real
 * Lighthouse number for the staging. `MAX_WAIT` is what bounds the damage and is
 * the number to lower if that trade stops being worth it — not `MIN_SHOW`, which
 * is only what stops a warm cache from producing a 90ms flash of indigo.
 */

/**
 * Shortest time the plate stays up. A cached video resolves in ~40ms, and a
 * full-screen plate that appears and vanishes inside three frames reads as a
 * rendering fault rather than as an intro.
 */
const MIN_SHOW = 620

/** Longest the film is allowed to hold the page, loaded or not. */
const MAX_WAIT = 2200

/** Must match the slowest keyframe in the `opening` state — see globals.css. */
const EXIT = 1150

/**
 * Armed during HTML parse, before the first paint, so the plate is already up
 * when the page appears rather than being applied a frame into it.
 *
 * The failsafe is deliberately inside this script and not in React: its whole
 * job is to cover the case where React never runs.
 */
const ARM = `if(document.readyState==="loading"){var d=document.documentElement;d.dataset.boot="loading";setTimeout(function(){if(d.dataset.boot==="loading")d.removeAttribute("data-boot")},4000)}`

export function PageCurtain() {
  useEffect(() => {
    const root = document.documentElement
    // Not armed: no-JS is impossible here, so this is a client-side navigation,
    // where the sequence is deliberately skipped.
    if (root.dataset.boot !== "loading") return

    const startedAt = performance.now()
    const timers: number[] = []
    let opened = false

    function open() {
      if (opened) return
      opened = true
      root.dataset.boot = "opening"
      timers.push(window.setTimeout(() => root.removeAttribute("data-boot"), EXIT))
    }

    // Someone who asked for reduced motion gets no theatre: the film will not
    // play for them either (`hero-video.tsx` refuses it), so there is nothing
    // to wait for and the minimum becomes zero. The plate still exists for one
    // frame and cross-fades rather than sliding — see the reduced-motion block
    // in globals.css.
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const floor = reduced ? 0 : MIN_SHOW

    function onReady() {
      timers.push(window.setTimeout(open, Math.max(0, floor - (performance.now() - startedAt))))
    }

    if (isHeroReady()) onReady()
    else window.addEventListener(HERO_READY, onReady, { once: true })

    timers.push(window.setTimeout(open, MAX_WAIT))

    return () => {
      window.removeEventListener(HERO_READY, onReady)
      timers.forEach(clearTimeout)
      // Unmounting mid-sequence (a route change while the plate is up) must not
      // leave the document locked and covered.
      root.removeAttribute("data-boot")
    }
  }, [])

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: ARM }} />

      <div aria-hidden className="page-curtain" data-curtain>
        {/* Two leaves meeting at the midline. They part to reveal the film from
            the centre outward, which is exactly where the headline is — so the
            first thing uncovered is the first thing to read. */}
        <span className="page-curtain-leaf page-curtain-leaf-top" />
        <span className="page-curtain-leaf page-curtain-leaf-bottom" />

        {/* The strike: a hairline of light along the join that blooms outward as
            the leaves separate. A projector catching, and the one moment of
            actual brightness in an otherwise very dark sequence. */}
        <span className="page-curtain-strike" />

        <span className="page-curtain-badge">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/mark.png" alt="" className="size-9 object-contain brightness-0 invert" />

          {/* Set letter by letter so the wordmark *types on* rather than fading
              in as a block. Ten spans is a rounding error in a document this
              size, and it is the one moment of the page whose entire job is to
              be watched — a block fade here would be the cheapest possible
              answer to the only question this screen asks.
              `--i` drives the delay from CSS; no JS, no motion library, and the
              whole thing is inert the moment `data-boot` clears. */}
          <span className="page-curtain-word font-heading text-lg font-semibold tracking-tight text-white">
            {"ClinicFlow".split("").map((ch, i) => (
              <span key={i} style={{ "--i": i } as React.CSSProperties}>
                {ch}
              </span>
            ))}
          </span>
          {/* Real-ish progress: it eases toward 92% over the window a cold
              fetch of this file actually takes, then completes the moment the
              film reports in. It never sits at 100% waiting, and it never
              claims to be done before it is. */}
          <span className="page-curtain-track">
            <span className="page-curtain-fill" />
          </span>
        </span>
      </div>
    </>
  )
}

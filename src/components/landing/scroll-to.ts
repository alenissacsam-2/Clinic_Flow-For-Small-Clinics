/**
 * The page's one scroll driver, and the only way to jump to a section.
 *
 * ── Why this module exists ────────────────────────────────────────────────
 * `SmoothScroll` owns the Lenis instance, but the nav lives in `SiteHeader`,
 * several components away and with no ancestor in common below the page root.
 * Threading the instance down through context would make every consumer a
 * client component and re-render the nav whenever the provider re-rendered;
 * Lenis is a singleton by nature (it takes over `window`'s scroll), so a module
 * binding models it more honestly than React state does.
 *
 * ── Why anchors are intercepted at all ────────────────────────────────────
 * `<a href="#pricing">` jumps. Not scrolls — *jumps*, one frame, no travel, and
 * on a page that is twelve screens tall the visitor lands somewhere with no idea
 * which direction they came from or how far. `scroll-behavior: smooth` is the
 * usual fix and is wrong here for two reasons: Lenis has already taken the
 * scroll, so the two animate the same property against each other; and the
 * native duration is fixed by the UA, which on a 11,000px page is a very long
 * ride.
 *
 * So the jump is replaced by a *fast* travel: long enough to see which way the
 * page went, short enough that nobody waits for it.
 */

type LenisLike = {
  scrollTo: (
    target: string | number | HTMLElement,
    opts?: { duration?: number; easing?: (t: number) => number },
  ) => void
  destroy: () => void
}

let lenis: LenisLike | null = null

/** Called by `SmoothScroll` on mount, and with `null` on unmount. */
export function registerLenis(instance: LenisLike | null) {
  lenis = instance
}

/**
 * Distance-aware, because a fixed duration is wrong at both ends: 0.8s is a
 * blur across 11,000px and a crawl across 600. This keeps the *pace* roughly
 * constant inside a clamp, so every jump on this page lands between about half
 * a second and a second and a quarter regardless of how far it went.
 */
function travelTime(distance: number) {
  return Math.min(1.25, Math.max(0.45, Math.abs(distance) / 9000))
}

/**
 * `easeInOutCubic`. The choice matters more than the duration does.
 *
 * The first attempt used `easeOutExpo`, which is the reflex pick for "leaves
 * immediately, arrives without a bounce" — and it was measured travelling
 * **2,886px in a single frame** on the way to Features, out of 5,522 total.
 * That is what an exponential ease *is*: half the distance is spent in the
 * first tenth of the duration. Technically a scroll; indistinguishable from a
 * jump followed by a settle.
 *
 * An ease that is symmetric spends its time in the middle of the journey
 * instead of the start, which is the part the visitor needs to see — it is what
 * tells them which way the page went and roughly how far.
 */
const EASE = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

/**
 * Scroll to `#id`. Returns false when it could not handle it, so the caller can
 * let the browser do its normal thing rather than swallowing the click.
 *
 * ── The nav offset is not in this file, deliberately ─────────────────────
 * It looks like it should be: the header is fixed, so every target needs to
 * land ~96px down or it arrives underneath the pill. The first version passed
 * `offset: -96` here and landed every section **192px** down instead.
 *
 * Lenis already reads `scroll-margin-top` off the target and subtracts it
 * (`lenis.mjs`, `scrollTo`), and all three targets carry `scroll-mt-24` for the
 * benefit of native anchor jumps — so the offset was being applied twice, once
 * by the class and once by hand. Every path below honours `scroll-margin-top`
 * on its own: Lenis reads it, and `scrollIntoView` is specified to respect it.
 * So the number lives on the sections, in the markup, exactly once.
 */
export function scrollToId(hash: string): boolean {
  if (!hash.startsWith("#") || hash.length < 2) return false

  const el = document.getElementById(hash.slice(1))
  if (!el) return false

  // Set before scrolling: a hash written after an async scroll fights it, and
  // `replaceState` (not `location.hash =`) avoids the native jump entirely
  // while still leaving a copyable, reloadable URL in the bar.
  history.replaceState(null, "", hash)

  // Reduced motion gets the instant jump. This is the one place where "no
  // animation" is not a downgrade: the visitor asked for exactly this, and
  // travel across twelve screens is the most vestibular thing the page can do.
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    el.scrollIntoView()
    return true
  }

  if (lenis) {
    const distance = el.getBoundingClientRect().top
    lenis.scrollTo(el, { duration: travelTime(distance), easing: EASE })
    return true
  }

  // No Lenis — touch devices keep native scrolling by design (see
  // `smooth-scroll.tsx`), so this is the common path on a phone, not a fallback
  // for a broken state.
  el.scrollIntoView({ behavior: "smooth", block: "start" })
  return true
}

"use client"

import Link from "next/link"
import { useEffect, useRef } from "react"
import { useMotionValueEvent, useScroll } from "motion/react"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ScrollProgress } from "./motion-primitives"
import { scrollToId } from "./scroll-to"

/**
 * The nav: a floating pane of liquid glass, from the very top of the page.
 *
 * ── Two pieces of state, both in DOM attributes rather than React ─────────
 * `data-scrolled` — past 80px, the bar collapses into the pill.
 * `data-over`     — whether the pill is currently over a light or a dark band,
 *                   which inverts its tint and its whole foreground.
 *
 * Neither lives in `useState`. `scrollY` changes 60–120 times a second, so
 * holding either in state would re-render this component — and every link and
 * button in it — on every one of those frames, and would put a `setState`
 * inside a subscription callback that the React Compiler lint rule watches
 * closely. The callback writes both attributes straight onto the element and
 * CSS does the rest. React renders this component exactly once.
 *
 * The equality checks before writing matter: assigning the same value on every
 * frame still dirties the attribute and can re-trigger style recalculation.
 *
 * ── Why the tint has to adapt ────────────────────────────────────────────
 * The page alternates bone and deep indigo bands. A single fixed tint is wrong
 * on one of them by construction — dark-on-light becomes invisible over indigo,
 * light-on-dark becomes a grey slab over bone. So the pane samples which kind
 * of band it is over and flips.
 *
 * That flip is not only cosmetic. Over indigo, the pill's tint is a 10% white
 * wash, which is nowhere near opaque enough to carry dark ink — so the logo,
 * the nav links and both buttons invert with it. An adaptive surface without an
 * adaptive foreground is just an unreadable nav.
 */

const NAV = [
  { href: "#features", label: "Features" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
]

/** Distance scrolled before the bar collapses into a pill. */
const THRESHOLD = 80

/**
 * Where to sample the backdrop, in px below the top of the viewport. This is
 * the pill's own midline (it sits at ~8px with a ~48px box), NOT the top of the
 * header — sampling at 0 would flip the tint a beat before the bar visibly
 * reaches the seam. A constant beats reading the bar's rect every frame, which
 * would force a layout on a sticky, composited element.
 */
const PROBE = 32

/** Document-space [top, bottom] of each dark band. */
type Band = readonly [number, number]

/** Document-space extent of one link target, plus the link that points at it. */
type Section = { link: HTMLElement; top: number; bottom: number }

/**
 * Everything measured once and re-measured on resize, so the scroll path itself
 * reads no layout. Held in one object because `paint` is called ~120 times a
 * second and a single deref beats four.
 */
type Geometry = { bands: readonly Band[]; sections: readonly Section[] }

const EMPTY: Geometry = { bands: [], sections: [] }

/**
 * Module scope, so it has no reactive dependencies and both the scroll
 * subscription and the initial sync can call it.
 */
function paint(el: HTMLElement, geo: Geometry, y: number) {
  const scrolled = y > THRESHOLD
  if ((el.dataset.scrolled === "true") !== scrolled) {
    el.dataset.scrolled = String(scrolled)
  }

  const probe = y + PROBE
  const over = geo.bands.some(([top, bottom]) => probe >= top && probe < bottom) ? "dark" : "light"
  if (el.dataset.over !== over) {
    el.dataset.over = over
  }

  // Which section is being read, marked on the links themselves.
  //
  // The reading line is a third of the way down the viewport, NOT the top edge:
  // a section counts as "the one you are reading" once it dominates the screen,
  // and probing at 0 would hand the mark to whatever has just barely appeared at
  // the bottom. Same equality check as above — writing an unchanged attribute
  // still dirties style recalculation, 120 times a second, on a `fixed` element.
  const line = y + window.innerHeight / 3
  for (const s of geo.sections) {
    const on = String(line >= s.top && line < s.bottom)
    if (s.link.dataset.active !== on) s.link.dataset.active = on
  }
}

export function SiteHeader() {
  const ref = useRef<HTMLElement>(null)
  const geo = useRef<Geometry>(EMPTY)
  const { scrollY } = useScroll()

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const measure = () => {
      const bands = Array.from(
        document.querySelectorAll<HTMLElement>("[data-band='dark']"),
        (band) => {
          const r = band.getBoundingClientRect()
          return [r.top + window.scrollY, r.bottom + window.scrollY] as const
        },
      )

      const sections: Section[] = []
      for (const link of el.querySelectorAll<HTMLElement>("[data-nav]")) {
        const target = document.getElementById(link.dataset.nav ?? "")
        if (!target) continue
        const r = target.getBoundingClientRect()
        sections.push({ link, top: r.top + window.scrollY, bottom: r.bottom + window.scrollY })
      }

      geo.current = { bands, sections }
      // Re-sync after measuring: the page can be restored mid-scroll, where no
      // `change` event fires until the visitor moves.
      paint(el, geo.current, window.scrollY)
    }

    measure()

    // Fonts swapping, images decoding and the stacking panels all change the
    // page height after first paint, and every one of those moves the bands. A
    // resize listener alone would miss all three.
    const ro = new ResizeObserver(measure)
    ro.observe(document.body)
    return () => ro.disconnect()
  }, [])

  useMotionValueEvent(scrollY, "change", (y) => {
    if (ref.current) paint(ref.current, geo.current, y)
  })

  /**
   * Anchors travel instead of jumping — see `scroll-to.ts`. The default is only
   * prevented when the scroll was actually handled, so a target that has somehow
   * gone missing still falls through to the browser's own behaviour rather than
   * becoming a dead link.
   */
  function jump(e: React.MouseEvent<HTMLAnchorElement>, href: string) {
    // Let modified clicks (new tab, new window, download) do their normal thing.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
    if (scrollToId(href)) e.preventDefault()
  }

  return (
    <>
      {/* The read-progress hairline is pinned to the very top of the viewport
          rather than the header's foot — once the header is a floating pill it
          no longer has a foot to draw a rule against. */}
      <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5">
        <ScrollProgress />
      </div>

      {/* `fixed`, not `sticky`. A sticky header still occupies a row in normal
          flow, which pushed the hero down and left a bare strip of page
          background across the very top of the site — a white bar above the
          film. Taking the nav out of flow lets the hero start at y=0 and run
          under it, which is the only way a full-bleed background reaches the
          top edge. The hero pays for it with `pt-28`.

          `group` + the ref sit on the same element so both scroll flags can
          drive descendants through `group-data-[…]:`.

          `data-over` starts at "dark" because the first band on this page is
          the dark hero. The effect corrects it on mount either way, but seeding
          it right avoids a frame of dark ink over the film. */}
      <header
        ref={ref}
        data-scrolled="false"
        data-over="dark"
        className="group fixed inset-x-0 top-0 z-40 px-3 pt-2 sm:px-4"
      >
        <div
          className={cn(
            // Glass from the very top now, rather than materialising on scroll:
            // over a moving film a transparent bar has nothing to hold the nav
            // apart from the footage, and the labels crawl with it.
            //
            // `relative isolate overflow-hidden` exist for exactly one reason:
            // clipping the sheen sibling below to the pill's rounded shape.
            // Without `overflow-hidden` a rectangular gradient would square off
            // the pill's curved ends.
            "header-morph liquid-glass relative isolate mx-auto flex items-center justify-between gap-4 overflow-hidden",
            "max-w-6xl rounded-full border px-2 py-3",
            "group-data-[scrolled=true]:max-w-3xl group-data-[scrolled=true]:px-3",
            "group-data-[scrolled=true]:py-2",
          )}
        >
          {/* Specular sheen — the glossy highlight band real glass throws
              under an overhead light. This is the single biggest thing
              missing from plain blur+tint; without it a frosted pane reads as
              a translucent div, not a physical pane. Independent of which
              band the pill is over (a highlight from an implied light source
              doesn't invert like the tint does), so it isn't wired to
              `data-over`.

              `-z-10`, not the DOM-order default: an absolutely-positioned box
              with no z-index paints AFTER normal in-flow siblings no matter
              where it sits in the markup (CSS stacking order, not DOM order),
              so without this the sheen would wash out the logo and nav text
              sitting after it. Negative z-index instead places it between the
              pill's own background and its content — `isolate` above scopes
              that negative value to this pill alone. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-1/2 bg-gradient-to-b from-white/10 to-transparent"
          />
          <Link
            href="/"
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-full px-1 transition-colors duration-300",
              "group-data-[over=dark]:text-sidebar-foreground",
            )}
          >
            {/* The mark is a single indigo on transparent, so `brightness-0`
                flattens it to black and `invert` lifts it to white — one
                monochrome asset covering both bands, no second file. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/mark.png"
              alt=""
              className="size-7 object-contain transition duration-300 group-data-[over=dark]:brightness-0 group-data-[over=dark]:invert"
            />
            <span className="font-heading text-lg font-semibold tracking-tight">ClinicFlow</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                // `data-nav` is both the measurement hook (the effect above
                // resolves it to the target's document extent) and the id the
                // link points at. `data-active` is seeded so the first paint has
                // a value to match on rather than a missing attribute.
                data-nav={item.href.slice(1)}
                data-active="false"
                onClick={(e) => jump(e, item.href)}
                className={cn(
                  "group/nav relative rounded-full px-3 py-1.5 text-sm font-medium",
                  "text-muted-foreground transition-colors duration-300 hover:text-foreground",
                  "data-[active=true]:text-foreground",
                  "group-data-[over=dark]:text-sidebar-foreground/70",
                  "group-data-[over=dark]:hover:text-sidebar-foreground",
                  "group-data-[over=dark]:data-[active=true]:text-sidebar-foreground",
                )}
              >
                {/* Reading marker. Deliberately NOT the hover treatment — if
                    being over a link and being *in* its section looked the same,
                    the marker would stop meaning anything the moment the pointer
                    happened to rest on the nav. */}
                <span
                  aria-hidden
                  className={cn(
                    "absolute inset-0 rounded-full bg-accent/70 opacity-0",
                    "transition-opacity duration-300 group-data-[active=true]/nav:opacity-100",
                    "group-data-[over=dark]:bg-white/12",
                  )}
                />

                {/* The label rolls: two stacked copies in a one-line-tall clip
                    box, both translated up by exactly that height on hover, so
                    the second arrives as the first leaves.
                    `h-5`/`leading-5` against `text-sm` is what keeps this safe —
                    a clip box at the font's own size would shave the descender
                    off "Pricing", which is the trap `SplitReveal` documents. The
                    3px of half-leading above and below clears a measured 3.3px
                    descender. */}
                <span className="relative block h-5 overflow-hidden leading-5">
                  <span className="block transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/nav:-translate-y-5">
                    {item.label}
                  </span>
                  <span
                    aria-hidden
                    className="block transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/nav:-translate-y-5"
                  >
                    {item.label}
                  </span>
                </span>
              </a>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/login"
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                "hidden transition-colors duration-300 sm:inline-flex",
                "group-data-[over=dark]:text-sidebar-foreground",
                "group-data-[over=dark]:hover:bg-white/10",
                "group-data-[over=dark]:hover:text-sidebar-foreground",
              )}
            >
              Sign in
            </Link>
            {/* Deep indigo on a deep indigo band is not a button, it is a
                rectangle. Over dark it becomes the paler sidebar primary — the
                same swap the closing CTA band makes, for the same reason. */}
            <Link
              href="/signup"
              className={cn(
                buttonVariants({ size: "sm" }),
                "rounded-full transition-colors duration-300",
                "group-data-[over=dark]:bg-sidebar-primary",
                "group-data-[over=dark]:text-sidebar-primary-foreground",
                "group-data-[over=dark]:shadow-none",
              )}
            >
              Get started
            </Link>
          </div>
        </div>
      </header>
    </>
  )
}

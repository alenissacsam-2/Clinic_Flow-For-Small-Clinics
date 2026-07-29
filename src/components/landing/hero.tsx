import Link from "next/link"
import { ArrowRight, ChevronDown } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { AnimatedMockup } from "./animated-mockup"
import { HeroFragments } from "./hero-fragments"
import { HeroVideo } from "./hero-video"

/**
 * The hero — a dark room with a clinic film playing behind it.
 *
 * A Server Component on purpose. The `<h1>` is the LCP element and is also what
 * the e2e suite asserts on (`toContainText("clinic day")`), so it must be real
 * HTML in the first response — never text assembled by a client component after
 * hydration. Its entrance is the CSS `animate-rise` utility, not motion.
 *
 * ── Why this section is dark, and why the film is NOT dimmed ─────────────
 * The film is bright and busy — a lit reception desk, a phone screen. Dark ink
 * on top of it is unreadable at any scrim strength that still lets you see the
 * footage, so the choice is really "see the film" or "keep the light hero", and
 * this is the former.
 *
 * That reasoning was then taken one step too far. An earlier pass removed the
 * scrim from everything below the nav so that "the headline, paragraph and both
 * CTAs sit directly over the film with no tint at all" — and measured against
 * the frame actually on screen, white type over the `<h1>`'s strip scored
 * **2.37:1** on the average pixel and **1.00:1** at the brightest pixels. The
 * most important sentence on the site was not low-contrast; it was invisible.
 *
 * Three fixes were tried and rejected before the current one, and the reasons
 * are worth keeping because each was a different wrong answer:
 *   · a translucent indigo **scrim** — composites a colour *onto* the picture,
 *     lifting blacks toward the tint and flattening the range. Reads dim and
 *     muddy, which is exactly what compositing does and grading does not.
 *   · stacked **`drop-shadow`s** on the type — kept the plate bright, but
 *     chained drop-shadows each filter the result of the last, so they compound
 *     into a dark rim, and a rim around white type is a dated device at any
 *     strength worth having.
 *   · a masked **`backdrop-filter`** defocusing the plate behind the text —
 *     right instinct, since busy detail hurts legibility as much as luminance,
 *     but blur is a local average and this shot has a bright window dead centre,
 *     so it dragged that brightness inward and left a milky patch under the
 *     headline.
 *
 * What ships is `hero-plate` (globals.css): one `brightness()` grade on the
 * video itself. A multiply, not a composite — blacks stay black, the range
 * survives, saturation comes back on top. The type then carries **nothing at
 * all**: no shadow, no stroke, no plate. Worst-case contrast over the `<h1>`
 * measured 5.16–7.59:1 across five frames of the loop, against 1.15–1.91:1
 * untreated. Read the utility's comment before changing any of it.
 *
 * The glass nav's inverted tint is driven by `data-band="dark"` — but for the
 * *stage* that attribute lives on a static marker in `page.tsx` rather than on
 * this section, because a pinned element cannot be measured into document
 * coordinates. The showcase below, being an ordinary in-flow section, carries
 * it directly.
 *
 * `nm-dark-surface` is mandatory for the same reason as the other dark bands:
 * without it
 * every raised element inside paints a light-theme highlight onto near-black.
 *
 * The floating fragments and the queue mockup stay light — they are the product,
 * and light cards over a dark film is exactly the contrast that makes them read.
 *
 * ── The film does not scroll away; the page rises over it ─────────────────
 * The hero is two components, and the split is the whole mechanism.
 *
 * `Hero` is the **stage**: exactly one viewport tall and `sticky top-0`, so it
 * locks from the very first pixel of scroll and never moves again. Everything
 * after it travels over the top and buries it, like a curtain going up.
 *
 * `HeroShowcase` is the queue mockup, and it lives *outside* the pinned stage
 * on purpose. The old single-section hero was ~1,170px tall — taller than any
 * viewport it will ever be opened in — and a pinned box is exactly one screen,
 * so keeping the mockup inside would have cropped it out of existence forever.
 * Pushing it into the rising stack costs nothing (it keeps the same dark band
 * and the same floating fragments) and it makes the mockup the *first* thing
 * that rises over the film, which is a better beat than it had before.
 *
 * `sticky bottom-0` on one tall section looks like the obvious alternative and
 * is not: measured here, it never engages at all, because the sticky box is
 * additionally constrained to its containing block and a box whose static
 * position is at the *top* of a 12,000px `main` has no bottom-edge constraint
 * to satisfy. It simply scrolls away like a normal element.
 *
 * The third part lives in `page.tsx`: everything after the showcase sits in one
 * opaque `z-10` stack. Opaque because several bands below are translucent tints
 * (`bg-secondary/35`) which, with a film pinned behind them, would composite
 * against the footage rather than the page.
 */
export function Hero({ demoSlug }: { demoSlug: string }) {
  return (
    <section
      className={cn(
        "nm-dark-surface sticky top-0 z-0 isolate flex h-svh flex-col justify-center",
        // A pinned stage is exactly one viewport and cannot scroll, so its
        // content has a hard ceiling. Measured at 360×640 — the smallest
        // realistic Android viewport once browser chrome is subtracted — the
        // original spacing overflowed by 9px and pushed the headline up under
        // the fixed nav. Everything below steps back up at `sm`.
        "overflow-hidden bg-sidebar px-4 pt-20 pb-10 text-sidebar-foreground sm:pt-28 sm:pb-12",
      )}
    >
      <HeroVideo className="hero-plate absolute inset-0 -z-20 size-full object-cover" />

      {/* Top-only gradient — a surface for the glass nav to sit on, and nothing
          more. `h-64` fades out well above the headline, so the film runs at
          full brightness behind every word below it.
          `from-black/90` rather than the original `/70` — the source clip has a
          bright light-streak pass through this exact band, and 70% still let it
          wash the bar out. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-64 bg-gradient-to-b from-black/90 to-transparent"
      />

      <div className="relative mx-auto w-full max-w-6xl">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="animate-rise text-balance font-heading text-[2.3rem] leading-[1.04] font-extrabold tracking-[-0.04em] [animation-delay:80ms] sm:text-6xl sm:leading-[1.02] lg:text-[4.5rem]">
            Run your whole clinic day{" "}
            {/* The light-theme gradient here was indigo→clay, both of which are
                dark. On this band it has to run between two LIGHT stops or the
                phrase reads as a hole in the headline. */}
            <span className="bg-gradient-to-br from-[color-mix(in_oklab,var(--sidebar-primary),white_28%)] to-[color-mix(in_oklab,var(--chart-4),white_35%)] bg-clip-text text-transparent">
              without touching paper
            </span>
          </h1>

          <p className="animate-rise mx-auto mt-4 max-w-xl text-pretty leading-relaxed text-white/92 [animation-delay:160ms] sm:mt-6 sm:text-lg">
            The simple, fast practice manager for solo doctors. Patients book online, get WhatsApp
            confirmations and reminders, and receive their prescription and receipt — all
            automatically.
          </p>

          <div className="animate-rise mt-6 flex flex-wrap items-center justify-center gap-3 [animation-delay:240ms] sm:mt-9">
            <Link
              href="/signup"
              className={cn(
                buttonVariants({ size: "lg" }),
                "btn-shine group bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90",
              )}
            >
              {/* Ink sweep, not light: the button is pale here, so a white
                  sheen crossing it would be invisible. */}
              <span aria-hidden className="btn-shine-bar-ink" />
              Start free — set up in 2 minutes
              <ArrowRight className="transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
            <Link
              href={`/book/${demoSlug}`}
              className={cn(
                buttonVariants({ size: "lg", variant: "outline" }),
                // The outline variant is a bone plane with ink text. Over the
                // film it becomes glass, so the footage still shows through.
                //
                // The tint is BLACK, not white. `bg-white/10` over a sunlit
                // frame is lighter than the film behind it, so pale text on it
                // vanished completely wherever the clip was bright — measured
                // as the worst element in the hero. A dark glass plate keeps the
                // footage visible through it while giving the label something to
                // sit on no matter what frame is underneath.
                "border-white/30 bg-black/35 text-white backdrop-blur-md",
                "hover:border-white/45 hover:bg-black/45 hover:text-white",
              )}
            >
              See a live booking page
            </Link>
          </div>

          {/* Hidden on very short windows. A height-based query, not a width
              one — the constraint here is the pinned stage's vertical budget,
              and a 360×640 phone and a 1440×620 laptop have exactly the same
              problem. This line is the only thing in the stage that can go: it
              is reassurance, and the pricing band states all three points
              again. The headline, the promise and both buttons never move. */}
          <p className="animate-rise mt-4 text-xs font-medium text-white/75 [animation-delay:320ms] sm:mt-5 [@media(max-height:680px)]:hidden">
            No card required · 14-day free trial · Built for Indian clinics
          </p>
        </div>
      </div>

      {/* A pinned stage gives no visual cue that the page continues — the
          usual "it scrolled" feedback is the hero moving, and it no longer
          does. This is that cue, and it is the only reason it exists. */}
      <span
        aria-hidden
        className="animate-rise absolute inset-x-0 bottom-6 flex flex-col items-center gap-1.5 text-[0.625rem] tracking-[0.2em] text-white/60 [animation-delay:520ms]"
      >
        SCROLL
        <ChevronDown className="animate-float-slow size-3.5" />
      </span>
    </section>
  )
}

/**
 * The queue mockup, as the first thing that rises over the film.
 *
 * Same dark band, same floating fragments, same `nm-dark-surface` contract as
 * the stage — it reads as one continuous hero that happens to move.
 *
 * ── Frosted, not painted ─────────────────────────────────────────────────
 * The panel used to be a flat `bg-sidebar` — opaque, so the curtain covered
 * the film with a wall of solid indigo the instant it arrived. It is now a
 * neutral black tint plus a light `backdrop-blur`, so the rising panel barely
 * dims the film at all: the footage stays legible and only slightly softened,
 * which reads as a pane of glass sliding over the scene rather than any kind
 * of lid. Black, not the `bg-sidebar` indigo used for every other dark band on
 * this page — a colour cast over real video reads as a blue overlay on the
 * footage, not as depth, and that reads worse the less the clip itself looks
 * like a dim clinic interior. The first pass at this used `backdrop-blur-2xl`
 * (40px) and a heavier tint — closer to actual frosted glass than to the
 * "barely there" pane this is meant to be, so both came down hard.
 *
 * `backdrop-filter` samples whatever is already composited behind an element
 * in paint order — not DOM ancestry — so it picks up the pinned `Hero` video
 * even though this section is a sibling several levels removed from it, as
 * long as nothing between them clips or forces its own backdrop root. Verified
 * with a real screenshot mid-scroll: the desk and the WhatsApp phone are both
 * visibly, blurrily present through the panel where the mockup cards don't
 * cover them.
 *
 * The floating cards themselves stay fully opaque (`bg-card` inside
 * `HeroFragments`/`AnimatedMockup`) — only the empty background of this panel
 * is glass. A translucent *card* would let the headline bleed through the
 * mockup while both are on screen, which reads as a rendering fault; a
 * translucent *backdrop* behind opaque cards reads as depth.
 */
export function HeroShowcase() {
  return (
    <section
      data-band="dark"
      className={cn(
        "nm-dark-surface bg-grain relative z-10 isolate overflow-hidden",
        // A little of each rather than a lot of either: a thin tint alone
        // would be a diluted flat wall, and blur alone with no tint at all
        // would let a bright frame of the film wash out the mockup's contrast
        // right at the edges the cards sit near. Together, in these small
        // amounts, they read as glass rather than as paint or as nothing.
        "bg-black/18 backdrop-blur-xs",
        // The curtain's leading edge. Square, it was a razor line slicing
        // through whatever part of the headline it happened to be crossing and
        // read as a clipping bug; rounded, it reads as a panel sliding over.
        "rounded-t-3xl border-t border-white/15 sm:rounded-t-[2.5rem]",
        "shadow-[0_-30px_60px_-20px_oklch(0_0_0/0.65)]",
        "pt-8 pb-20 text-sidebar-foreground sm:pt-10 sm:pb-24",
      )}
    >
      <div
        aria-hidden
        className="glow-primary animate-glow-drift pointer-events-none absolute -top-24 left-1/2 -z-10 size-[34rem] -translate-x-1/2 rounded-full opacity-60 blur-3xl"
      />
      <div className="relative mx-auto max-w-6xl px-4">
        <HeroFragments>
          <AnimatedMockup />
        </HeroFragments>
      </div>
    </section>
  )
}

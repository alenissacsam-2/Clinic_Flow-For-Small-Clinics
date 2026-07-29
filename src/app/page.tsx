import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import { CtaBand } from "@/components/landing/cta-band"
import { DayChapter } from "@/components/landing/day-chapter"
import { Faq } from "@/components/landing/faq"
import { Features, HowItWorks } from "@/components/landing/features"
import { Hero, HeroShowcase } from "@/components/landing/hero"
import { LandingMotionProvider } from "@/components/landing/motion-primitives"
import { PageCurtain } from "@/components/landing/page-curtain"
import { Pricing } from "@/components/landing/pricing"
import { SiteFooter } from "@/components/landing/site-footer"
import { SiteHeader } from "@/components/landing/site-header"
import { SmoothScroll } from "@/components/landing/smooth-scroll"
import { Stats } from "@/components/landing/stats"
import { TryIt } from "@/components/landing/try-it"
import { TrustMarquee } from "@/components/landing/trust-marquee"

/**
 * The marketing page.
 *
 * Rhythm is the point of the section order: the page alternates bone and deep
 * indigo (hero → … → DayChapter → … → CtaBand) so a long scroll reads as
 * movement between rooms rather than one continuous surface.
 *
 * Everything here is server-rendered. The client boundaries are narrow and
 * deliberate — `SmoothScroll`, the hero's floating fragments, the scrubbed
 * manifesto text, the stacking panels, and the header's scroll listener — and
 * they all live under `components/landing/`, which is the only place in this
 * codebase allowed to import `motion/react`.
 */
export default async function Home() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) redirect("/today")

  const demoSlug = process.env.NEXT_PUBLIC_DEMO_CLINIC_SLUG ?? "sunrise-clinic"

  return (
    <LandingMotionProvider>
      {/* First in the tree so its inline script runs before any of the page
          below it is parsed — the plate has to be up in the first paint, not
          applied a frame into it. */}
      <PageCurtain />
      <SmoothScroll />
      <div className="flex min-h-screen flex-col">
        <SiteHeader />

        <main className="relative flex-1">
          {/* The hero stage's dark band, marked by proxy.

              `site-header.tsx` locates dark bands by measuring elements that
              carry `data-band="dark"` into document coordinates. That
              measurement cannot be taken from the stage itself any more,
              because the stage is `sticky` and pinned: a pinned element reports
              a viewport rect of `top: 0` at every scroll position, so
              `rect.top + scrollY` slides *down the document with the scroll* and
              would mark whatever the visitor is currently looking at as dark.
              (`offsetTop` is no better — measured in Chromium it drifts
              identically, so the obvious "use layout position instead" fix does
              not work.)

              This marker is absolutely positioned, so it never moves, and it is
              exactly `h-svh` — the stage's own height. It takes no space in
              flow, paints nothing, and is the stable thing to measure. */}
          <div
            aria-hidden
            data-band="dark"
            className="pointer-events-none absolute inset-x-0 top-0 h-svh"
          />

          <Hero demoSlug={demoSlug} />
          <HeroShowcase />

          {/* Everything after the hero travels as one opaque stack that rises
              over it — see the note in `hero.tsx` for the sticky half of this.
              Two classes here are load-bearing:

              `z-10` puts the stack above the pinned hero. Without it the hero,
              which comes first in the DOM, would still paint below — but so
              would every `-z-10` decoration *inside* these sections, and the
              hero would show through the holes.

              `bg-background` is the opaque floor. Several bands below are
              translucent tints over the page colour (`bg-secondary/35`,
              `bg-secondary/25`), and with a film pinned behind them they would
              composite against the footage rather than against the page —
              which looks exactly like a rendering bug. */}
          <div className="relative z-10 bg-background">
            <TrustMarquee />
            {/* One dark chapter. This was two — a sentence claiming the day runs
                itself, then a timeline running it — which was the same six beats
                told twice in a row. The sentence is now *distributed along* the
                timeline: each beat's headline is one clause of it, so reading
                the large type top to bottom reads the whole claim exactly once. */}
            <DayChapter />
            <Stats />
            {/* The page's turn from telling to showing. Everything above argues;
                this hands the product over and lets the visitor work it. It sits
                before Features on purpose — a visitor who has just prescribed
                something reads a feature list very differently from one who
                hasn't. */}
            <TryIt />
            <Features />
            <HowItWorks />
            <Pricing />
            <Faq />
            <CtaBand />
          </div>
        </main>

        <SiteFooter />
      </div>
    </LandingMotionProvider>
  )
}

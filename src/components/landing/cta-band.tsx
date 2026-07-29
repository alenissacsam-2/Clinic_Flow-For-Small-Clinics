import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Magnetic, Reveal, ScrollSkew, SplitReveal } from "./motion-primitives"
import { PointerGlow } from "./pointer-glow"

/**
 * The closing band — the page's last dark surface, bookending the manifesto
 * so the composition ends where its argument turned.
 *
 * `nm-dark-surface` and `data-band="dark"` are both required, and both are
 * explained in `manifesto.tsx` — the short version is that the second inverts
 * the glass nav's tint while it crosses this band. `btn-shine-bar-ink`
 * rather than `btn-shine-bar`: the button here is the pale sidebar-primary, and
 * a light sheen sweeping across a light button is invisible.
 *
 * The button is the one place on the page that reaches back toward the pointer.
 * `Magnetic` is used exactly twice — here and on the pricing CTA — because the
 * effect only reads as intent if nothing else on the page is doing it.
 *
 * ⚠️ The link text "Create your clinic" is asserted by the e2e suite
 * (`tests/e2e/public.spec.ts` — `getByRole("link", { name: /create your clinic/i })`).
 * Reword it and the suite fails.
 */
export function CtaBand() {
  return (
    <section
      data-band="dark"
      className="nm-dark-surface bg-grain relative isolate overflow-hidden bg-sidebar text-sidebar-foreground"
    >
      <PointerGlow size={680} />
      <div
        aria-hidden
        className="glow-primary animate-glow-drift pointer-events-none absolute -top-32 left-1/2 -z-10 size-[40rem] -translate-x-1/2 rounded-full blur-3xl"
      />

      <Reveal className="relative mx-auto max-w-3xl px-4 py-28 text-center sm:py-36">
        <ScrollSkew max={4.5}>
          <h2 className="font-heading text-4xl font-extrabold tracking-[-0.04em] text-balance sm:text-6xl">
            <SplitReveal text="Ready to ditch the paper register?" />
          </h2>
        </ScrollSkew>
        <p className="mx-auto mt-6 max-w-lg text-lg text-sidebar-foreground/70">
          Set up your clinic in a couple of minutes. Your first two weeks are on us, and your
          records leave with you if you go.
        </p>
        <div className="mt-10">
          <Magnetic strength={16}>
            <Link
              href="/signup"
              className={cn(
                buttonVariants({ size: "lg" }),
                "btn-shine group/cta gap-2 rounded-full bg-sidebar-primary px-8 text-sidebar-primary-foreground hover:bg-sidebar-primary/90",
              )}
            >
              <span aria-hidden className="btn-shine-bar-ink" />
              Create your clinic
              <ArrowRight className="size-4 transition-transform duration-300 group-hover/cta:translate-x-1" />
            </Link>
          </Magnetic>
        </div>
      </Reveal>
    </section>
  )
}

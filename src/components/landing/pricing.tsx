import Link from "next/link"
import { Check } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Magnetic, Reveal, ScrollSkew, SplitReveal } from "./motion-primitives"
import { PointerGlow } from "./pointer-glow"
import { PricingSlider } from "./pricing-slider"

/**
 * Pricing.
 *
 * ⚠️ THE NUMBER BELOW IS A PLACEHOLDER AND MUST BE CONFIRMED BEFORE LAUNCH.
 * It is a plausible position for the Indian solo-doctor market (the incumbent
 * clinic suites this competes with sit at ₹2,000+/month), but it is not a
 * business decision anyone has actually made. Set `PRICE` and delete this
 * warning — do not ship a guessed price. Note that it now feeds
 * `PricingSlider`'s arithmetic as well as the headline figure.
 *
 * The deliberate choices here that are NOT placeholders:
 *  - One plan, not three. This product's whole strategy is being excellent for
 *    solo doctors rather than scaling to hospitals, so a tier ladder would
 *    advertise a ceiling it has no intention of building toward.
 *  - The price is stated, not gated behind "contact us". Solo practitioners are
 *    price-sensitive and self-serve; hiding the number loses them at the door.
 *
 * ── Why this band is dark ────────────────────────────────────────────────
 * The page's pace comes from alternating bone and indigo. Everything from the
 * stats down had drifted into one continuous bone run — six sections deep by
 * the time you reached the price, which is the worst possible place for a
 * visitor's attention to have flattened out. Putting the money on the dark
 * surface makes it the second thing on the page that gets its own room, after
 * the manifesto, and hands the closing CTA a light section to push off.
 *
 * `nm-dark-surface` and `data-band="dark"` are both required and both explained
 * in `manifesto.tsx`.
 */
const PRICE = 499
const CURRENCY = "₹"

const INCLUDED = [
  "Unlimited patients, visits and prescriptions",
  "Your public booking page + waiting-room display",
  "WhatsApp confirmations, reminders and receipts",
  "Pharmacy stock, billing, UPI payments and reports",
  "Drug allergy & interaction checking",
  "One receptionist account included",
  "ABHA / FHIR export — your data leaves whenever you want",
]

export function Pricing() {
  return (
    <section
      id="pricing"
      data-band="dark"
      className="nm-dark-surface bg-grain relative isolate scroll-mt-24 overflow-hidden bg-sidebar text-sidebar-foreground"
    >
      <PointerGlow size={620} />

      <div className="relative mx-auto max-w-5xl px-4 py-24 sm:py-32">
        <Reveal className="text-center">
          <p className="font-mono text-xs tracking-[0.22em] text-sidebar-primary">PRICING</p>
          <ScrollSkew>
            <h2 className="mx-auto mt-4 max-w-2xl font-heading text-4xl font-extrabold tracking-[-0.04em] text-balance sm:text-5xl">
              <SplitReveal text="One plan. No per-patient billing." />
            </h2>
          </ScrollSkew>
          <p className="mx-auto mt-4 max-w-xl text-lg text-sidebar-foreground/70">
            Everything is included from day one. No feature tiers, no seat maths, and nothing that
            gets more expensive the busier your clinic gets.
          </p>
        </Reveal>

        <Reveal delay={0.1} className="mt-14">
          <div className="grid gap-6 lg:grid-cols-[1fr_1.05fr] lg:gap-8">
            {/* Left: the number and the commitment. */}
            <div className="relative overflow-hidden rounded-3xl border border-white/12 bg-white/[0.06] p-8 sm:p-10">
              <span
                aria-hidden
                className="glow-primary pointer-events-none absolute -top-24 -right-20 size-72 rounded-full blur-3xl"
              />
              <div className="relative">
                <p className="text-xs font-semibold tracking-[0.1em] text-sidebar-foreground/55 uppercase">
                  Full practice
                </p>
                <p className="mt-3 flex items-baseline gap-1.5">
                  <span className="font-heading text-6xl font-extrabold tracking-[-0.045em] tabular-nums">
                    {CURRENCY}
                    {PRICE.toLocaleString("en-IN")}
                  </span>
                  <span className="text-sidebar-foreground/60">/ month</span>
                </p>
                <p className="mt-2 text-sm text-sidebar-foreground/60">
                  Billed monthly. Cancel any time — your records export in one click.
                </p>

                <div className="mt-8">
                  <Magnetic>
                    <Link
                      href="/signup"
                      className={cn(
                        buttonVariants({ size: "lg" }),
                        "btn-shine rounded-full bg-sidebar-primary px-8 text-sidebar-primary-foreground hover:bg-sidebar-primary/90",
                      )}
                    >
                      <span aria-hidden className="btn-shine-bar-ink" />
                      Start your 14-day trial
                    </Link>
                  </Magnetic>
                </div>
                <p className="mt-3 text-xs font-medium text-sidebar-foreground/55">
                  No card required to start
                </p>

                <ul className="mt-8 grid gap-2.5 border-t border-white/10 pt-8">
                  {INCLUDED.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm">
                      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-success/20 text-success">
                        <Check className="size-3" strokeWidth={3} />
                      </span>
                      <span className="text-sidebar-foreground/75">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Right: the same number, in the visitor's own units. */}
            <div className="flex flex-col gap-4">
              <PricingSlider price={PRICE} />
              <p className="px-2 text-sm leading-relaxed text-sidebar-foreground/60">
                A single missed appointment usually costs more than a month of this. That is the
                whole pitch, and you can check it with the slider rather than take it from us.
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

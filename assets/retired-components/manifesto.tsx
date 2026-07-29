import { ScrubText } from "./scrub-text"

/**
 * The dark band in the middle of the page.
 *
 * Two jobs. Visually it breaks a long run of bone surfaces — the page reads as
 * light / dark / light / dark rather than one continuous scroll, which is most
 * of where the reference site's sense of pace comes from. Editorially it is the
 * one place the product is described as a sequence of events rather than a list
 * of features, which is what the word-by-word reveal is for: you read it at the
 * speed the clinic day actually happens.
 *
 * `nm-dark-surface` is mandatory here, not decorative. Every neumorphic shadow
 * in this codebase is lit from the top-left by `--nm-hi`, which in the light
 * theme is 95% white. Drop a dark surface into the light theme without
 * re-declaring those variables and every raised element on it paints a near-
 * white highlight onto near-black.
 *
 * `data-band="dark"` is not decorative either: `site-header.tsx` measures every
 * element carrying it and inverts the glass nav's tint while crossing one.
 */
export function Manifesto() {
  return (
    <section
      data-band="dark"
      className="nm-dark-surface bg-grain relative isolate overflow-hidden bg-sidebar text-sidebar-foreground"
    >
      <div
        aria-hidden
        className="glow-primary pointer-events-none absolute -top-40 left-1/4 size-[36rem] rounded-full opacity-50 blur-3xl"
      />

      <div className="relative mx-auto max-w-4xl px-4 py-28 sm:py-36">
        <p className="mb-8 text-center text-xs font-semibold tracking-[0.18em] text-sidebar-foreground/45 uppercase">
          A day, handled
        </p>

        <ScrubText className="text-center font-heading text-2xl leading-[1.35] font-semibold tracking-[-0.02em] sm:text-3xl sm:leading-[1.35] lg:text-[2.6rem] lg:leading-[1.3]">
          A patient books at midnight. ClinicFlow confirms it on WhatsApp, reminds them two hours
          before, sends the prescription the moment you sign it, and the receipt when they pay. You
          just see patients.
        </ScrubText>
      </div>
    </section>
  )
}

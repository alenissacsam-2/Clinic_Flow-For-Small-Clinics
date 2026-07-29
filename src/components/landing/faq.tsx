import { Plus } from "lucide-react"

import { Reveal, ScrollSkew, SplitReveal } from "./motion-primitives"
import { PointerGlow } from "./pointer-glow"

/**
 * Objection handling.
 *
 * Built on native `<details>`/`<summary>`: it is keyboard accessible, exposed
 * correctly to screen readers, and open-able before a single byte of JS has
 * run — which matters because this is the section a sceptical visitor reaches
 * for on a slow connection. An accordion library here would be strictly worse.
 *
 * Every answer below is checkable against what the product actually does. The
 * temptation on a landing page is to answer the question the visitor wishes
 * were true; for a clinical product that is how you acquire a doctor who
 * churns in week two and tells fifty colleagues.
 */
const FAQ: { q: string; a: React.ReactNode }[] = [
  {
    q: "Do my patients need to install anything?",
    a: (
      <>
        No. They tap your booking link, pick a slot, and everything after that — confirmation,
        reminders, prescription, receipt — arrives on WhatsApp, which they already have. There is
        no patient app and no account for them to create.
      </>
    ),
  },
  {
    q: "What happens if the internet drops in the middle of a consultation?",
    a: (
      <>
        You keep working. A visit written offline is held on your device and syncs when the
        connection returns, sending the WhatsApp message then. This is deliberate: clinic
        broadband in India is not reliable, and a practice manager that stops working when the
        line does is worse than paper.
      </>
    ),
  },
  {
    q: "Is my patients' data safe, and does this meet the DPDP Act?",
    a: (
      <>
        Each clinic&apos;s data is isolated at the database level, not merely filtered in the app.
        Consent is captured and recorded, and every patient can be exported or deleted on request
        — the two rights the DPDP Act 2023 turns on. Attachments live in a private store behind
        short-lived signed links, never public URLs.
      </>
    ),
  },
  {
    q: "Can I get my records out if I leave?",
    a: (
      <>
        Yes, and without asking us. Patients export as CSV, and any patient&apos;s full record
        exports as an ABDM-shaped FHIR R4 bundle — the same standard Indian health systems
        exchange records with. Lock-in through data hostage-taking is not a business model we
        want.
      </>
    ),
  },
  {
    q: "Does a prescription from this count as a real prescription?",
    a: (
      <>
        It carries your name, qualifications and registration number, and follows the Telemedicine
        Practice Guidelines 2020 for the format. As with any prescription, it is valid because a
        registered practitioner issued it — the software&apos;s job is to record it correctly and
        hand the patient a clean PDF.
      </>
    ),
  },
  {
    q: "Does it check for drug allergies and interactions?",
    a: (
      <>
        It screens your draft against the patient&apos;s recorded allergies and a curated
        interaction list, matching on active ingredients — so prescribing a brand name still trips
        a penicillin allergy. It is <strong>advisory and never blocks you</strong>, and it says
        plainly when a medicine could not be checked rather than implying it was cleared. It is
        not a licensed drug-safety database and does not replace your judgement.
      </>
    ),
  },
  {
    q: "Can my receptionist use it without seeing everything?",
    a: (
      <>
        Yes. Staff run the front desk — queue, bookings, billing — while settings, clinical notes
        and prescriptions stay with you. One receptionist account is included.
      </>
    ),
  },
  {
    q: "Do I need my own WhatsApp Business API account?",
    a: (
      <>
        Messaging goes through the official Meta WhatsApp Cloud API, not an unofficial workaround
        that can get your number banned. We walk you through connecting it during setup; until
        it&apos;s connected the app runs normally and simply doesn&apos;t send.
      </>
    ),
  },
]

export function Faq() {
  return (
    // `isolate` is required by `PointerGlow`, which sits at `-z-10`: a negative
    // z-index only stays inside an element that establishes a stacking context.
    <section
      id="faq"
      className="relative isolate scroll-mt-24 overflow-hidden border-t border-edge/15 bg-secondary/25"
    >
      <PointerGlow size={540} tone="clay" />

      <div className="relative mx-auto max-w-3xl px-4 py-24">
        <Reveal className="text-center">
          <p className="font-mono text-xs tracking-[0.22em] text-primary">STILL WONDERING</p>
          <ScrollSkew>
            <h2 className="mt-4 font-heading text-3xl font-extrabold tracking-[-0.035em] text-balance sm:text-4xl">
              <SplitReveal text="Questions doctors actually ask" />
            </h2>
          </ScrollSkew>
        </Reveal>

        <Reveal delay={0.08} className="mt-12 space-y-3">
          {FAQ.map(({ q, a }, i) => (
            <details
              key={q}
              // `data-faq` is the hook for the open/close height animation in
              // globals.css, which runs on the browser's own
              // `::details-content` — no JS, and no wrapper div measuring
              // heights. `group` + `open:` do the rest of the restyling.
              data-faq
              className="group rounded-2xl border border-edge/20 bg-card px-5 shadow-nm-raised transition-shadow duration-300 hover:shadow-nm-float open:shadow-nm-float"
            >
              <summary className="flex cursor-pointer list-none items-center gap-4 py-5 text-left font-heading text-base font-bold tracking-[-0.02em] [&::-webkit-details-marker]:hidden">
                <span
                  aria-hidden
                  className="shrink-0 font-mono text-xs tabular-nums text-primary/50 transition-colors duration-300 group-open:text-primary"
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="flex-1">{q}</span>
                {/* A plus that becomes a minus: one glyph, rotated. Reads as
                    open/close more immediately than a chevron flipping, and
                    costs one transform. */}
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-background/70 text-primary shadow-nm-inset transition-transform duration-300 group-open:rotate-[135deg]">
                  <Plus className="size-4" />
                </span>
              </summary>
              <p className="pb-5 pl-9 text-sm leading-relaxed text-muted-foreground">{a}</p>
            </details>
          ))}
        </Reveal>
      </div>
    </section>
  )
}

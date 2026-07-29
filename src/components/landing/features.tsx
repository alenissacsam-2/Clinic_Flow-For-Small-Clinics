import {
  ArrowRight,
  CalendarCheck,
  Check,
  FileText,
  Globe,
  Link2,
  MessageCircle,
  QrCode,
  Receipt,
  ShieldCheck,
  Users,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { FeatureCard } from "./feature-card"
import { Reveal, ScrollSkew, SplitReveal, Stagger, StaggerItem } from "./motion-primitives"
import { PointerGlow } from "./pointer-glow"
import { WaThread } from "./wa-thread"

/* ── Why every card carries a picture of itself ────────────────────────────
   This grid was five cards of icon + title + paragraph, in five identical
   boxes. Each one was accurate and none of them showed anything: an icon is a
   label for a feature, not evidence of it, and five labels in a row is a
   specification sheet. The section reads as filler in a page that elsewhere
   hands the visitor a working prescription pad.

   So each card now ends in a small, real slice of the product — the actual
   token row, the actual dosage line, the actual UPI amount. They are
   deliberately *small* and quiet: the WhatsApp card is still the focal one and
   these must not compete with it. The rule they follow is the same one the hero
   fragments follow — no invented UI. Everything below is a surface that exists.

   They go in `FeatureCard`'s existing `footer` slot rather than through a new
   prop, because that component is also the design-system page's example and its
   API is not this section's to change. */
const SECONDARY = [
  {
    icon: CalendarCheck,
    title: "Online booking & queue",
    body: "Share one link. Patients pick a slot and get a token number. Walk-ins and no-shows are one tap.",
    visual: <QueueMini />,
  },
  {
    icon: FileText,
    title: "Prescriptions in seconds",
    body: "Medicine autocomplete, dosage chips, and a branded PDF with your registration number.",
    visual: <RxMini />,
  },
  {
    icon: Receipt,
    title: "Billing & UPI payments",
    body: "Auto-drafted invoices, your own UPI QR for instant payment, and receipts on WhatsApp.",
    visual: <PayMini />,
  },
  {
    icon: Users,
    title: "Add your receptionist",
    body: "Invite staff to run the front desk. They manage the queue and billing; only you touch settings.",
    visual: <StaffMini />,
  },
  {
    icon: ShieldCheck,
    title: "Private & compliant",
    body: "Per-clinic isolation, consent tracking, and patient export/delete — built for the DPDP Act.",
    visual: <PrivacyMini />,
  },
]

/**
 * Shared frame for the five card footers.
 *
 * One inset panel, so the visuals read as a recessed window into the product
 * rather than as more content stacked on the card — the same figure/ground
 * separation `shadow-nm-inset` does for the icon chips above them. Sharing it
 * also means the five stay the same height and the grid rows stay level.
 */
function Mini({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-edge/15 bg-background/60 px-3 py-2.5 shadow-nm-inset">
      {children}
    </div>
  )
}

function QueueMini() {
  return (
    <Mini>
      <div className="flex items-center gap-1.5">
        {[3, 4, 5].map((n) => (
          <span
            key={n}
            className={cn(
              "rounded-md px-1.5 py-1 font-heading text-[0.65rem] font-bold tabular-nums",
              n === 4
                ? "bg-primary text-primary-foreground"
                : "bg-edge/15 text-muted-foreground",
            )}
          >
            #{n}
          </span>
        ))}
        <span className="ml-auto flex items-center gap-1.5 text-[0.6rem] text-muted-foreground">
          <span className="animate-live-dot size-1.5 rounded-full bg-success" />
          now serving
        </span>
      </div>
    </Mini>
  )
}

function RxMini() {
  return (
    <Mini>
      <div className="space-y-1.5">
        {[
          ["Paracetamol 650", "1-0-1"],
          ["Cetirizine 10", "0-0-1"],
        ].map(([drug, dose]) => (
          <p key={drug} className="flex items-center justify-between gap-2 text-[0.65rem]">
            <span className="truncate text-card-foreground">{drug}</span>
            <span className="shrink-0 font-mono text-muted-foreground">{dose}</span>
          </p>
        ))}
      </div>
    </Mini>
  )
}

function PayMini() {
  return (
    <Mini>
      <div className="flex items-center gap-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <QrCode className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-heading text-sm font-bold tabular-nums">₹450</span>
          <span className="block text-[0.6rem] text-muted-foreground">Your own UPI QR</span>
        </span>
        <span className="shrink-0 rounded-full bg-success/12 px-2 py-0.5 text-[0.6rem] font-medium text-success">
          Paid
        </span>
      </div>
    </Mini>
  )
}

function StaffMini() {
  return (
    <Mini>
      <div className="flex items-center gap-2">
        {[
          ["DS", "You", "bg-primary text-primary-foreground"],
          ["RK", "Front desk", "bg-accent text-accent-foreground"],
        ].map(([initials, role, tone]) => (
          <span key={role} className="flex items-center gap-1.5">
            <span
              className={cn(
                "flex size-6 items-center justify-center rounded-full text-[0.55rem] font-bold",
                tone,
              )}
            >
              {initials}
            </span>
            <span className="text-[0.6rem] text-muted-foreground">{role}</span>
          </span>
        ))}
        <span className="ml-auto text-[0.6rem] text-muted-foreground">+ invite</span>
      </div>
    </Mini>
  )
}

function PrivacyMini() {
  return (
    <Mini>
      <div className="grid gap-1">
        {["Per-clinic isolation", "Consent recorded", "Export & delete"].map((row) => (
          <p key={row} className="flex items-center gap-1.5 text-[0.62rem] text-muted-foreground">
            <Check className="size-3 shrink-0 text-success" strokeWidth={3} />
            {row}
          </p>
        ))}
      </div>
    </Mini>
  )
}

export function Features() {
  return (
    // `isolate` is required, not tidiness: `PointerGlow` sits at `-z-10`, and a
    // negative z-index only stays *inside* an element that establishes a
    // stacking context. Without it the glow escapes upward and paints behind
    // this section's own background, which is to say nowhere.
    <section
      id="features"
      className="relative isolate scroll-mt-24 overflow-hidden border-t border-edge/15 bg-secondary/35"
    >
      <PointerGlow tone="clay" size={560} />
      {/* Faint drafting grid, faded out at the edges so it never meets a border
          as a hard line. Gives the pointer glow something to travel across —
          light needs a surface with texture to read as light at all. */}
      <div
        aria-hidden
        className="bg-ruled pointer-events-none absolute inset-0 -z-10 opacity-60 [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]"
      />
      <div
        aria-hidden
        className="glow-clay animate-glow-drift pointer-events-none absolute -top-32 right-0 -z-10 size-[30rem] rounded-full blur-3xl"
      />
      <div className="relative mx-auto max-w-6xl px-4 py-24 sm:py-32">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="font-mono text-xs tracking-[0.22em] text-primary">THE TOOLKIT</p>
          <ScrollSkew>
            <h2 className="mt-4 font-heading text-4xl font-extrabold tracking-[-0.04em] text-balance sm:text-5xl">
              <SplitReveal text="Everything a solo practice needs" />
            </h2>
          </ScrollSkew>
          <p className="mt-4 text-lg text-muted-foreground">
            Not a bloated hospital system. Just the tools you use every day, made fast.
          </p>
        </Reveal>

        {/* Weighted bento: the WhatsApp automation is the focal card. It keeps
            the bespoke layout (it holds the chat thread), so it carries the
            depth by hand rather than going through FeatureCard. */}
        <Stagger stagger={0.07} className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <StaggerItem className="sm:col-span-2 lg:row-span-2">
            <div className="flex h-full flex-col justify-between rounded-2xl border border-edge/25 bg-card p-6 shadow-nm-raised transition-shadow duration-300 hover:shadow-nm-float">
              <div>
                <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-nm-raised">
                  <MessageCircle className="size-5" />
                </div>
                <h3 className="font-heading text-xl font-bold tracking-[-0.03em]">
                  Automatic WhatsApp, end to end
                </h3>
                <p className="mt-2 max-w-md text-muted-foreground">
                  Confirmations, 24-hour and 2-hour reminders, prescriptions, receipts and follow-up
                  nudges go out on their own. No more reminder phone calls — and far fewer no-shows.
                </p>

                {/* The triggers, not the messages.
                    This card spans two grid rows and its copy did not, so it
                    carried ~180px of hollow between the paragraph and the thread
                    — in the section's focal card, which is the worst place on
                    the page for a void.
                    What fills it is deliberately the one thing the thread below
                    cannot show. The thread shows *what the patient receives*; a
                    list of the same four messages would have been the section's
                    own duplication bug in miniature. This shows what sets each
                    one off, which is the actual claim in the heading — "end to
                    end" means nobody pressed send. */}
                <dl className="mt-6 grid gap-1.5 border-t border-edge/15 pt-5">
                  {[
                    ["A patient books", "Confirmation"],
                    ["Two hours before", "Reminder"],
                    ["You sign the visit", "Prescription PDF"],
                    ["Payment lands", "Receipt"],
                  ].map(([when, what]) => (
                    <div key={when} className="flex items-center gap-2 text-xs">
                      <dt className="w-32 shrink-0 text-muted-foreground">{when}</dt>
                      <ArrowRight className="size-3 shrink-0 text-primary/45" />
                      <dd className="font-medium text-card-foreground">{what}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <WaThread />
            </div>
          </StaggerItem>

          {SECONDARY.map(({ icon: Icon, title, body, visual }) => (
            <StaggerItem key={title} className="h-full">
              {/* FeatureCard is a Client Component, so `icon` and `footer` must
                  be rendered elements — passing the component itself throws
                  "Functions cannot be passed directly to Client Components". */}
              <FeatureCard
                icon={<Icon />}
                title={title}
                description={body}
                footer={visual}
                className="h-full"
              />
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  )
}

/* ── How it works ─────────────────────────────────────────────────────────
   Getting started, and *only* getting started.

   ── Why the pinned panels are gone ────────────────────────────────────────
   This was three `StackPanels` — each step pinned for a full viewport while the
   next slid up over it. Measured, the section ran **2,921px: 3.2 viewports and
   23% of the whole page**, to deliver three sentences. Its own code comment
   admitted the consequence and patched it rather than fixing it: "its content
   only filled about half of it, and the void read as an unfinished page. A
   ghosted numeral is the cheapest honest way to occupy that space."

   A void you have to fill with decoration is the section telling you it is too
   big. The steps are now compact rows that alternate side, which gives the
   sequence rhythm without spending a screen per sentence — and the section
   costs roughly a third of what it did.

   The other reason to shrink it is the page as a whole. By this point a visitor
   has already been through scrubbed text, a scroll-driven timeline, extruded
   numerals, a live WhatsApp thread, a working prescription demo and a pinned
   film. Another full-viewport scroll device was the last thing the page needed.
   The restraint *is* the design decision here.

   ── Why step 03 changed ───────────────────────────────────────────────────
   It used to read "See patients — bookings confirm themselves and the queue
   orders itself. You open the visit, prescribe, and the PDF is on its way
   before the patient reaches the door." That is `day-chapter.tsx`, in different
   words: the same six beats a visitor scrolled through four sections earlier.
   The same duplication that section was rebuilt to remove had simply moved here.

   The division is now clean. **DayChapter owns the day; this owns the
   onboarding.** So the last step is not the clinic running — it is the moment
   the link goes live and the first booking lands, which is the last thing that
   happens before the day takes over, and the thing a visitor deciding whether
   to sign up actually wants to know. */

const STEPS = [
  {
    n: "01",
    title: "Set up your clinic",
    body: "Add your details, hours and fee. Your booking link exists before you finish the form — no approval queue, no sales call.",
    /** What this step *removes*. Stated as a loss, because that is the sale. */
    gone: "No demo call. No onboarding fee. No waiting for anyone to approve you.",
    visual: <SetupVisual />,
  },
  {
    n: "02",
    title: "Share your link",
    body: "Put it in your WhatsApp Business profile, on Google, or on a QR poster at the front desk. Patients book without installing anything.",
    gone: "No app for patients to download. No account for them to create.",
    visual: <ShareVisual />,
  },
  {
    n: "03",
    title: "Take your first booking",
    body: "That is the whole setup. The next patient who taps the link picks a slot, gets a token, and is confirmed on WhatsApp — with nothing left for you to switch on.",
    gone: "Nothing to install, nothing to migrate, and nobody to train.",
    visual: <FirstBookingVisual />,
  },
]

export function HowItWorks() {
  return (
    <section className="relative isolate overflow-hidden border-t border-edge/15 bg-background">
      <PointerGlow size={520} />

      <Reveal className="relative mx-auto max-w-5xl px-4 pt-24 text-center sm:pt-32">
        <p className="font-mono text-xs tracking-[0.22em] text-primary">GETTING STARTED</p>
        <ScrollSkew>
          <h2 className="mt-4 font-heading text-4xl font-extrabold tracking-[-0.04em] text-balance sm:text-5xl">
            <SplitReveal text="Three steps, then it is your day" />
          </h2>
        </ScrollSkew>
        <p className="mt-4 text-lg text-muted-foreground">
          None of them involve a paper register, and none of them involve us.
        </p>
      </Reveal>

      <div className="mx-auto max-w-6xl space-y-20 px-4 pt-16 pb-24 sm:space-y-28 sm:pt-20 sm:pb-32">
        {STEPS.map((s, i) => (
          <Reveal key={s.n}>
            {/* Alternating sides. With the pinning gone the sequence needed some
                other reason for the eye to keep moving, and swapping the visual
                left/right does it with no new mechanism — the reader's attention
                crosses the page once per step instead of running down a column.
                `lg:` only: below that everything stacks in source order, so the
                text still leads each step on a phone. */}
            <div
              className={cn(
                "relative grid items-center gap-8 lg:grid-cols-2 lg:gap-16",
                i % 2 === 1 && "lg:[&>*:first-child]:order-2",
              )}
            >
              <div className="relative">
                {/* The ghosted numeral survives the rewrite, but at a tenth of
                    its old size. It was doing a job it should never have had —
                    filling a viewport-sized hole. At row scale it is what it
                    always should have been: a quiet index mark. */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute -top-10 -left-4 font-heading text-[7rem] leading-none font-extrabold tracking-[-0.06em] text-foreground/[0.05] select-none sm:-top-14 sm:text-[10rem]"
                >
                  {s.n}
                </span>

                <span className="relative font-heading text-sm font-bold tracking-[0.2em] text-primary">
                  {s.n}
                </span>
                <h3 className="relative mt-2 font-heading text-3xl font-extrabold tracking-[-0.04em] text-balance sm:mt-3 sm:text-4xl">
                  {s.title}
                </h3>
                <p className="relative mt-3 max-w-md leading-relaxed text-muted-foreground sm:mt-4 sm:text-lg">
                  {s.body}
                </p>
                <p className="relative mt-5 flex max-w-md items-start gap-2.5 border-l-2 border-primary/30 pl-4 text-sm leading-relaxed text-foreground/70">
                  <span className="font-semibold text-primary">Gone:</span>
                  <span>{s.gone}</span>
                </p>
              </div>

              <div className="mx-auto w-full max-w-sm lg:max-w-none">{s.visual}</div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  )
}

/* The step visuals. Small, honest slices of the real product — the same
   discipline as the hero fragments: no invented dashboards. */

function SetupVisual() {
  return (
    <div className="rounded-3xl border border-edge/20 bg-card p-4 text-card-foreground shadow-nm-float sm:p-6">
      <div className="flex items-center justify-between">
        <p className="font-heading text-sm font-bold">Your clinic</p>
        <span className="rounded-full bg-success/12 px-2.5 py-1 text-[0.65rem] font-medium text-success">
          Saved
        </span>
      </div>
      <div className="mt-4 space-y-2.5">
        {[
          ["Clinic name", "Sunrise Clinic"],
          ["Consultation fee", "₹450"],
          ["Slot length", "15 min"],
          ["Hours", "Mon–Sat · 10:00–19:00"],
          ["Registration no.", "KMC 84213"],
        ].map(([label, value]) => (
          <div
            key={label}
            className="flex items-center justify-between rounded-lg border border-edge/15 bg-background/70 px-3 py-1.5 shadow-nm-inset sm:py-2.5"
          >
            <span className="text-xs text-muted-foreground">{label}</span>
            <span className="text-xs font-semibold">{value}</span>
          </div>
        ))}
      </div>
      <div className="mt-5 flex items-center gap-2.5 rounded-xl bg-success/10 px-3.5 py-3">
        <Check className="size-4 shrink-0 text-success" strokeWidth={3} />
        <p className="text-xs leading-relaxed text-success">
          Your booking page is live. Nobody had to approve it.
        </p>
      </div>
    </div>
  )
}

function ShareVisual() {
  return (
    <div className="rounded-3xl border border-edge/20 bg-card p-4 text-card-foreground shadow-nm-float sm:p-6">
      <div className="flex items-center gap-2 rounded-full border border-edge/20 bg-background/70 px-4 py-3 shadow-nm-inset">
        <Link2 className="size-4 shrink-0 text-primary" />
        <span className="truncate font-mono text-xs">clinicflow.app/book/sunrise-clinic</span>
      </div>
      <div className="mt-5 flex items-center gap-4">
        <div className="flex size-20 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-nm-raised sm:size-24">
          <QrCode className="size-10 sm:size-12" />
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Print it, or send it. One link is your entire front desk.
        </p>
      </div>
      {/* The three places the link actually goes. Naming them is what turns
          "share your link" from an instruction into a plan. */}
      <div className="mt-5 grid gap-2 border-t border-edge/15 pt-5">
        {[
          [<MessageCircle key="w" className="size-3.5" />, "WhatsApp Business profile"],
          [<Globe key="g" className="size-3.5" />, "Your Google Business listing"],
          [<QrCode key="q" className="size-3.5" />, "A printed QR at the front desk"],
        ].map(([icon, label]) => (
          <p key={String(label)} className="flex items-center gap-2.5 text-xs text-muted-foreground">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-background/70 text-primary shadow-nm-inset">
              {icon}
            </span>
            {label}
          </p>
        ))}
      </div>
    </div>
  )
}

/**
 * Step 03's visual: the first booking landing, not a consultation.
 *
 * This used to be `ConsultVisual` — a prescription being written, with an
 * allergy check and a signed PDF going out. That was the right picture for the
 * step's old copy ("See patients") and the wrong one the moment the step became
 * about going live, because a consultation is the *day*, and the day belongs to
 * `day-chapter.tsx`. Leaving it in would have put the section straight back into
 * the duplication this rewrite existed to remove — and worse, left a visual
 * arguing against its own heading.
 *
 * What it shows instead is the only thing that actually happens at the end of
 * setup: a stranger uses the link, and the software does the rest without being
 * asked. Every element is a real product surface — slot, token, WhatsApp
 * confirmation — for the same reason as the hero fragments: no invented UI.
 */
function FirstBookingVisual() {
  return (
    <div className="rounded-3xl border border-edge/20 bg-card p-4 text-card-foreground shadow-nm-float sm:p-6">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
          <CalendarCheck className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-heading text-sm font-bold">New booking</p>
          <p className="text-xs text-muted-foreground">From your link · no account created</p>
        </div>
        <span className="shrink-0 rounded-full bg-success/12 px-2.5 py-1 text-[0.65rem] font-medium text-success">
          Token #1
        </span>
      </div>
      <div className="mt-4 space-y-2.5">
        {[
          ["Patient", "Riya Nair"],
          ["Slot", "Tomorrow · 11:30"],
          ["Booked at", "00:12"],
        ].map(([label, value]) => (
          <div
            key={label}
            className="flex items-center justify-between rounded-lg border border-edge/15 bg-background/70 px-3 py-1.5 shadow-nm-inset sm:py-2.5"
          >
            <span className="text-xs text-muted-foreground">{label}</span>
            <span className="text-xs font-semibold">{value}</span>
          </div>
        ))}
      </div>
      <div className="mt-5 flex items-center gap-2 rounded-full bg-success/12 px-3.5 py-2 text-xs font-medium text-success">
        <MessageCircle className="size-3.5" />
        Confirmed on WhatsApp — you did nothing
      </div>
    </div>
  )
}

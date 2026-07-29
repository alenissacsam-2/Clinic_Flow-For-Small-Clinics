import { notFound } from "next/navigation"
import Link from "next/link"
import { Activity, CalendarCheck, MessageCircle, ShieldCheck } from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FeatureCard } from "@/components/landing/feature-card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Aurora } from "@/components/landing/aurora"
import { LandingMotionProvider } from "@/components/landing/motion-primitives"
import { cn } from "@/lib/utils"

/**
 * Design-system reference for the "Indigo & Bone" language.
 *
 * Dev-only: it 404s in production. It exists so every token, depth state and
 * control can be checked side by side on one screen — including in dark mode
 * and at reduced motion, which are otherwise tedious to reach — rather than
 * being verified incidentally across thirty product routes.
 */
export const metadata = { title: "Design system" }

const SURFACES = [
  { name: "--background", cls: "bg-background" },
  { name: "--card", cls: "bg-card" },
  { name: "--muted", cls: "bg-muted" },
  { name: "--secondary", cls: "bg-secondary" },
  { name: "--accent", cls: "bg-accent" },
  { name: "--primary", cls: "bg-primary" },
  { name: "--success", cls: "bg-success" },
  { name: "--warning", cls: "bg-warning" },
  { name: "--info", cls: "bg-info" },
  { name: "--destructive", cls: "bg-destructive" },
  { name: "--sidebar", cls: "bg-sidebar" },
  { name: "--nm-edge", cls: "bg-edge" },
]

const DEPTHS = [
  { name: "shadow-nm-raised", cls: "shadow-nm-raised", note: "resting extrusion" },
  { name: "shadow-nm-float", cls: "shadow-nm-float", note: "hover lift" },
  { name: "shadow-nm-pressed", cls: "shadow-nm-pressed", note: "active push-in" },
  { name: "shadow-nm-inset", cls: "shadow-nm-inset", note: "resting well" },
]

const VARIANTS = ["default", "outline", "secondary", "ghost", "destructive", "link"] as const
const SIZES = ["xs", "sm", "default", "lg"] as const

function Section({
  title,
  children,
  hint,
}: {
  title: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <section className="mb-14">
      <h2 className="font-heading text-xl font-bold tracking-[-0.03em]">{title}</h2>
      {hint && <p className="mt-1 mb-5 max-w-2xl text-sm text-muted-foreground">{hint}</p>}
      <div className={hint ? "" : "mt-5"}>{children}</div>
    </section>
  )
}

export default function DesignSystemPage() {
  if (process.env.NODE_ENV === "production") notFound()

  return (
    <LandingMotionProvider>
      <div className="min-h-screen bg-background px-6 py-12">
        <div className="mx-auto max-w-5xl">
          <header className="mb-12">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-primary">
              ClinicFlow
            </p>
            <h1 className="mt-2 font-heading text-4xl font-extrabold tracking-[-0.04em]">
              Indigo &amp; Bone
            </h1>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              Neumorphic depth and glass on warm neutrals. Deep indigo, clay accent, and one
              lamp rig — shared by the CSS shadows and the Aurora background below.
            </p>
          </header>

          <Section
            title="Surfaces"
            hint="Mid-tone by design: neumorphism needs luminance headroom on both sides of a surface for the dual shadow to read, which is why nothing here is pure white or pure black."
          >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {SURFACES.map((s) => (
                <div key={s.name} className="space-y-1.5">
                  <div
                    className={cn("h-14 rounded-xl border border-edge/25 shadow-nm-raised", s.cls)}
                  />
                  <p className="font-mono text-[10px] text-muted-foreground">{s.name}</p>
                </div>
              ))}
            </div>
          </Section>

          <Section
            title="Depth"
            hint="Four states, all derived from the --nm-* shadow tokens, so they invert automatically in dark mode with no dark: override. Raised and float cast straight down; only the recessed pair is dual-lit — a white up-left highlight reads as a smudge on warm bone rather than as light."
          >
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
              {DEPTHS.map((d) => (
                <div key={d.name} className="text-center">
                  <div className={cn("grid h-24 place-items-center rounded-2xl bg-card", d.cls)}>
                    <span className="text-xs text-muted-foreground">{d.note}</span>
                  </div>
                  <p className="mt-2 font-mono text-[10px] text-muted-foreground">{d.name}</p>
                </div>
              ))}
            </div>
          </Section>

          <Section
            title="Tactile buttons"
            hint="Press one. The outer shadow inverts to an inner one and the label travels 1.5px down — that inversion is what makes it read as a key rather than a rectangle that changed colour."
          >
            <div className="space-y-4">
              {VARIANTS.map((v) => (
                <div key={v} className="flex flex-wrap items-center gap-3">
                  <span className="w-24 shrink-0 font-mono text-[11px] text-muted-foreground">
                    {v}
                  </span>
                  {SIZES.map((s) => (
                    <Button key={s} variant={v} size={s}>
                      {s === "default" ? "Save visit" : s}
                    </Button>
                  ))}
                </div>
              ))}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <span className="w-24 shrink-0 font-mono text-[11px] text-muted-foreground">
                  as Link
                </span>
                <Link href="/design" className={cn(buttonVariants({ size: "lg" }), "btn-shine")}>
                  <span aria-hidden className="btn-shine-bar" />
                  Start free — set up in 2 minutes
                </Link>
              </div>
            </div>
          </Section>

          <Section
            title="Recessed fields"
            hint="Where buttons extrude, inputs sink. The 1px border is not decoration — it is the WCAG 1.4.11 floor that pure Soft UI fails by construction."
          >
            <div className="grid max-w-xl gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="d-name">Patient name</Label>
                <Input id="d-name" placeholder="Ramesh Kumar" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="d-dose">Dose</Label>
                <Input id="d-dose" placeholder="650 mg" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="d-err">Invalid state</Label>
                <Input id="d-err" aria-invalid defaultValue="+91 99" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="d-dis">Disabled</Label>
                <Input id="d-dis" disabled defaultValue="Locked" />
              </div>
            </div>
          </Section>

          <Section
            title="Interactive feature cards"
            hint="Move the pointer across one: it tilts in 3D and a specular highlight tracks the cursor. All of it runs on motion values and CSS custom properties, so pointer movement never re-renders React."
          >
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <FeatureCard
                icon={<MessageCircle />}
                title="WhatsApp, not email"
                description="Confirmations, reminders, prescriptions and receipts go where your patients already are."
              />
              <FeatureCard
                icon={<CalendarCheck />}
                title="Bookings that fit"
                description="Patients pick a real slot from your real hours. The server validates it too, not just the browser."
              />
              <FeatureCard
                icon={<ShieldCheck />}
                title="DPDP-ready"
                description="Consent artefacts, per-patient export and audit trails, built in rather than bolted on."
              />
            </div>
          </Section>

          <Section
            title="Cards"
            hint="The standard product surface — used by all thirty routes, so it inherits the depth automatically."
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Today&apos;s queue</CardTitle>
                  <CardDescription>Four patients waiting</CardDescription>
                </CardHeader>
                <CardContent className="text-muted-foreground">
                  Card content sits on the raised plane. Rows inside it sink, which is the
                  system&apos;s core contrast.
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Revenue</CardTitle>
                  <CardDescription>This month</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="font-heading text-3xl font-bold tabular-nums tracking-[-0.03em]">
                    ₹1,24,500
                  </p>
                </CardContent>
              </Card>
            </div>
          </Section>

          <Section
            title="Aurora background"
            hint="Move the pointer across it: the colour fields lean at different depths and the grid is revealed only under the cursor. Four blurred divs and two gradients — no canvas, no shader, no dependency, and every value is a MotionValue so it never re-renders React."
          >
            <div className="relative grid h-[26rem] place-items-center overflow-hidden rounded-3xl border border-edge/25 bg-card shadow-nm-raised">
              <Aurora />
              <p className="relative font-heading text-sm text-muted-foreground">
                move your pointer
              </p>
            </div>
          </Section>

          <Section title="Status tones" hint="Driven entirely by src/lib/status.ts.">
            <div className="flex flex-wrap gap-2">
              {[
                ["bg-success/12 text-success", "Completed"],
                ["bg-warning/12 text-warning", "Pending"],
                ["bg-info/12 text-info", "Confirmed"],
                ["bg-destructive/12 text-destructive", "Unpaid"],
                ["bg-primary text-primary-foreground", "In consultation"],
              ].map(([cls, label]) => (
                <span key={label} className={cn("rounded-full px-3 py-1 text-xs font-semibold", cls)}>
                  {label}
                </span>
              ))}
            </div>
          </Section>

          <Section
            title="Dark mode"
            hint="Real, for the first time in this product. The highlight becomes a lifted grey rather than white; accents brighten and flip to dark foregrounds."
          >
            <div className="dark rounded-3xl bg-background p-8">
              <div className="grid gap-5 sm:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Dark surface</CardTitle>
                    <CardDescription>Same tokens, inverted lamp</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Input placeholder="Recessed in the dark" />
                    <div className="flex gap-2">
                      <Button size="sm">Primary</Button>
                      <Button size="sm" variant="outline">
                        Outline
                      </Button>
                      <Button size="sm" variant="ghost">
                        Ghost
                      </Button>
                    </div>
                  </CardContent>
                </Card>
                <FeatureCard
                  icon={<Activity />}
                  title="Depth inverts cleanly"
                  description="No per-component dark: override anywhere — the two lamp variables carry it."
                />
              </div>
            </div>
          </Section>
        </div>
      </div>
    </LandingMotionProvider>
  )
}

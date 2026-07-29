import { createClient } from "@/lib/supabase/server"
import { formatISTDate, formatISTTime } from "@/lib/format"
import { logoUrlFromPath } from "@/lib/clinic"
import { IntakeForm, type IntakePrefill } from "@/components/intake/intake-form"
import { PublicShell, PublicCard } from "@/components/public-shell"

// Bare title — the root layout appends "· ClinicFlow" via its title template.
export const metadata = { title: "Pre-visit form", robots: { index: false } }

type Context = {
  found: boolean
  submitted?: boolean
  clinic_name?: string
  doctor_name?: string
  logo_path?: string | null
  appointment_time?: string
  prefill?: IntakePrefill
}

export default async function IntakePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = await createClient()
  const { data } = await supabase.rpc("get_intake_context", { p_token: token })
  const ctx = data as unknown as Context | null

  return (
    <PublicShell
      logo={ctx?.found ? logoUrlFromPath(ctx.logo_path) : null}
      brandName={ctx?.clinic_name ?? ""}
    >
      {!ctx?.found ? (
        <PublicCard className="p-8 text-center">
          <h1 className="font-heading text-lg font-semibold">Link not available</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This pre-visit form link is invalid or has expired. No action is needed.
          </p>
        </PublicCard>
      ) : (
        <>
          <PublicCard className="mb-6">
            <h1 className="font-heading text-2xl font-semibold">{ctx.clinic_name}</h1>
            <p className="text-sm text-muted-foreground">{ctx.doctor_name}</p>
            {ctx.appointment_time && (
              <p className="mt-2 text-sm">
                Appointment: {formatISTDate(ctx.appointment_time)} at {formatISTTime(ctx.appointment_time)}
              </p>
            )}
          </PublicCard>

          <PublicCard>
            {ctx.submitted ? (
              <div className="text-center">
                <h2 className="font-heading text-base font-semibold">Already submitted</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  We&apos;ve got your details. Thank you!
                </p>
              </div>
            ) : (
              <>
                <h2 className="mb-1 font-heading text-base font-semibold">Before your visit</h2>
                <p className="mb-4 text-sm text-muted-foreground">
                  Fill this quick form to save time at the clinic.
                </p>
                <IntakeForm
                  token={token}
                  prefill={
                    ctx.prefill ?? {
                      full_name: "",
                      age_years: null,
                      dob: null,
                      gender: null,
                      allergies: null,
                    }
                  }
                />
              </>
            )}
          </PublicCard>
        </>
      )}
    </PublicShell>
  )
}

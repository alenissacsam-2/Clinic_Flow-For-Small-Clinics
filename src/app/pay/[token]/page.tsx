import { createClient } from "@/lib/supabase/server"
import { formatINR } from "@/lib/format"
import { logoUrlFromPath } from "@/lib/clinic"
import { PayWidget } from "@/components/pay/pay-widget"
import { PublicShell, PublicCard } from "@/components/public-shell"

// Bare title — the root layout appends "· ClinicFlow" via its title template.
export const metadata = { title: "Pay", robots: { index: false } }

type Context = {
  found: boolean
  invoice_no?: string
  status?: string
  amount_due?: number
  claimed?: boolean
  clinic?: { name: string; logo_path?: string | null; upi_vpa: string | null; upi_name: string | null }
}

export default async function PayPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = await createClient()
  const { data } = await supabase.rpc("get_invoice_public", { p_token: token })
  const ctx = data as unknown as Context | null

  const due = Number(ctx?.amount_due ?? 0)
  const paid = ctx?.status === "paid" || due <= 0
  const hasVpa = Boolean(ctx?.clinic?.upi_vpa)

  return (
    <PublicShell
      width="md"
      logo={ctx?.found ? logoUrlFromPath(ctx.clinic?.logo_path) : null}
      brandName={ctx?.clinic?.name ?? ""}
    >
      {!ctx?.found ? (
        <PublicCard className="p-8 text-center">
          <h1 className="font-heading text-lg font-semibold">Payment link not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This payment link is invalid. Please contact the clinic.
          </p>
        </PublicCard>
      ) : (
        <>
          <PublicCard className="mb-6 text-center">
            <h1 className="font-heading text-2xl font-semibold">{ctx.clinic?.name}</h1>
            <p className="text-sm text-muted-foreground">Invoice {ctx.invoice_no}</p>
            <p className="mt-3 text-4xl font-semibold tabular-nums">{formatINR(due)}</p>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">amount due</p>
          </PublicCard>

          <PublicCard>
            {paid ? (
              <div className="text-center">
                <h2 className="font-heading text-base font-semibold text-success">Paid</h2>
                <p className="mt-1 text-sm text-muted-foreground">This invoice is fully settled. Thank you!</p>
              </div>
            ) : !hasVpa ? (
              <p className="text-center text-sm text-muted-foreground">
                Online payment isn&apos;t set up for this clinic. Please pay at the clinic.
              </p>
            ) : (
              <PayWidget
                token={token}
                vpa={ctx.clinic!.upi_vpa!}
                name={ctx.clinic!.upi_name || ctx.clinic!.name}
                amount={due}
                note={ctx.invoice_no ?? "Payment"}
                alreadyClaimed={Boolean(ctx.claimed)}
              />
            )}
          </PublicCard>
        </>
      )}
    </PublicShell>
  )
}

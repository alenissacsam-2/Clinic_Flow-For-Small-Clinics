import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { requireDoctor } from "@/lib/clinic"
import { createClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/page-header"
import { MedicineImport } from "@/components/settings/medicine-import"

export default async function MedicinesSettingsPage() {
  const clinic = await requireDoctor()
  const supabase = await createClient()

  const [{ count: clinicCount }, { count: globalCount }] = await Promise.all([
    supabase
      .from("medicines")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinic.id),
    supabase
      .from("medicines")
      .select("id", { count: "exact", head: true })
      .is("clinic_id", null),
  ])

  return (
    <div>
      <Link
        href="/settings"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Settings
      </Link>
      <PageHeader
        title="Medicines"
        description="Your prescription autocomplete. Import a drug list to extend the built-in one."
      />

      <div className="max-w-2xl space-y-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-edge/20 bg-card shadow-nm-raised p-4">
            <p className="text-xs text-muted-foreground">Built-in list</p>
            <p className="font-heading text-2xl font-semibold tabular-nums">
              {(globalCount ?? 0).toLocaleString("en-IN")}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Curated common Indian OPD drugs, shared by every clinic.
            </p>
          </div>
          <div className="rounded-xl border border-edge/20 bg-card shadow-nm-raised p-4">
            <p className="text-xs text-muted-foreground">Added by your clinic</p>
            <p className="font-heading text-2xl font-semibold tabular-nums">
              {(clinicCount ?? 0).toLocaleString("en-IN")}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Your rows appear above the built-in list when prescribing.
            </p>
          </div>
        </div>

        <MedicineImport />
      </div>
    </div>
  )
}

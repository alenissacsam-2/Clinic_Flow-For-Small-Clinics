import { createClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/page-header"
import { ClinicsTable, type AdminClinicRow } from "@/components/admin/clinics-table"

export default async function AdminClinicsPage() {
  const supabase = await createClient()
  const { data } = await supabase.rpc("admin_list_clinics")
  const clinics = (data as AdminClinicRow[] | null) ?? []

  return (
    <div>
      <PageHeader
        title="Clinics"
        description={`${clinics.length} clinic${clinics.length === 1 ? "" : "s"} on the platform.`}
      />
      <ClinicsTable clinics={clinics} />
    </div>
  )
}

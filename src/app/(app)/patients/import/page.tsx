import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { requireClinic } from "@/lib/clinic"
import { PageHeader } from "@/components/page-header"
import { ImportWizard } from "@/components/patients/import-wizard"

export default async function ImportPatientsPage() {
  await requireClinic()
  return (
    <div>
      <Link
        href="/patients"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Patients
      </Link>
      <PageHeader title="Import patients" description="Upload a CSV to add many patients at once." />
      <div className="max-w-2xl">
        <ImportWizard />
      </div>
    </div>
  )
}

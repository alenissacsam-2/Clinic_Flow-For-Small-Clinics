import Link from "next/link"
import { Upload } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { requireClinic } from "@/lib/clinic"
import { formatPhoneDisplay } from "@/lib/format"
import { initials } from "@/lib/name"
import { PageHeader } from "@/components/page-header"
import { SearchInput } from "@/components/search-input"
import { Pagination, parsePage } from "@/components/pagination"
import { NewPatientDialog } from "@/components/patients/new-patient-dialog"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const PAGE_SIZE = 50

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>
}) {
  await requireClinic()
  const { q, page: rawPage } = await searchParams
  const page = parsePage(rawPage)
  const supabase = await createClient()

  // Was `.limit(100)` — silent truncation, so a registry of 400 patients hid
  // three quarters of itself with nothing on screen saying so.
  let query = supabase
    .from("patients")
    .select("id, full_name, phone, gender, age_years, tags, whatsapp_opt_in", { count: "exact" })
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

  if (q && q.trim()) {
    const term = q.trim()
    query = query.or(`full_name.ilike.%${term}%,phone.ilike.%${term}%`)
  }

  const { data: patients, count } = await query
  const total = count ?? patients?.length ?? 0

  return (
    <div>
      <PageHeader title="Patients" description="Your patient registry.">
        <div className="flex items-center gap-2">
          <Link href="/patients/import" className={cn(buttonVariants({ variant: "outline" }))}>
            <Upload className="size-4" />
            Import CSV
          </Link>
          <NewPatientDialog />
        </div>
      </PageHeader>

      <div className="mb-4">
        <SearchInput placeholder="Search by name or mobile number…" />
      </div>

      <div className="rounded-xl border border-edge/20 bg-card shadow-nm-raised">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Mobile</TableHead>
              <TableHead className="hidden sm:table-cell">Age / Sex</TableHead>
              <TableHead className="hidden md:table-cell">Tags</TableHead>
              <TableHead className="text-right">WhatsApp</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!patients?.length && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                  {q ? "No patients match your search." : "No patients yet. Add your first patient."}
                </TableCell>
              </TableRow>
            )}
            {patients?.map((p) => (
              <TableRow key={p.id} className="cursor-pointer">
                <TableCell className="font-medium">
                  <Link href={`/patients/${p.id}`} className="flex items-center gap-2.5 hover:underline">
                    <Avatar size="sm" className="shrink-0">
                      <AvatarFallback className="bg-primary/10 text-[10px] font-medium text-primary">
                        {initials(p.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    {p.full_name}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground tabular-nums">
                  {formatPhoneDisplay(p.phone)}
                </TableCell>
                <TableCell className="hidden sm:table-cell text-muted-foreground">
                  {[p.age_years ? `${p.age_years}y` : null, p.gender].filter(Boolean).join(" · ") || "—"}
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <div className="flex flex-wrap gap-1">
                    {p.tags?.map((t) => (
                      <Badge key={t} variant="secondary" className="text-xs">
                        {t}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span
                      className={cn(
                        "size-2 rounded-full",
                        p.whatsapp_opt_in ? "bg-success" : "bg-border",
                      )}
                    />
                    {p.whatsapp_opt_in ? "Opted in" : "Off"}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!!patients?.length && (
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            baseHref={q?.trim() ? `/patients?q=${encodeURIComponent(q.trim())}` : "/patients"}
            noun="patients"
          />
        )}
      </div>
    </div>
  )
}

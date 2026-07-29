"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { formatINR } from "@/lib/format"
import { Input } from "@/components/ui/input"

export type AdminClinicRow = {
  id: string
  name: string
  slug: string
  doctor_name: string
  created_at: string
  suspended_at: string | null
  booking_mode: string
  patient_count: number
  appt_count: number
  revenue: number
}

export function ClinicsTable({ clinics }: { clinics: AdminClinicRow[] }) {
  const router = useRouter()
  const [q, setQ] = useState("")

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return clinics
    return clinics.filter(
      (c) =>
        c.name.toLowerCase().includes(needle) ||
        c.slug.toLowerCase().includes(needle) ||
        c.doctor_name.toLowerCase().includes(needle),
    )
  }, [clinics, q])

  return (
    <div>
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by clinic, slug, or doctor…"
        className="mb-4 max-w-sm"
      />
      <div className="overflow-x-auto rounded-xl border border-edge/20 bg-card shadow-nm-raised">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-medium">Clinic</th>
              <th className="px-4 py-3 font-medium">Patients</th>
              <th className="px-4 py-3 font-medium">Appts</th>
              <th className="px-4 py-3 font-medium">Revenue</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr
                key={c.id}
                onClick={() => router.push(`/admin/clinics/${c.id}`)}
                className="cursor-pointer border-b last:border-0 transition-colors hover:bg-accent/40"
              >
                <td className="px-4 py-3">
                  <p className="font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.doctor_name} · /{c.slug}
                  </p>
                </td>
                <td className="px-4 py-3 tabular-nums">{c.patient_count}</td>
                <td className="px-4 py-3 tabular-nums">{c.appt_count}</td>
                <td className="px-4 py-3 tabular-nums">{formatINR(Number(c.revenue))}</td>
                <td className="px-4 py-3">
                  {c.suspended_at ? (
                    <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                      Paused
                    </span>
                  ) : (
                    <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                      Active
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {!filtered.length && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  No clinics match “{q}”.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

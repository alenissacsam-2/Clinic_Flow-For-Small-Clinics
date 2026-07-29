"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { isPlatformAdmin } from "@/lib/admin"

export type AdminActionState = { error?: string; ok?: boolean } | undefined

/** Suspend or unsuspend a clinic. Operator-only (double-gated: here + in the RPC). */
export async function setClinicSuspended(
  clinicId: string,
  suspend: boolean,
): Promise<AdminActionState> {
  if (!(await isPlatformAdmin())) return { error: "Not authorized." }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc("admin_set_clinic_suspended", {
    p_clinic: clinicId,
    p_suspend: suspend,
  })
  if (error) return { error: "Could not update the clinic. Please try again." }
  const res = data as { ok?: boolean } | null
  if (!res?.ok) return { error: "Could not update the clinic." }

  revalidatePath("/admin/clinics")
  revalidatePath(`/admin/clinics/${clinicId}`)
  return { ok: true }
}

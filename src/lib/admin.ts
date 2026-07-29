import "server-only"
import { redirect } from "next/navigation"
import { cache } from "react"
import { createClient } from "@/lib/supabase/server"

/**
 * Whether the signed-in user is a platform operator (super-admin over all
 * clinics). Backed by the `is_platform_admin()` SECURITY DEFINER RPC, so it
 * reads `platform_admins` without exposing that table via RLS. Memoized per
 * request. Returns false when not authed.
 */
export const isPlatformAdmin = cache(async (): Promise<boolean> => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return false
  const { data } = await supabase.rpc("is_platform_admin")
  return data === true
})

/**
 * Require a platform operator. Sends unauthed users to /login and
 * authed-but-not-admin users to /today (their normal app).
 */
export async function requirePlatformAdmin(): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  if (!(await isPlatformAdmin())) redirect("/today")
}

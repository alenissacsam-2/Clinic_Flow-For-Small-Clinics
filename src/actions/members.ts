"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireDoctor } from "@/lib/clinic"
import { hasServiceRole, env } from "@/lib/env"

export type MembersState = { error?: string; ok?: boolean; inviteLink?: string } | undefined

const inviteSchema = z.object({ email: z.string().email() })

/** Invite a staff member by email. Doctor-only. */
export async function inviteStaff(
  _prev: MembersState,
  formData: FormData,
): Promise<MembersState> {
  const clinic = await requireDoctor()
  const parsed = inviteSchema.safeParse({ email: formData.get("email") })
  if (!parsed.success) return { error: "Enter a valid email address." }
  const email = parsed.data.email.trim().toLowerCase()

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Replace any existing pending invite for this email (refreshes token + expiry).
  await supabase
    .from("clinic_invites")
    .delete()
    .eq("clinic_id", clinic.id)
    .eq("email", email)
    .is("accepted_at", null)

  const { data: invite, error } = await supabase
    .from("clinic_invites")
    .insert({ clinic_id: clinic.id, email, role: "staff", invited_by: user?.id ?? null })
    .select("token")
    .maybeSingle()
  if (error) return { error: error.message }

  // Best-effort: ask Supabase to email an invite so a brand-new user can sign up.
  // Requires the service role; silently skipped in dry-run/dev without it.
  if (hasServiceRole()) {
    try {
      await createAdminClient().auth.admin.inviteUserByEmail(email, {
        redirectTo: `${env.appUrl}/auth/callback`,
      })
    } catch {
      // Non-fatal: the doctor can still share the signup link below.
    }
  }

  revalidatePath("/settings")
  const inviteLink = `${env.appUrl}/signup?invite=${invite?.token ?? ""}`
  return { ok: true, inviteLink }
}

const idSchema = z.object({ id: z.string().uuid() })

/** Revoke a pending invite. Doctor-only. */
export async function revokeInvite(
  _prev: MembersState,
  formData: FormData,
): Promise<MembersState> {
  const clinic = await requireDoctor()
  const parsed = idSchema.safeParse({ id: formData.get("id") })
  if (!parsed.success) return { error: "Invalid invite." }

  const supabase = await createClient()
  const { error } = await supabase
    .from("clinic_invites")
    .delete()
    .eq("id", parsed.data.id)
    .eq("clinic_id", clinic.id)
    .is("accepted_at", null)
  if (error) return { error: error.message }
  revalidatePath("/settings")
  return { ok: true }
}

const removeSchema = z.object({ user_id: z.string().uuid() })

/** Remove a member from the clinic. Doctor-only; cannot remove the last doctor or self. */
export async function removeMember(
  _prev: MembersState,
  formData: FormData,
): Promise<MembersState> {
  const clinic = await requireDoctor()
  const parsed = removeSchema.safeParse({ user_id: formData.get("user_id") })
  if (!parsed.success) return { error: "Invalid member." }
  const targetId = parsed.data.user_id

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user && targetId === user.id) {
    return { error: "You can't remove yourself." }
  }

  // Never leave a clinic with zero doctors.
  const { data: target } = await supabase
    .from("clinic_members")
    .select("role")
    .eq("clinic_id", clinic.id)
    .eq("user_id", targetId)
    .maybeSingle()
  if (target?.role === "doctor") {
    const { count } = await supabase
      .from("clinic_members")
      .select("*", { count: "exact", head: true })
      .eq("clinic_id", clinic.id)
      .eq("role", "doctor")
    if ((count ?? 0) <= 1) return { error: "You can't remove the only doctor." }
  }

  const { error } = await supabase
    .from("clinic_members")
    .delete()
    .eq("clinic_id", clinic.id)
    .eq("user_id", targetId)
  if (error) return { error: error.message }
  revalidatePath("/settings")
  return { ok: true }
}

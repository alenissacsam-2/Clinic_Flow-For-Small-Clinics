"use server"

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { env } from "@/lib/env"

export type AuthState = { error?: string } | undefined

export async function signInWithPassword(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim()
  const password = String(formData.get("password") ?? "")
  if (!email || !password) return { error: "Email and password are required." }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { error: error.message }
  // Claim any staff invites addressed to this email.
  await supabase.rpc("accept_pending_invites")
  redirect("/today")
}

export async function signUpWithPassword(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim()
  const password = String(formData.get("password") ?? "")
  if (!email || password.length < 8) {
    return { error: "Enter an email and a password of at least 8 characters." }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${env.appUrl}/auth/callback` },
  })
  if (error) return { error: error.message }

  // If email confirmation is disabled, a session is returned immediately.
  if (data.session) {
    // A staff invite means they join an existing clinic and skip onboarding.
    const { data: accepted } = await supabase.rpc("accept_pending_invites")
    const joined = (accepted as { accepted?: number } | null)?.accepted ?? 0
    redirect(joined > 0 ? "/today" : "/onboarding")
  }
  return { error: "Check your email to confirm your account, then sign in." }
}

export async function signInWithGoogle(): Promise<void> {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${env.appUrl}/auth/callback` },
  })
  if (error) throw error
  if (data.url) redirect(data.url)
}

export async function signOut(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/login")
}

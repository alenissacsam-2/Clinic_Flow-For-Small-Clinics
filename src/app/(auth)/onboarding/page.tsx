import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { OnboardingForm } from "./onboarding-form"

export default async function OnboardingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // Claim any pending staff invite, then skip onboarding if a clinic now exists.
  await supabase.rpc("accept_pending_invites")
  const { data: existing } = await supabase.from("clinics").select("id").limit(1).maybeSingle()
  if (existing) redirect("/today")

  return <OnboardingForm />
}

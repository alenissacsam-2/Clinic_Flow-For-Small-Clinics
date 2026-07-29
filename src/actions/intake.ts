"use server"

import { createClient } from "@/lib/supabase/server"
import { intakeSchema } from "@/lib/validation/intake"
import type { Json } from "@/types/database"

export type IntakeState = { error?: string; ok?: boolean } | undefined

/** Public: submit the pre-visit intake via the anon-callable RPC. */
export async function submitIntake(
  token: string,
  _prev: IntakeState,
  formData: FormData,
): Promise<IntakeState> {
  const parsed = intakeSchema.safeParse({
    age_years: formData.get("age_years") ?? "",
    dob: formData.get("dob") ?? "",
    gender: formData.get("gender") ?? "",
    allergies: formData.get("allergies") ?? "",
    complaints: formData.get("complaints") ?? "",
    medicines: formData.get("medicines") ?? "",
  })
  if (!parsed.success) return { error: "Please check your answers." }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc("submit_intake", {
    p_token: token,
    p_payload: parsed.data as unknown as Json,
  })
  if (error) return { error: "Something went wrong. Please try again." }
  const res = data as { ok?: boolean; error?: string } | null
  if (!res?.ok) {
    if (res?.error === "already_submitted") return { error: "This form was already submitted." }
    if (res?.error === "expired") return { error: "This link has expired." }
    return { error: "Could not submit. Please try again." }
  }
  return { ok: true }
}

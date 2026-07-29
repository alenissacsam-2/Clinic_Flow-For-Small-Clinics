"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { requireClinic } from "@/lib/clinic"
import { sendQueuedMessage } from "@/lib/whatsapp/enqueue"

/** Re-attempt a failed message from the message log. */
export async function retryMessage(messageId: string): Promise<{ error?: string; ok?: boolean }> {
  await requireClinic()
  const supabase = await createClient()
  // Reset to queued so the claim in sendQueuedMessage picks it up.
  const { error } = await supabase
    .from("wa_messages")
    .update({ status: "queued" })
    .eq("id", messageId)
    .eq("status", "failed")
  if (error) return { error: error.message }
  await sendQueuedMessage(supabase, messageId)
  revalidatePath("/messages")
  return { ok: true }
}

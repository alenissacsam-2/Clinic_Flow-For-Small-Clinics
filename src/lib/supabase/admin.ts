import "server-only"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"
import { env } from "@/lib/env"
import { serverEnv } from "@/lib/env"

/**
 * Service-role Supabase client. BYPASSES RLS — server-only.
 * Use exclusively for: the public booking page, the WhatsApp queue/sender,
 * and cron jobs. Never expose to the browser and never derive clinic scope
 * from user input without validating it first.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    env.supabaseUrl,
    serverEnv.supabaseServiceRoleKey,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

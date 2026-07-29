/**
 * Typed environment access. Public vars are inlined by Next at build time;
 * server-only vars are read lazily so client bundles never touch them.
 */

function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing required env var: ${name}`)
  return value
}

export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
}

/** Server-only secrets. Never import into a client component. */
export const serverEnv = {
  get supabaseServiceRoleKey() {
    return required("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY)
  },
  get whatsapp() {
    return {
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ?? "",
      businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID ?? "",
      accessToken: process.env.WHATSAPP_ACCESS_TOKEN ?? "",
      verifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ?? "",
      appSecret: process.env.WHATSAPP_APP_SECRET ?? "",
      apiVersion: process.env.WHATSAPP_API_VERSION ?? "v21.0",
    }
  },
  get cronSecret() {
    return required("CRON_SECRET", process.env.CRON_SECRET)
  },
  get msg91() {
    return {
      authKey: process.env.MSG91_AUTH_KEY ?? "",
      otpTemplateId: process.env.MSG91_OTP_TEMPLATE_ID ?? "",
      senderId: process.env.MSG91_SENDER_ID ?? "",
    }
  },
  get abdm() {
    return {
      clientId: process.env.ABDM_CLIENT_ID ?? "",
      clientSecret: process.env.ABDM_CLIENT_SECRET ?? "",
      // Sandbox by default. Production is dev.abdm.gov.in's live counterpart,
      // issued with the credentials — never hardcode it as the fallback.
      baseUrl: process.env.ABDM_BASE_URL ?? "https://dev.abdm.gov.in/gateway",
      hipId: process.env.ABDM_HIP_ID ?? "",
    }
  },
}

/** True when MSG91 SMS credentials are configured (OTP fallback channel). */
export function hasMsg91(): boolean {
  return Boolean(process.env.MSG91_AUTH_KEY && process.env.MSG91_OTP_TEMPLATE_ID)
}

/** True when ABDM gateway credentials are configured (see src/lib/abdm/gateway.ts). */
export function hasAbdm(): boolean {
  return Boolean(process.env.ABDM_CLIENT_ID && process.env.ABDM_CLIENT_SECRET)
}

/** True when a usable service-role key is configured (not the placeholder). */
export function hasServiceRole(): boolean {
  const k = process.env.SUPABASE_SERVICE_ROLE_KEY
  return Boolean(k && !k.startsWith("PASTE_") && !k.startsWith("your-"))
}

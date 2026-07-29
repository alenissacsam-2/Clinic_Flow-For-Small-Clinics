import "server-only"
import { serverEnv, hasAbdm } from "@/lib/env"

/**
 * ABDM gateway client.
 *
 * Follows the same shape as src/lib/whatsapp/client.ts: when credentials are
 * absent it runs in **dry-run** mode — no network call, synthetic ids — so the
 * whole consent pipeline (request → artefact row → UI → audit trail) is
 * exercisable today, and going live is a matter of setting four env vars.
 *
 * ── What this is not ─────────────────────────────────────────────────
 * Real ABDM participation needs NHA registration, a HIP/HIU id, and passing
 * the M1–M3 milestones on the sandbox. Those are operational steps the clinic
 * must complete; no amount of code substitutes for them. Nothing here claims
 * certification, and `abdmConfigured()` is false until credentials exist.
 */

export function abdmConfigured(): boolean {
  return hasAbdm()
}

type SessionToken = { token: string; expiresAt: number }
let cachedSession: SessionToken | null = null

/**
 * Fetch (and briefly cache) a gateway session token. ABDM tokens are
 * short-lived; we refresh a minute early rather than racing expiry.
 */
async function sessionToken(): Promise<string | null> {
  if (!abdmConfigured()) return null
  if (cachedSession && cachedSession.expiresAt > Date.now()) return cachedSession.token

  const { baseUrl, clientId, clientSecret } = serverEnv.abdm
  try {
    const res = await fetch(`${baseUrl}/v0.5/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, clientSecret }),
    })
    if (!res.ok) return null
    const json = (await res.json()) as { accessToken?: string; expiresIn?: number }
    if (!json.accessToken) return null
    const ttlMs = (json.expiresIn ?? 600) * 1000
    cachedSession = { token: json.accessToken, expiresAt: Date.now() + ttlMs - 60_000 }
    return cachedSession.token
  } catch {
    return null
  }
}

/** Drop the cached token — used by tests and after an auth failure. */
export function resetAbdmSession(): void {
  cachedSession = null
}

export type ConsentRequestArgs = {
  abhaAddress: string
  purposeCode: string
  hiTypes: string[]
  dateFrom: string
  dateTo: string
  expiresAt: string
}

export type ConsentRequestResult = {
  requestId?: string
  error?: string
  /** True when no call left the process — credentials are not configured. */
  dryRun?: boolean
}

/**
 * Raise a consent request with the gateway. The patient approves it in their
 * own ABHA app; the gateway later calls back with the artefact. We record our
 * row either way, so the request is auditable from the moment it is made.
 */
export async function requestConsent(args: ConsentRequestArgs): Promise<ConsentRequestResult> {
  if (!abdmConfigured()) {
    return {
      requestId: `dryrun-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      dryRun: true,
    }
  }

  const token = await sessionToken()
  if (!token) return { error: "Could not authenticate with the ABDM gateway." }

  const { baseUrl, hipId } = serverEnv.abdm
  try {
    const res = await fetch(`${baseUrl}/v0.5/consent-requests/init`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-CM-ID": "sbx",
      },
      body: JSON.stringify({
        requestId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        consent: {
          purpose: { text: "Care Management", code: args.purposeCode },
          patient: { id: args.abhaAddress },
          hiu: { id: hipId },
          requester: { name: "ClinicFlow" },
          hiTypes: args.hiTypes,
          permission: {
            accessMode: "VIEW",
            dateRange: { from: args.dateFrom, to: args.dateTo },
            dataEraseAt: args.expiresAt,
            frequency: { unit: "HOUR", value: 1, repeats: 0 },
          },
        },
      }),
    })
    if (!res.ok) {
      const body = await res.text()
      return { error: `Gateway rejected the request (HTTP ${res.status}). ${body.slice(0, 200)}` }
    }
    const json = (await res.json()) as { consentRequest?: { id?: string } }
    return { requestId: json.consentRequest?.id }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Network error" }
  }
}

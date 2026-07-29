import { test, expect, type APIRequestContext } from "@playwright/test"

/**
 * Auth on the API routes, and tenant isolation at the database edge.
 *
 * ── Why the API routes need their own suite ──────────────────────────────────
 * `src/proxy.ts` gates the app, but its matcher deliberately excludes `api`:
 *
 *     "/((?!_next/static|_next/image|favicon.ico|api|...).*)"
 *
 * So nothing in front of `/api/*` checks a session. Every one of those routes
 * hand-rolls its own `getUser()` guard, and the ones below hand back a
 * patient's entire medical record, a prescription PDF, or the clinic's payment
 * history. A single route that forgets the guard is a silent, unauthenticated
 * PHI leak, and the page-level redirect tests say nothing about it.
 *
 * ── Why the direct-to-PostgREST checks ───────────────────────────────────────
 * Supabase exposes every table at /rest/v1/<table> with the anon key, which is
 * public by design and shipped to the browser. RLS is the only thing standing
 * between that key and the database, so these assert the floor: anon reads
 * nothing and writes nothing.
 *
 * The `clinic_members` case is the regression guard for the hole closed in
 * migration 0030, where an over-broad insert policy let any account attach
 * itself to any clinic. Reproducing the full exploit needs a signed-in user, so
 * the authenticated half is verified by the SQL in that migration's header;
 * what runs here is the anon floor.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Well-formed but certain not to exist, so a 401 can only come from the auth
// guard — never from the row simply being missing.
const NOWHERE = "00000000-0000-4000-8000-000000000000"

test.describe("API routes are not covered by the proxy, so each guards itself", () => {
  const guarded = [
    `/api/patients/${NOWHERE}/export`,
    `/api/patients/${NOWHERE}/fhir`,
    `/api/prescriptions/${NOWHERE}/pdf`,
    `/api/invoices/${NOWHERE}/pdf`,
    "/api/reports/export",
  ]

  for (const path of guarded) {
    test(`${path} refuses an anonymous caller`, async ({ request }) => {
      const res = await request.get(path)
      expect(res.status(), `${path} must not serve data without a session`).toBe(401)
      // A 401 that still carried a body would be the leak the status code denies.
      const body = await res.text()
      expect(body).not.toMatch(/patient|invoice|prescription/i)
    })
  }

  test("the reminder cron refuses a caller without the shared secret", async ({ request }) => {
    const res = await request.get("/api/cron/reminders")
    expect(res.status()).toBe(401)
  })

  test("the reminder cron refuses a wrong secret", async ({ request }) => {
    const res = await request.get("/api/cron/reminders", {
      headers: { authorization: "Bearer not-the-secret" },
    })
    expect(res.status()).toBe(401)
  })

  test("the WhatsApp webhook handshake refuses a wrong verify token", async ({ request }) => {
    const res = await request.get(
      "/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=42",
    )
    expect(res.status()).toBe(403)
    expect(await res.text()).not.toBe("42")
  })
})

test.describe("anon holds no direct table access", () => {
  test.skip(!SUPABASE_URL || !ANON, "needs NEXT_PUBLIC_SUPABASE_URL and _ANON_KEY (see .env.local)")

  const headers = () => ({ apikey: ANON!, Authorization: `Bearer ${ANON}` })

  async function readTable(request: APIRequestContext, table: string) {
    const res = await request.get(`${SUPABASE_URL}/rest/v1/${table}?select=*&limit=1`, {
      headers: headers(),
    })
    return { status: res.status(), body: await res.text() }
  }

  // Positive control: without this, a bad key would make every assertion below
  // pass for the wrong reason — everything would be empty and nothing tested.
  test("the anon key reaches PostgREST at all", async ({ request }) => {
    const res = await request.post(`${SUPABASE_URL}/rest/v1/rpc/get_booking_context`, {
      headers: { ...headers(), "Content-Type": "application/json" },
      data: { p_slug: process.env.E2E_CLINIC_SLUG ?? "sunrise-clinic" },
    })
    expect(res.status()).toBe(200)
    expect((await res.json()).found).toBe(true)
  })

  for (const table of [
    "patients",
    "visits",
    "prescriptions",
    "invoices",
    "payments",
    "appointments",
    "clinics",
    "clinic_members",
    "booking_otps",
    "wa_messages",
  ]) {
    test(`anon reads nothing from ${table}`, async ({ request }) => {
      const { status, body } = await readTable(request, table)
      // Either the grant is absent (4xx) or RLS returns an empty set. Both are
      // acceptable; a row is not.
      if (status === 200) {
        expect(JSON.parse(body), `${table} leaked a row to anon`).toEqual([])
      } else {
        expect(status).toBeGreaterThanOrEqual(400)
      }
    })
  }

  test("anon cannot insert itself into a clinic", async ({ request }) => {
    // The shape of the exploit closed in 0030. Anon has no auth.uid(), so this
    // is the floor rather than the full case, but a policy permissive enough to
    // let this through would be catastrophic.
    const res = await request.post(`${SUPABASE_URL}/rest/v1/clinic_members`, {
      headers: { ...headers(), "Content-Type": "application/json" },
      data: { clinic_id: NOWHERE, user_id: NOWHERE, role: "doctor" },
    })
    expect(res.status(), "anon must never gain clinic membership").toBeGreaterThanOrEqual(400)
  })

  test("anon cannot create a patient record directly", async ({ request }) => {
    const res = await request.post(`${SUPABASE_URL}/rest/v1/patients`, {
      headers: { ...headers(), "Content-Type": "application/json" },
      data: { clinic_id: NOWHERE, full_name: "PROBE anon insert", phone: "+919000088888" },
    })
    expect(res.status()).toBeGreaterThanOrEqual(400)
  })
})

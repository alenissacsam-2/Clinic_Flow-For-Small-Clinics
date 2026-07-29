import { test, expect, type APIRequestContext } from "@playwright/test"

/**
 * Public booking, attacked the way a hostile client actually would: straight at
 * the Supabase RPC with the anon key, bypassing the booking widget entirely.
 *
 * `create_booking` is granted to `anon`. It used to accept any instant that was
 * merely in the future and not already taken — opening hours, day closures,
 * `slot_blocks`, the slot grid and the lead time were enforced *only* by
 * `src/lib/slots.ts` in the browser. So a POST like the ones below could book
 * 03:00, an off-grid 10:07 (which desyncs the day's tiling), or a slot months
 * out. `booking_slot_rejection()` in migration 0027 is the server-side mirror
 * that closes this; these tests are what stop it regressing.
 *
 * Every case here is a REJECTION case on purpose. Slot validation runs before
 * the patient find-or-create in the RPC body, so a refused call writes nothing
 * — the suite leaves no rows behind and is safe to run against a real project.
 */

const SLUG = process.env.E2E_CLINIC_SLUG ?? "sunrise-clinic"
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Never matched by a real patient; only reached if validation wrongly passes.
const PROBE_PHONE = "+919000077777"

/** An ISO instant N days from today at a given IST wall-clock time. */
function istInstant(daysFromToday: number, hhmm: string): string {
  const ist = new Date(Date.now() + 5.5 * 3600_000)
  ist.setUTCDate(ist.getUTCDate() + daysFromToday)
  const y = ist.getUTCFullYear()
  const m = String(ist.getUTCMonth() + 1).padStart(2, "0")
  const d = String(ist.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${d}T${hhmm}:00+05:30`
}

async function rpc(request: APIRequestContext, fn: string, body: Record<string, unknown>) {
  const res = await request.post(`${URL}/rest/v1/rpc/${fn}`, {
    headers: { apikey: ANON!, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
    data: body,
  })
  return { status: res.status(), body: await res.json() }
}

const book = (request: APIRequestContext, startsAt: string) =>
  rpc(request, "create_booking", {
    p_slug: SLUG,
    p_name: "Slot Validation Probe",
    p_phone: PROBE_PHONE,
    p_starts_at: startsAt,
    p_reason: null,
    p_consent: true,
  })

test.describe("public booking RPC rejects slots the UI would never offer", () => {
  test.skip(!URL || !ANON, "needs NEXT_PUBLIC_SUPABASE_URL and _ANON_KEY (see .env.local)")

  // Positive control. Without this, a wrong key or URL would make every
  // assertion below pass vacuously — everything would "fail", including the
  // attacks, and the suite would look green while testing nothing.
  test("the anon key reaches the booking API at all", async ({ request }) => {
    const { status, body } = await rpc(request, "get_booking_context", { p_slug: SLUG })
    expect(status, "anon must be able to read booking context").toBe(200)
    expect(body.found, `clinic "${SLUG}" should exist`).toBe(true)
    expect(body.enabled).toBe(true)
  })

  const attacks: { name: string; startsAt: string }[] = [
    { name: "the middle of the night", startsAt: istInstant(1, "03:00") },
    { name: "off the slot grid (10:07)", startsAt: istInstant(1, "10:07") },
    { name: "a time in the past", startsAt: istInstant(-1, "10:00") },
    { name: "months beyond the bookable horizon", startsAt: istInstant(60, "10:00") },
    { name: "after the clinic has closed (23:30)", startsAt: istInstant(1, "23:30") },
  ]

  for (const { name, startsAt } of attacks) {
    test(`refuses ${name}`, async ({ request }) => {
      const { status, body } = await book(request, startsAt)
      expect(status, "the RPC itself should respond, not error out").toBe(200)
      expect(body.ok, `${startsAt} must not be bookable`).toBe(false)
      expect(typeof body.error).toBe("string")
      // "just taken" would mean the request survived validation and only the
      // unique index stopped it — a very different (and broken) outcome.
      expect(body.error).not.toMatch(/just taken/i)
    })
  }

  test("no probe patient is ever created by a refused booking", async ({ request }) => {
    // Slot validation runs before find-or-create in the RPC body. If that order
    // is ever inverted, hostile calls would quietly seed patient records.
    await book(request, istInstant(1, "03:00"))
    const { body } = await rpc(request, "get_booking_context", { p_slug: SLUG })
    expect(body.found).toBe(true)
    // A created patient would have taken a slot; the refused instant must not
    // appear among the clinic's booked starts.
    const booked: string[] = body.booked ?? []
    const refused = new Date(istInstant(1, "03:00")).toISOString()
    expect(booked.map((b) => new Date(b).toISOString())).not.toContain(refused)
  })
})

import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getFhirRecord } from "@/lib/fhir/record"
import { buildPatientRecordBundle } from "@/lib/fhir/bundle"
import { contentDisposition } from "@/lib/http"

export const runtime = "nodejs"

/**
 * FHIR R4 export of a patient's record — the interoperable sibling of the
 * DPDP JSON export next door. Returns a `collection` Bundle of per-visit
 * OPConsultRecord document Bundles.
 *
 * Auth is the user's own session, so RLS scopes the read: a doctor can only
 * export their own clinic's patients. A patient the caller cannot see is a
 * 404, not a 403 — a 403 would confirm the id exists.
 */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/patients/[id]/fhir">) {
  const { id } = await ctx.params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new NextResponse("Unauthorized", { status: 401 })

  const record = await getFhirRecord(supabase, id, new Date().toISOString())
  if (!record) return new NextResponse("Not found", { status: 404 })

  const bundle = buildPatientRecordBundle(record)

  return new NextResponse(JSON.stringify(bundle, null, 2), {
    headers: {
      // The registered media type for FHIR JSON. Receiving systems content-negotiate on it.
      "Content-Type": "application/fhir+json; charset=utf-8",
      // Keyed by uuid, unlike the DPDP export: this file is consumed by another
      // health system, which wants the stable identifier rather than a name.
      "Content-Disposition": contentDisposition("attachment", `patient-${id}-fhir.json`),
      "Cache-Control": "private, no-store",
    },
  })
}

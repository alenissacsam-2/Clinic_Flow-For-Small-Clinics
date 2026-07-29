import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"

type DB = SupabaseClient<Database>

/**
 * Cross-tenant reference guard.
 *
 * ── Why RLS is not enough here ───────────────────────────────────────────────
 * Every tenant table carries `tenant_all` with `with check (clinic_id in
 * (select auth_clinic_ids()))`. That validates the clinic_id of the row being
 * written — and nothing else. A write like
 *
 *     insert into lab_orders (clinic_id, patient_id) values (mine, theirs)
 *
 * passes the policy cleanly, because `clinic_id` is mine; `patient_id` is only
 * checked by the foreign key, which asks whether the row exists, never whose
 * it is. Server actions take these ids straight from the client, so a forged
 * id silently attaches my clinic's lab order, claim or file to another
 * clinic's patient.
 *
 * Nothing leaks back — reads are scoped by clinic_id — but the other clinic's
 * record acquires children it never consented to, which for a medical record
 * is corruption regardless of who can see it.
 *
 * So: any id that arrives from the client and is stored as a reference must be
 * proven to belong to the acting clinic first. The SELECTs below are
 * themselves RLS-scoped, which makes this defence-in-depth rather than the
 * only line.
 */

/** Tables whose rows may be referenced by a client-supplied id. All carry clinic_id. */
export type OwnedTable =
  | "patients"
  | "visits"
  | "invoices"
  | "payers"
  | "patient_policies"
  | "inventory_items"
  | "lab_orders"
  | "claims"
  | "appointments"

/**
 * True when `id` names a row of `table` owned by `clinicId`.
 *
 * A null/empty id is treated as "nothing to check" and passes — callers use it
 * for genuinely optional references (a lab order with no visit, a claim with
 * no invoice). Callers that require the id must check for it separately.
 */
export async function ownsRef(
  supabase: DB,
  clinicId: string,
  table: OwnedTable,
  id: string | null | undefined,
): Promise<boolean> {
  if (!id) return true

  // The table name is a closed union of tables that all expose clinic_id, but
  // the generated client types cannot narrow a dynamic `from()` to a common
  // row shape, so the projection is asserted once here rather than at each
  // call site.
  const { data } = await supabase
    .from(table)
    .select("clinic_id")
    .eq("id", id)
    .maybeSingle<{ clinic_id: string }>()

  return data?.clinic_id === clinicId
}

/**
 * Check several references at once. Returns the first offending table name, or
 * null when everything checks out — so callers can fail with one guard rather
 * than a stack of ifs.
 */
export async function firstForeignRef(
  supabase: DB,
  clinicId: string,
  refs: Array<[OwnedTable, string | null | undefined]>,
): Promise<OwnedTable | null> {
  const results = await Promise.all(refs.map(([t, id]) => ownsRef(supabase, clinicId, t, id)))
  const bad = results.findIndex((ok) => !ok)
  return bad === -1 ? null : refs[bad][0]
}

/**
 * The message shown when a reference fails. Deliberately identical for
 * "belongs to someone else" and "does not exist": distinguishing them would
 * turn this into an oracle for probing other clinics' row ids.
 */
export const FOREIGN_REF_ERROR = "That record could not be found."

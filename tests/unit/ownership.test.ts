import { describe, it, expect } from "vitest"
import { ownsRef, firstForeignRef, FOREIGN_REF_ERROR, type OwnedTable } from "@/lib/ownership"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"

/**
 * These guard the fix for the cross-tenant reference hole: RLS `tenant_all`
 * validates the `clinic_id` of the row being written and nothing else, so a
 * client-supplied `patient_id` / `invoice_id` / `payer_id` pointing at another
 * clinic's row was accepted. See `src/lib/ownership.ts`.
 */

const MINE = "11111111-1111-1111-1111-111111111111"
const THEIRS = "22222222-2222-2222-2222-222222222222"

type Row = { id: string; clinic_id: string }

/** Minimal stand-in for the query chain `ownsRef` uses, plus a call log. */
function stubClient(rows: Partial<Record<OwnedTable, Row[]>>) {
  const queried: { table: string; id: string }[] = []

  const client = {
    from(table: string) {
      return {
        select() {
          return {
            eq(_column: string, id: string) {
              return {
                async maybeSingle() {
                  queried.push({ table, id })
                  const row = (rows[table as OwnedTable] ?? []).find((r) => r.id === id)
                  return { data: row ? { clinic_id: row.clinic_id } : null }
                },
              }
            },
          }
        },
      }
    },
  }

  return { supabase: client as unknown as SupabaseClient<Database>, queried }
}

const fixture = () =>
  stubClient({
    patients: [
      { id: "p-mine", clinic_id: MINE },
      { id: "p-theirs", clinic_id: THEIRS },
    ],
    invoices: [
      { id: "i-mine", clinic_id: MINE },
      { id: "i-theirs", clinic_id: THEIRS },
    ],
    payers: [{ id: "pay-theirs", clinic_id: THEIRS }],
  })

describe("ownsRef", () => {
  it("accepts a row belonging to the acting clinic", async () => {
    const { supabase } = fixture()
    expect(await ownsRef(supabase, MINE, "patients", "p-mine")).toBe(true)
  })

  it("rejects a row belonging to another clinic", async () => {
    // The whole point: this id is a real, existing row, so the foreign key
    // would have accepted it. Only the clinic check catches it.
    const { supabase } = fixture()
    expect(await ownsRef(supabase, MINE, "patients", "p-theirs")).toBe(false)
  })

  it("rejects an id that does not exist at all", async () => {
    const { supabase } = fixture()
    expect(await ownsRef(supabase, MINE, "patients", "p-nonexistent")).toBe(false)
  })

  it("treats a missing optional reference as nothing to check", async () => {
    // A lab order with no visit, a claim with no invoice. Callers that require
    // the id validate its presence separately.
    const { supabase, queried } = fixture()
    expect(await ownsRef(supabase, MINE, "visits", null)).toBe(true)
    expect(await ownsRef(supabase, MINE, "visits", undefined)).toBe(true)
    expect(await ownsRef(supabase, MINE, "visits", "")).toBe(true)
    expect(queried, "an absent id must not cost a round trip").toHaveLength(0)
  })

  it("looks the id up in the table it was told to", async () => {
    // Guards against a caller pairing an id with the wrong table name and the
    // check silently passing because some other table happens to hold that id.
    const { supabase, queried } = fixture()
    await ownsRef(supabase, MINE, "invoices", "i-mine")
    expect(queried).toEqual([{ table: "invoices", id: "i-mine" }])
  })
})

describe("firstForeignRef", () => {
  it("returns null when every reference is ours", async () => {
    const { supabase } = fixture()
    const bad = await firstForeignRef(supabase, MINE, [
      ["patients", "p-mine"],
      ["invoices", "i-mine"],
      ["visits", null],
    ])
    expect(bad).toBeNull()
  })

  it("names the offending table", async () => {
    const { supabase } = fixture()
    const bad = await firstForeignRef(supabase, MINE, [
      ["patients", "p-mine"],
      ["invoices", "i-theirs"],
    ])
    expect(bad).toBe("invoices")
  })

  it("reports the first offender in argument order, not whichever resolved first", async () => {
    // The checks run concurrently, so the reported table must come from the
    // caller's ordering or the error message is non-deterministic.
    const { supabase } = fixture()
    const bad = await firstForeignRef(supabase, MINE, [
      ["patients", "p-theirs"],
      ["payers", "pay-theirs"],
    ])
    expect(bad).toBe("patients")
  })

  it("catches a foreign reference hidden among valid ones", async () => {
    const { supabase } = fixture()
    const bad = await firstForeignRef(supabase, MINE, [
      ["patients", "p-mine"],
      ["invoices", "i-mine"],
      ["payers", "pay-theirs"],
    ])
    expect(bad).toBe("payers")
  })
})

describe("FOREIGN_REF_ERROR", () => {
  it("does not reveal whether the row exists or merely belongs elsewhere", async () => {
    // Distinguishing the two would turn a rejected save into an oracle for
    // probing other clinics' row ids, so both paths must be indistinguishable
    // to the caller.
    const { supabase } = fixture()
    const foreign = await firstForeignRef(supabase, MINE, [["patients", "p-theirs"]])
    const missing = await firstForeignRef(supabase, MINE, [["patients", "p-nonexistent"]])
    expect(foreign).toBe("patients")
    expect(missing).toBe("patients")
    expect(FOREIGN_REF_ERROR).not.toMatch(/exist|another|other clinic|permission|denied/i)
  })
})

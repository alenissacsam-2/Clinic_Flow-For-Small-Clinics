/**
 * Shared scribe types. Kept out of `scribe.ts` (which is `server-only`) so the
 * client component can import the shape without pulling in the API client.
 */

export type ScribeResult = {
  complaints: string
  diagnosis: string
  advice: string
  /** Names only — never doses. See the rules in `scribe.ts`. */
  medicines: string[]
}

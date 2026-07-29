import type { ScribeResult } from "./types"

/**
 * Parse the scribe model's reply defensively.
 *
 * Lives outside `scribe.ts` because that module is `server-only` — the parser
 * is pure and belongs where it can be unit-tested without dragging in the API
 * client.
 *
 * Anything unexpected becomes an empty field rather than a thrown error or a
 * half-populated object. A suggestion panel showing nothing is honest, and the
 * doctor simply types instead; a crash mid-consultation is not acceptable.
 */
export function parseScribeJson(raw: string): ScribeResult {
  const empty: ScribeResult = { complaints: "", diagnosis: "", advice: "", medicines: [] }

  // Tolerate a fenced block or surrounding prose around the JSON.
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) return empty

  try {
    const parsed = JSON.parse(match[0]) as Record<string, unknown>
    const str = (v: unknown) => (typeof v === "string" ? v.trim() : "")
    return {
      complaints: str(parsed.complaints),
      diagnosis: str(parsed.diagnosis),
      advice: str(parsed.advice),
      medicines: Array.isArray(parsed.medicines)
        ? parsed.medicines
            .filter((m): m is string => typeof m === "string")
            .map((m) => m.trim())
            .filter(Boolean)
            .slice(0, 20)
        : [],
    }
  } catch {
    return empty
  }
}

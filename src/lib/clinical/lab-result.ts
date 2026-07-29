/**
 * Lab result parsing and flagging — pure, no I/O.
 *
 * ── The one rule that matters ────────────────────────────────────────
 * A high/low flag is computed **only** from the reference range the lab
 * itself printed on the report and the clinic typed in. ClinicFlow ships
 * no reference ranges of its own, and never will: ranges are method-,
 * lab-, age- and sex-specific, so a built-in threshold would be inventing
 * a clinical judgement. With no range entered, there is no flag — the
 * result still records fine, it is just not interpreted.
 *
 * So flagging here is arithmetic on the lab's numbers, not medicine.
 */

export type LabFlag = "low" | "normal" | "high" | "abnormal"

export type ParsedResult = {
  value: number
  /** Set for censored results like `<0.01` or `>200`. */
  comparator: "<" | ">" | null
}

/** Western grouping: 1,200 · 1,234,567 */
const GROUPED_WESTERN = /^\d{1,3}(,\d{3})+$/
/** Indian grouping, which lab reports use for platelet counts: 1,50,000 */
const GROUPED_INDIAN = /^\d{1,2}(,\d{2})+,\d{3}$/

/**
 * Remove thousands separators — but only from a run that is unambiguously a
 * grouped number.
 *
 * This is deliberately conservative: in several locales the comma is the
 * *decimal* separator, so blindly stripping would turn "12,5" into 125 — a
 * tenfold error on a lab value. An unrecognised run keeps its commas, fails
 * to parse, and simply goes unflagged.
 */
function stripDigitGrouping(s: string): string {
  return s.replace(/\d[\d,]*\d/g, (run) =>
    GROUPED_WESTERN.test(run) || GROUPED_INDIAN.test(run) ? run.replace(/,/g, "") : run,
  )
}

/**
 * Read a numeric result out of what the clinic typed.
 *
 * Refuses anything ambiguous rather than guessing — `5.5-6.0` (a range
 * pasted into the value box) or `1.2 x 10^3` return null, so no flag is
 * computed and nothing is silently misread. "Negative", "Trace", "Nil" and
 * other qualitative results also return null; those are flagged by hand.
 */
export function parseResultNumber(text: string | null | undefined): ParsedResult | null {
  if (!text) return null
  const t = stripDigitGrouping(text.trim())
  if (!t) return null

  const m = t.match(/^([<>≤≥]?)\s*(-?\d+(?:\.\d+)?)\s*(.*)$/)
  if (!m) return null

  // Any further digit in the tail means this was not a single value —
  // a range, a ratio, or a scientific unit. Refuse rather than misparse.
  if (/\d/.test(m[3])) return null

  const value = Number(m[2])
  if (!Number.isFinite(value)) return null

  const raw = m[1]
  const comparator = raw === "<" || raw === "≤" ? "<" : raw === ">" || raw === "≥" ? ">" : null
  return { value, comparator }
}

/**
 * Flag a parsed result against the lab's own range.
 *
 * Returns null — meaning "not interpreted" — whenever the answer isn't
 * certain: no range, unparseable value, or a censored value that the range
 * doesn't settle (`<5` inside a 1–10 range tells us nothing).
 */
export function flagResult(
  parsed: ParsedResult | null,
  low: number | null | undefined,
  high: number | null | undefined,
): LabFlag | null {
  if (!parsed) return null
  const hasLow = typeof low === "number" && Number.isFinite(low)
  const hasHigh = typeof high === "number" && Number.isFinite(high)
  if (!hasLow && !hasHigh) return null

  const { value, comparator } = parsed

  if (comparator === "<") {
    // "<0.01" is only definitely low if the whole censored interval is.
    return hasLow && value <= low! ? "low" : null
  }
  if (comparator === ">") {
    return hasHigh && value >= high! ? "high" : null
  }

  if (hasLow && value < low!) return "low"
  if (hasHigh && value > high!) return "high"
  return "normal"
}

/** Convenience: parse then flag, for the common "user typed a value" path. */
export function flagFromText(
  text: string | null | undefined,
  low: number | null | undefined,
  high: number | null | undefined,
): LabFlag | null {
  return flagResult(parseResultNumber(text), low, high)
}

/** Display form of a reference range, e.g. `12 – 15` / `< 200` / `> 40`. */
export function formatRange(
  low: number | null | undefined,
  high: number | null | undefined,
  text?: string | null,
): string | null {
  if (text) return text
  const hasLow = typeof low === "number"
  const hasHigh = typeof high === "number"
  if (hasLow && hasHigh) return `${low} – ${high}`
  if (hasHigh) return `< ${high}`
  if (hasLow) return `> ${low}`
  return null
}

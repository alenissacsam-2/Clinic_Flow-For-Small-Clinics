/**
 * CSV writing, with spreadsheet formula injection closed.
 *
 * ── The attack ───────────────────────────────────────────────────────────────
 * Quoting a cell makes it valid CSV. It does not make it inert. Excel, LibreOffice
 * and Google Sheets all evaluate a cell whose text begins with `=`, `+`, `-` or
 * `@` as a formula, quotes or not — so `"=HYPERLINK(""http://x"",""Click"")"`
 * arrives as a live link, and on an unpatched Excel the DDE variants can reach
 * the shell.
 *
 * That matters here because the payments export includes the patient name, and
 * patient names are attacker-supplied: anyone can open a clinic's public booking
 * page and book under any name they like. The doctor then opens payments.csv in
 * Excel, which is exactly what the export exists for.
 *
 * The fix is the OWASP one: prefix a single quote, which spreadsheets consume as
 * "treat the rest as text". Numbers are emitted through `csvNumber` instead so
 * amounts stay numeric and sortable — guarding them would turn every negative
 * figure into a string.
 */

const FORMULA_START = /^[=+\-@\t\r]/

/**
 * Quote a text cell, neutralising anything a spreadsheet would evaluate.
 * Always returns a quoted string, so callers never have to think about commas,
 * quotes or newlines in the value.
 */
export function csvCell(value: string | null | undefined): string {
  const raw = value == null ? "" : String(value)
  const safe = FORMULA_START.test(raw) ? `'${raw}` : raw
  return `"${safe.replace(/"/g, '""')}"`
}

/**
 * Emit a number as a bare CSV field so the spreadsheet reads it as a number.
 * Non-finite values become an empty cell rather than the text "NaN".
 */
export function csvNumber(value: number | null | undefined, fractionDigits = 2): string {
  if (value == null || !Number.isFinite(value)) return ""
  return value.toFixed(fractionDigits)
}

/** Join a header and rows with CRLF, the line ending Excel expects. */
export function toCsv(header: string[], rows: string[][]): string {
  return [header.map(csvCell).join(","), ...rows.map((r) => r.join(","))].join("\r\n")
}

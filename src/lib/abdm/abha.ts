/**
 * ABHA identity helpers — pure, no I/O, safe to import anywhere.
 *
 * ABDM gives every patient two identifiers:
 *   • ABHA number  — 14 digits, displayed as XX-XXXX-XXXX-XXXX, carrying a
 *                    Verhoeff check digit (the same scheme Aadhaar uses).
 *   • ABHA address — a human-readable handle, e.g. `aarav.shah@sbx`.
 *
 * ── Why the checksum is advisory ──────────────────────────────────────
 * We hard-validate the *shape* (14 digits / address grammar) because a
 * typo there is unambiguous. The Verhoeff check digit is reported as a
 * warning and never blocks a save. Reasoning: if our understanding of the
 * scheme is ever wrong, a hard block would make a clinic unable to record
 * a real patient's real ABHA number — a worse failure than storing one we
 * flagged. Same instinct as the drug-safety engine: advise, don't obstruct.
 */

// ─── Verhoeff ────────────────────────────────────────────────────────
// Dihedral group D5 multiplication table.
const D: readonly (readonly number[])[] = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
]

// Permutation table, applied cyclically by digit position.
const P: readonly (readonly number[])[] = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
]

// Multiplicative inverse within D5.
const INV: readonly number[] = [0, 4, 3, 2, 1, 5, 6, 7, 8, 9]

/** Fold a digit string right-to-left through the Verhoeff tables. */
function verhoeffFold(digits: string): number {
  let c = 0
  for (let i = 0; i < digits.length; i++) {
    const digit = Number(digits[digits.length - 1 - i])
    c = D[c][P[i % 8][digit]]
  }
  return c
}

/** True when `digits` (check digit included) satisfies the Verhoeff checksum. */
export function verhoeffValidate(digits: string): boolean {
  if (!/^\d+$/.test(digits)) return false
  return verhoeffFold(digits) === 0
}

/** The Verhoeff check digit for a payload that does not yet carry one. */
export function verhoeffCheckDigit(payload: string): number {
  if (!/^\d+$/.test(payload)) throw new Error("verhoeffCheckDigit: digits only")
  return INV[verhoeffFold(`${payload}0`)]
}

// ─── ABHA number ─────────────────────────────────────────────────────

/** Strip everything but digits. Accepts `91-1122-3344-5564`, spaces, etc. */
export function normalizeAbhaNumber(input: string): string {
  return input.replace(/\D/g, "")
}

/** Display form: `91-1122-3344-5564`. Returns the input unchanged if not 14 digits. */
export function formatAbhaNumber(input: string): string {
  const d = normalizeAbhaNumber(input)
  if (d.length !== 14) return input
  return `${d.slice(0, 2)}-${d.slice(2, 6)}-${d.slice(6, 10)}-${d.slice(10)}`
}

export type AbhaNumberCheck = {
  /** Digits-only value, safe to store. Empty when the input had no digits. */
  value: string
  /** Exactly 14 digits — the hard requirement. */
  wellFormed: boolean
  /** Verhoeff check digit agrees. Advisory only; false never blocks a save. */
  checksumValid: boolean
}

export function checkAbhaNumber(input: string): AbhaNumberCheck {
  const value = normalizeAbhaNumber(input)
  const wellFormed = value.length === 14
  return {
    value,
    wellFormed,
    checksumValid: wellFormed && verhoeffValidate(value),
  }
}

// ─── ABHA address ────────────────────────────────────────────────────

/**
 * NHA's published grammar for the handle: 8–18 characters, starts with a
 * letter, ends alphanumeric, and may contain dots and underscores between.
 * Deliberately permissive about the domain suffix — NHA has used several
 * (`@abdm`, `@sbx`, and partner domains), and new ones should not be
 * rejected by a hardcoded list.
 */
const ABHA_HANDLE = /^[a-z][a-z0-9._]{6,16}[a-z0-9]$/
const ABHA_DOMAIN = /^[a-z][a-z0-9.-]{1,30}$/

/** Lowercase and trim; ABHA addresses are case-insensitive. */
export function normalizeAbhaAddress(input: string): string {
  return input.trim().toLowerCase()
}

export type AbhaAddressCheck = {
  value: string
  valid: boolean
  handle: string
  /** The part after `@`, or "" when the user typed a bare handle. */
  domain: string
}

export function checkAbhaAddress(input: string): AbhaAddressCheck {
  const value = normalizeAbhaAddress(input)
  const at = value.indexOf("@")
  const handle = at === -1 ? value : value.slice(0, at)
  const domain = at === -1 ? "" : value.slice(at + 1)

  // A second `@` is always a mistake — catch it before the regexes,
  // which would otherwise reject it with a less obvious reason.
  const valid =
    value.indexOf("@") === value.lastIndexOf("@") &&
    ABHA_HANDLE.test(handle) &&
    (domain === "" || ABHA_DOMAIN.test(domain))

  return { value, valid, handle, domain }
}

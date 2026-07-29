/**
 * Consent vocabulary shared by the server action and the client UI.
 *
 * This lives outside `src/actions/abdm.ts` on purpose: a `"use server"` module
 * may only export async functions. A plain const exported from there is
 * rewritten into an action reference, and the client receives a function where
 * it expected an array — which type-checks perfectly and fails at runtime.
 */

/** ABDM health-information types a clinic can request. */
export const HI_TYPES = [
  "OPConsultation",
  "Prescription",
  "DiagnosticReport",
  "DischargeSummary",
  "ImmunizationRecord",
] as const

export type HiType = (typeof HI_TYPES)[number]

/** ABDM purpose-of-use code for ordinary care delivery. */
export const PURPOSE_CARE_MANAGEMENT = "CAREMGT"

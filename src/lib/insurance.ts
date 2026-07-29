/**
 * Claim vocabulary shared by the server actions and the client UI.
 *
 * Kept out of `src/actions/insurance.ts` because a `"use server"` module may
 * only export async functions — a plain const there becomes an action
 * reference and reaches the client as a function.
 */

import { TONE } from "@/lib/status"

export const CLAIM_STATUSES = [
  "draft",
  "preauth_requested",
  "preauth_approved",
  "preauth_rejected",
  "submitted",
  "queried",
  "approved",
  "settled",
  "rejected",
] as const

export type ClaimStatus = (typeof CLAIM_STATUSES)[number]

export const CLAIM_STATUS_LABELS: Record<ClaimStatus, string> = {
  draft: "Draft",
  preauth_requested: "Pre-auth requested",
  preauth_approved: "Pre-auth approved",
  preauth_rejected: "Pre-auth rejected",
  submitted: "Submitted",
  queried: "Queried",
  approved: "Approved",
  settled: "Settled",
  rejected: "Rejected",
}

export const CLAIM_STATUS_TONE: Record<ClaimStatus, keyof typeof TONE> = {
  draft: "info",
  preauth_requested: "info",
  preauth_approved: "success",
  preauth_rejected: "danger",
  submitted: "info",
  queried: "warning",
  approved: "success",
  settled: "success",
  rejected: "danger",
}

/**
 * The statuses a claim can move to from where it is.
 *
 * Deliberately permissive rather than a strict machine: real TPA workflows
 * loop (queried → resubmitted → queried again), and a rigid graph would just
 * make the software wrong about the clinic's actual situation.
 */
export const CLAIM_NEXT: Record<ClaimStatus, ClaimStatus[]> = {
  draft: ["preauth_requested", "submitted", "rejected"],
  preauth_requested: ["preauth_approved", "preauth_rejected", "queried"],
  preauth_approved: ["submitted", "queried"],
  preauth_rejected: ["preauth_requested", "submitted", "rejected"],
  submitted: ["queried", "approved", "rejected"],
  queried: ["submitted", "approved", "rejected"],
  approved: ["settled", "queried"],
  settled: ["queried"],
  rejected: ["preauth_requested", "submitted"],
}

export const PAYER_KINDS = ["tpa", "insurer", "government", "corporate"] as const
export type PayerKind = (typeof PAYER_KINDS)[number]

export const PAYER_KIND_LABELS: Record<PayerKind, string> = {
  tpa: "TPA",
  insurer: "Insurer",
  government: "Government scheme",
  corporate: "Corporate",
}

/** A claim counts as outstanding until it is settled or written off. */
export function isOutstanding(status: string): boolean {
  return status !== "settled" && status !== "rejected"
}

/**
 * What the payer still owes on a claim.
 *
 * Falls back down the chain approved → claimed, because a claim that has not
 * been approved yet is still money the clinic is waiting on — treating it as
 * zero would flatter the outstanding total.
 */
export function outstandingAmount(claim: {
  status: string
  claimed_amount: number | string
  approved_amount: number | string | null
  settled_amount: number | string | null
}): number {
  if (!isOutstanding(claim.status)) return 0
  const expected =
    claim.approved_amount != null ? Number(claim.approved_amount) : Number(claim.claimed_amount)
  const settled = claim.settled_amount != null ? Number(claim.settled_amount) : 0
  return Math.max(0, expected - settled)
}

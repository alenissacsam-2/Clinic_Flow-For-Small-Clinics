import type { Enums } from "@/types/database"

/**
 * Single source of truth for status colour and wording.
 *
 * Before this, the same appointment-status map was duplicated in the queue and
 * the calendar, and invoice/message statuses used raw Tailwind palette colours
 * that had no relationship to the theme. Everything here is expressed in
 * semantic tokens (`--success` / `--warning` / `--info` / `--destructive`), so
 * status colours move with the theme instead of drifting from it.
 *
 * Class strings are spelled out in full on purpose — Tailwind only generates
 * classes it can find as literals in the source, so `text-${token}` would
 * compile to nothing.
 */
export type StatusStyle = {
  /** Human-facing wording. */
  label: string
  /** Bare coloured text, for inline use. */
  text: string
  /** Tinted chip, pair with `<Badge variant="outline">`. */
  badge: string
  /** Solid fill for the left status rail on queue / calendar rows. */
  rail?: string
}

const MUTED = {
  text: "text-muted-foreground",
  badge: "border-transparent bg-muted text-muted-foreground",
  rail: "bg-border",
} as const

export const APPOINTMENT_STATUS: Record<Enums<"appointment_status">, StatusStyle> = {
  pending: {
    label: "Pending",
    text: "text-warning",
    badge: "border-transparent bg-warning/10 text-warning",
    rail: "bg-warning",
  },
  confirmed: {
    label: "Confirmed",
    text: "text-info",
    badge: "border-transparent bg-info/10 text-info",
    rail: "bg-info",
  },
  arrived: {
    label: "Waiting",
    text: "text-primary",
    badge: "border-transparent bg-primary/10 text-primary",
    rail: "bg-primary",
  },
  // The one in-flight state — solid fill so the current patient is unmistakable.
  in_progress: {
    label: "In consultation",
    text: "text-primary",
    badge: "border-transparent bg-primary text-primary-foreground",
    rail: "bg-primary",
  },
  completed: {
    label: "Completed",
    text: "text-success",
    badge: "border-transparent bg-success/10 text-success",
    rail: "bg-success",
  },
  no_show: { label: "No-show", ...MUTED },
  cancelled: { label: "Cancelled", ...MUTED },
}

export const INVOICE_STATUS: Record<Enums<"invoice_status">, StatusStyle> = {
  unpaid: {
    label: "Unpaid",
    text: "text-destructive",
    badge: "border-transparent bg-destructive/10 text-destructive",
  },
  partial: {
    label: "Partial",
    text: "text-warning",
    badge: "border-transparent bg-warning/10 text-warning",
  },
  paid: {
    label: "Paid",
    text: "text-success",
    badge: "border-transparent bg-success/10 text-success",
  },
  void: { label: "Void", ...MUTED },
}

export const MESSAGE_STATUS: Record<Enums<"wa_status">, StatusStyle> = {
  queued: { label: "Queued", ...MUTED },
  sending: {
    label: "Sending",
    text: "text-info",
    badge: "border-transparent bg-info/10 text-info",
  },
  sent: {
    label: "Sent",
    text: "text-info",
    badge: "border-transparent bg-info/10 text-info",
  },
  delivered: {
    label: "Delivered",
    text: "text-success",
    badge: "border-transparent bg-success/10 text-success",
  },
  read: {
    label: "Read",
    text: "text-success",
    badge: "border-transparent bg-success/10 text-success",
  },
  failed: {
    label: "Failed",
    text: "text-destructive",
    badge: "border-transparent bg-destructive/10 text-destructive",
  },
}

/**
 * Tone recipes for surfaces that aren't a status per se — success screens,
 * alert banners, allergy/condition chips.
 */
export const TONE = {
  success: {
    text: "text-success",
    tint: "bg-success/10 text-success",
    banner: "border-success/25 bg-success/10",
  },
  warning: {
    text: "text-warning",
    tint: "bg-warning/10 text-warning",
    banner: "border-warning/30 bg-warning/10",
  },
  info: {
    text: "text-info",
    tint: "bg-info/10 text-info",
    banner: "border-info/25 bg-info/10",
  },
  danger: {
    text: "text-destructive",
    tint: "bg-destructive/10 text-destructive",
    banner: "border-destructive/25 bg-destructive/10",
  },
} as const

import { z } from "zod"
import { normalizePhone } from "@/lib/format"
import { checkAbhaNumber, checkAbhaAddress } from "@/lib/abdm/abha"

export const patientSchema = z.object({
  full_name: z.string().trim().min(2, "Name is required"),
  phone: z
    .string()
    .trim()
    .min(1, "Mobile number is required")
    .transform((v, ctx) => {
      try {
        return normalizePhone(v)
      } catch {
        ctx.addIssue({ code: "custom", message: "Enter a valid 10-digit mobile number" })
        return z.NEVER
      }
    }),
  gender: z.enum(["male", "female", "other"]).optional().or(z.literal("")),
  age_years: z.coerce.number().int().min(0).max(120).optional().or(z.literal("")),
  dob: z.string().optional().or(z.literal("")),
  address: z.string().optional(),
  blood_group: z.string().optional(),
  allergies: z.string().optional(),
  chronic_conditions: z.string().optional(),
  // ABHA identity is optional everywhere. We reject a wrong *shape*, but the
  // Verhoeff check digit is only ever surfaced as an advisory on the profile —
  // blocking a save on our reading of the checksum spec would be the worse
  // failure. See src/lib/abdm/abha.ts.
  abha_number: z
    .string()
    .trim()
    .optional()
    .transform((v, ctx) => {
      if (!v) return ""
      const res = checkAbhaNumber(v)
      if (!res.wellFormed) {
        ctx.addIssue({ code: "custom", message: "An ABHA number is 14 digits" })
        return z.NEVER
      }
      return res.value
    }),
  abha_address: z
    .string()
    .trim()
    .optional()
    .transform((v, ctx) => {
      if (!v) return ""
      const res = checkAbhaAddress(v)
      if (!res.valid) {
        ctx.addIssue({
          code: "custom",
          message: "An ABHA address is 8–18 characters, starts with a letter, e.g. aarav.shah@sbx",
        })
        return z.NEVER
      }
      return res.value
    }),
  tags: z.string().optional(), // comma-separated in the form
  whatsapp_opt_in: z.union([z.literal("on"), z.boolean()]).optional(),
  notes: z.string().optional(),
})

export type PatientInput = z.infer<typeof patientSchema>

export function parseTags(raw?: string): string[] {
  if (!raw) return []
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 10)
}

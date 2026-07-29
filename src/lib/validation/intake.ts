import { z } from "zod"

/** Pre-visit intake payload — all fields optional; the patient fills what they can. */
export const intakeSchema = z.object({
  age_years: z
    .string()
    .regex(/^\d{1,3}$/)
    .optional()
    .or(z.literal("")),
  dob: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal("")),
  gender: z.enum(["male", "female", "other"]).optional().or(z.literal("")),
  allergies: z.string().max(500).optional(),
  complaints: z.string().max(1000).optional(),
  medicines: z.string().max(1000).optional(),
})

export type IntakePayload = z.infer<typeof intakeSchema>

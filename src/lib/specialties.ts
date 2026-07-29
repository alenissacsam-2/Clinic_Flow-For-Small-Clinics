/**
 * Specialty presets for onboarding. Picking one prefills sensible defaults so a
 * dentist and a physician don't start from the same blank slate. Everything
 * stays editable afterwards; "Other" applies no preset.
 */
export type Specialty = {
  label: string
  defaultSlotMinutes: number
  defaultFee: number
}

export const SPECIALTIES: Specialty[] = [
  { label: "General Physician", defaultSlotMinutes: 15, defaultFee: 300 },
  { label: "Pediatrician", defaultSlotMinutes: 15, defaultFee: 400 },
  { label: "Dentist", defaultSlotMinutes: 30, defaultFee: 500 },
  { label: "Gynecologist", defaultSlotMinutes: 20, defaultFee: 600 },
  { label: "Dermatologist", defaultSlotMinutes: 15, defaultFee: 500 },
  { label: "ENT Specialist", defaultSlotMinutes: 15, defaultFee: 400 },
  { label: "Orthopedic", defaultSlotMinutes: 20, defaultFee: 600 },
  { label: "Cardiologist", defaultSlotMinutes: 20, defaultFee: 800 },
  { label: "Psychiatrist", defaultSlotMinutes: 30, defaultFee: 1000 },
  { label: "Ophthalmologist", defaultSlotMinutes: 15, defaultFee: 400 },
  { label: "Physiotherapist", defaultSlotMinutes: 30, defaultFee: 400 },
  { label: "General Surgeon", defaultSlotMinutes: 20, defaultFee: 600 },
  { label: "Other", defaultSlotMinutes: 15, defaultFee: 300 },
]

export function specialtyPreset(label: string | null | undefined): Specialty | undefined {
  if (!label) return undefined
  return SPECIALTIES.find((s) => s.label === label)
}

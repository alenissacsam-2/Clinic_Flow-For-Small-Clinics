"use server"

import { requireClinic } from "@/lib/clinic"
import { structureConsultation, aiConfigured } from "@/lib/ai/scribe"
import type { ScribeResult } from "@/lib/ai/types"

export type ScribeState = {
  result?: ScribeResult
  error?: string
  /** True when no API key is configured — the feature is off, not broken. */
  unavailable?: boolean
}

/**
 * Structure a dictated consultation.
 *
 * Only the transcript text reaches this action — the browser does the speech
 * recognition, so no audio of a consultation is ever transmitted.
 */
export async function structureDictation(transcript: string): Promise<ScribeState> {
  await requireClinic()

  const res = await structureConsultation(transcript)
  if (res === null) return { unavailable: true }
  if (res.error) return { error: res.error }
  return { result: res.result }
}

export async function scribeAvailable(): Promise<boolean> {
  return aiConfigured()
}

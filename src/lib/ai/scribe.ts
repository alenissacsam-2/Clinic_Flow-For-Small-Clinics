import "server-only"
import { parseScribeJson } from "./parse"
import type { ScribeResult } from "./types"

/**
 * AI scribe — turns a dictated consultation into structured fields.
 *
 * ── Three deliberate constraints ─────────────────────────────────────
 * 1. **Nothing is ever applied automatically.** The model returns a
 *    suggestion; the doctor reviews each field and chooses to accept it. A
 *    model that silently fills in a diagnosis is a model that eventually
 *    fills in the wrong one, unnoticed.
 * 2. **Audio never leaves the device.** Transcription is done by the browser's
 *    own speech recognition; only the resulting *text* is sent here. There is
 *    no second vendor and no recording of a consultation in transit.
 * 3. **Medicines are returned as plain names, never as a prescription.** The
 *    model does not choose doses. Whatever it suggests still goes through the
 *    normal medicine picker and the Wave 1 allergy/interaction screening.
 *
 * Dry-run: with no API key configured the feature is simply off, and the UI
 * says so, in the same shape as the WhatsApp and ABDM clients.
 */

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5"
const MAX_TRANSCRIPT = 8000

export function aiConfigured(): boolean {
  const k = process.env.ANTHROPIC_API_KEY
  return Boolean(k && !k.startsWith("PASTE_") && !k.startsWith("your-"))
}

const SYSTEM = `You structure a doctor's dictated consultation note into fields for an Indian outpatient clinic record.

Return ONLY a JSON object with these keys:
  "complaints": string  — the presenting complaints, in the doctor's own words, tidied
  "diagnosis": string   — the diagnosis IF the doctor stated one, else ""
  "advice": string      — lifestyle/follow-up advice IF stated, else ""
  "medicines": string[] — medicine names the doctor named, as spoken

Rules you must follow:
- Never infer a diagnosis the doctor did not state. An empty string is correct and expected.
- Never invent, add, or "complete" a medicine the doctor did not name.
- Never include a dose, frequency or duration. Names only.
- Do not translate. Keep the doctor's language and clinical shorthand.
- If the transcript is not a consultation note, return empty strings and an empty array.`

/**
 * Ask the model to structure a transcript.
 *
 * Returns null when the feature is not configured, so callers can distinguish
 * "off" from "failed" — telling a doctor a request failed when the key was
 * never set would send them debugging the wrong thing.
 */
export async function structureConsultation(
  transcript: string,
): Promise<{ result?: ScribeResult; error?: string } | null> {
  if (!aiConfigured()) return null

  const text = transcript.trim().slice(0, MAX_TRANSCRIPT)
  if (!text) return { error: "Nothing was dictated." }

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system: SYSTEM,
        messages: [{ role: "user", content: text }],
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      return { error: `The assistant is unavailable (HTTP ${res.status}). ${body.slice(0, 160)}` }
    }

    const json = (await res.json()) as { content?: { type: string; text?: string }[] }
    const raw = json.content?.find((c) => c.type === "text")?.text ?? ""
    return { result: parseScribeJson(raw) }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Network error" }
  }
}

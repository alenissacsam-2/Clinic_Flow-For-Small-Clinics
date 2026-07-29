"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { toast } from "sonner"
import { Mic, MicOff, Sparkles, Check } from "lucide-react"
import { structureDictation } from "@/actions/scribe"
import type { ScribeResult } from "@/lib/ai/types"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TONE } from "@/lib/status"
import { cn } from "@/lib/utils"

/** Minimal shape of the Web Speech API — it has no DOM lib types. */
type SpeechRecognitionLike = {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
}

function speechRecognition(): SpeechRecognitionLike | null {
  if (typeof window === "undefined") return null
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike
    webkitSpeechRecognition?: new () => SpeechRecognitionLike
  }
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition
  return Ctor ? new Ctor() : null
}

export type Applied = {
  complaints?: string
  diagnosis?: string
  advice?: string
  medicines?: string[]
}

/**
 * Dictate a consultation and get structured fields back to review.
 *
 * **Nothing is applied automatically.** Each suggestion has its own Apply
 * button, and the panel says plainly that the doctor's own words are the
 * record. Speech recognition runs in the browser, so no audio of a
 * consultation is transmitted anywhere — only the transcript text.
 */
export function DictationPanel({
  available,
  onApply,
}: {
  available: boolean
  onApply: (patch: Applied) => void
}) {
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState("")
  const [result, setResult] = useState<ScribeResult | null>(null)
  const [pending, start] = useTransition()
  const recRef = useRef<SpeechRecognitionLike | null>(null)
  const [supported, setSupported] = useState(true)

  useEffect(() => {
    // Feature detection in an effect, not during render — the check touches
    // `window` and must not run on the server.
    const t = setTimeout(() => setSupported(speechRecognition() !== null), 0)
    return () => clearTimeout(t)
  }, [])

  function toggle() {
    if (listening) {
      recRef.current?.stop()
      setListening(false)
      return
    }
    const rec = speechRecognition()
    if (!rec) {
      toast.error("This browser cannot do speech recognition. Type or paste the note instead.")
      return
    }
    // Indian English handles clinical shorthand and most code-switching better
    // than en-US here.
    rec.lang = "en-IN"
    rec.continuous = true
    rec.interimResults = false
    rec.onresult = (e) => {
      let chunk = ""
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) chunk += e.results[i][0].transcript
      }
      if (chunk) setTranscript((prev) => (prev ? `${prev} ${chunk}` : chunk))
    }
    rec.onerror = (e) => {
      setListening(false)
      if (e.error !== "aborted") toast.error("Could not hear that. Check the microphone permission.")
    }
    rec.onend = () => setListening(false)
    recRef.current = rec
    rec.start()
    setListening(true)
  }

  function structure() {
    start(async () => {
      const res = await structureDictation(transcript)
      if (res.unavailable) {
        toast.error("The assistant is not configured on this deployment.")
        return
      }
      if (res.error) {
        toast.error(res.error)
        return
      }
      setResult(res.result ?? null)
    })
  }

  if (!available) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" /> Dictate
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant={listening ? "destructive" : "outline"} size="sm" onClick={toggle}>
            {listening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
            {listening ? "Stop" : "Start dictating"}
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={pending || !transcript.trim()}
            onClick={structure}
          >
            {pending ? "Reading…" : "Structure this"}
          </Button>
          {transcript && (
            <Button type="button" variant="ghost" size="sm" onClick={() => { setTranscript(""); setResult(null) }}>
              Clear
            </Button>
          )}
        </div>

        {!supported && (
          <p className="text-xs text-muted-foreground">
            This browser cannot transcribe speech. You can still type or paste a note below.
          </p>
        )}

        <Textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          rows={3}
          placeholder="Dictated note appears here — you can edit it before structuring."
          aria-label="Dictated note"
        />

        {result && (
          <div className="space-y-2 rounded-xl border border-edge/15 bg-background/45 p-4 shadow-nm-inset">
            <Suggestion
              label="Complaints"
              value={result.complaints}
              onApply={() => onApply({ complaints: result.complaints })}
            />
            <Suggestion
              label="Diagnosis"
              value={result.diagnosis}
              onApply={() => onApply({ diagnosis: result.diagnosis })}
            />
            <Suggestion
              label="Advice"
              value={result.advice}
              onApply={() => onApply({ advice: result.advice })}
            />
            <Suggestion
              label="Medicines"
              value={result.medicines.join(", ")}
              onApply={() => onApply({ medicines: result.medicines })}
            />
            <p className={cn("rounded-md p-2 text-xs", TONE.warning.banner)}>
              Suggestions only — nothing has been filled in. Check each one before you accept it.
              Medicine names carry no dose and still go through the usual allergy and interaction
              checks.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function Suggestion({
  label,
  value,
  onApply,
}: {
  label: string
  value: string
  onApply: () => void
}) {
  if (!value) {
    return (
      <p className="text-xs text-muted-foreground">
        <span className="font-medium">{label}:</span> nothing stated
      </p>
    )
  }
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="min-w-0 flex-1">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className="block">{value}</span>
      </span>
      <Button type="button" variant="outline" size="sm" onClick={onApply}>
        <Check className="size-3.5" /> Apply
      </Button>
    </div>
  )
}

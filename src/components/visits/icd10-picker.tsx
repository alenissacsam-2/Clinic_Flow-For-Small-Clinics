"use client"

import { useEffect, useRef, useState } from "react"
import { X, Tag } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Input } from "@/components/ui/input"

type Code = { code: string; title: string; chapter: string | null }

/**
 * Optional ICD-10 coding alongside the free-text diagnosis.
 *
 * Coding is what makes a diagnosis exchangeable (FHIR Condition), claimable
 * (NHCX) and countable (analytics) — free text is none of those. It stays
 * strictly additive: the doctor's own wording remains the primary record, and
 * a doctor who ignores this control loses nothing.
 */
export function Icd10Picker({
  value,
  onChange,
}: {
  value: string[]
  onChange: (codes: string[]) => void
}) {
  const [term, setTerm] = useState("")
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<Code[]>([])
  const [labels, setLabels] = useState<Record<string, string>>({})
  const boxRef = useRef<HTMLDivElement>(null)

  // Resolve titles for codes loaded from an existing visit.
  const missing = value.filter((c) => !labels[c]).join(",")
  useEffect(() => {
    if (!missing) return
    const supabase = createClient()
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("icd10_codes")
        .select("code, title")
        .in("code", missing.split(","))
      if (data) {
        setLabels((prev) => ({
          ...prev,
          ...Object.fromEntries(data.map((d) => [d.code, d.title])),
        }))
      }
    }, 0)
    return () => clearTimeout(t)
  }, [missing])

  useEffect(() => {
    if (!open) return
    const supabase = createClient()
    const t = setTimeout(async () => {
      const q = term.trim()
      let query = supabase.from("icd10_codes").select("code, title, chapter").limit(8)
      // Short input is usually the start of a code ("J06"); longer is a phrase.
      if (q) query = query.or(`code.ilike.${q}%,title.ilike.%${q}%`)
      const { data } = await query.order("code")
      setResults(data ?? [])
    }, 200)
    return () => clearTimeout(t)
  }, [term, open])

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [])

  function add(c: Code) {
    setLabels((prev) => ({ ...prev, [c.code]: c.title }))
    if (!value.includes(c.code)) onChange([...value, c.code])
    setTerm("")
    setOpen(false)
  }

  return (
    <div className="space-y-2">
      <div ref={boxRef} className="relative">
        <Input
          value={term}
          placeholder="Add ICD-10 code — search by code or condition"
          onChange={(e) => {
            setTerm(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          autoComplete="off"
        />
        {open && results.length > 0 && (
          <ul className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-edge/25 bg-popover p-1.5 shadow-nm-float">
            {results.map((c) => (
              <li key={c.code}>
                <button
                  type="button"
                  className="flex w-full items-baseline gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
                  onClick={() => add(c)}
                >
                  <span className="shrink-0 font-mono text-xs font-semibold text-primary">
                    {c.code}
                  </span>
                  <span className="truncate">{c.title}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {value.map((code) => (
            <li
              key={code}
              className="inline-flex items-center gap-1.5 rounded-full bg-accent py-0.5 pl-2 pr-1 text-xs text-accent-foreground"
            >
              <Tag className="size-3 shrink-0" />
              <span className="font-mono font-semibold">{code}</span>
              {labels[code] && <span className="max-w-56 truncate">{labels[code]}</span>}
              <button
                type="button"
                aria-label={`Remove ${code}`}
                onClick={() => onChange(value.filter((c) => c !== code))}
                className="rounded-full p-0.5 transition-colors hover:bg-primary/15"
              >
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

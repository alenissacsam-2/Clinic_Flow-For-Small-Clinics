"use client"

import { useEffect, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Input } from "@/components/ui/input"

export type Med = {
  id: string
  name: string
  form: string | null
  strength: string | null
  composition: string | null
}

/**
 * Free-text medicine input with a suggestion dropdown backed by the seeded
 * medicine list (global + clinic rows). Doctors can type anything; suggestions
 * just speed up common entries.
 *
 * `onChange` receives the picked row as a second argument when the name came
 * from a suggestion, so the caller can use its `composition` for allergy and
 * interaction checks without a second lookup. Hand-typed names arrive without
 * it and are resolved server-side instead.
 */
export function MedicineCombobox({
  value,
  onChange,
  placeholder = "Medicine name",
}: {
  value: string
  onChange: (name: string, med?: Med) => void
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<Med[]>([])
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const supabase = createClient()
    const t = setTimeout(async () => {
      const term = value.trim()
      let q = supabase
        .from("medicines")
        .select("id, name, form, strength, composition")
        // A clinic's own additions outrank the shared seed list.
        .order("clinic_id", { ascending: true, nullsFirst: false })
        .order("name")
        .limit(8)
      if (term) q = q.ilike("name", `%${term}%`)
      const { data } = await q
      setResults(data ?? [])
    }, 150)
    return () => clearTimeout(t)
  }, [value, open])

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [])

  return (
    <div ref={boxRef} className="relative">
      <Input
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        autoComplete="off"
      />
      {open && results.length > 0 && (
        <ul className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-edge/25 bg-popover p-1.5 shadow-nm-float">
          {results.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                className="flex w-full flex-col items-start gap-0.5 rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
                onClick={() => {
                  onChange([m.name, m.strength].filter(Boolean).join(" "), m)
                  setOpen(false)
                }}
              >
                <span className="flex w-full items-center justify-between gap-2">
                  <span className="truncate">{m.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {[m.form, m.strength].filter(Boolean).join(" · ")}
                  </span>
                </span>
                {/* The ingredient line is what safety checks actually match on,
                    so showing it makes brand→generic obvious at the point of use. */}
                {m.composition && m.composition !== m.name && (
                  <span className="truncate text-xs text-muted-foreground">{m.composition}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

"use client"

import { useEffect, useState } from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { formatPhoneDisplay } from "@/lib/format"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

export type PickedPatient = { id: string; full_name: string; phone: string }

export function PatientPicker({
  value,
  onChange,
}: {
  value?: PickedPatient | null
  onChange: (p: PickedPatient | null) => void
}) {
  const [open, setOpen] = useState(false)
  const [term, setTerm] = useState("")
  const [results, setResults] = useState<PickedPatient[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    const t = setTimeout(async () => {
      setLoading(true)
      let q = supabase
        .from("patients")
        .select("id, full_name, phone")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(20)
      if (term.trim()) q = q.or(`full_name.ilike.%${term.trim()}%,phone.ilike.%${term.trim()}%`)
      const { data } = await q
      setResults(data ?? [])
      setLoading(false)
    }, 200)
    return () => clearTimeout(t)
  }, [term, open])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
            {value ? (
              <span className="truncate">
                {value.full_name}{" "}
                <span className="text-muted-foreground">· {formatPhoneDisplay(value.phone)}</span>
              </span>
            ) : (
              <span className="text-muted-foreground">Search patient…</span>
            )}
            <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
          </Button>
        }
      />
      <PopoverContent className="w-(--anchor-width) min-w-64 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Name or mobile…" value={term} onValueChange={setTerm} />
          <CommandList>
            <CommandEmpty>{loading ? "Searching…" : "No patients found."}</CommandEmpty>
            <CommandGroup>
              {results.map((p) => (
                <CommandItem
                  key={p.id}
                  value={p.id}
                  onSelect={() => {
                    onChange(p)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn("size-4", value?.id === p.id ? "opacity-100" : "opacity-0")}
                  />
                  <span>{p.full_name}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {formatPhoneDisplay(p.phone)}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

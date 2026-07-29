"use client"

import { useRouter } from "next/navigation"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"

/** Prev / Today / Next date navigation; pushes ?date=yyyy-MM-dd. */
export function DateNav({ dateKey, title }: { dateKey: string; title: string }) {
  const router = useRouter()

  function go(offsetDays: number) {
    const [y, m, d] = dateKey.split("-").map(Number)
    const cursor = new Date(Date.UTC(y, m - 1, d, 12))
    cursor.setUTCDate(cursor.getUTCDate() + offsetDays)
    const next = cursor.toISOString().slice(0, 10)
    router.push(`/calendar?date=${next}`)
  }

  function today() {
    const now = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date())
    router.push(`/calendar?date=${now}`)
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="icon" onClick={() => go(-1)} aria-label="Previous day">
        <ChevronLeft className="size-4" />
      </Button>
      <div className="min-w-40 text-center text-sm font-medium">{title}</div>
      <Button variant="outline" size="icon" onClick={() => go(1)} aria-label="Next day">
        <ChevronRight className="size-4" />
      </Button>
      <Button variant="ghost" size="sm" onClick={today}>
        Today
      </Button>
    </div>
  )
}

import Link from "next/link"
import { cn } from "@/lib/utils"

export type FilterOption = { key?: string; label: string; href: string }

/**
 * The segmented pill row used to filter list pages (billing, and anywhere else
 * that needs URL-driven tabs). Server component — renders plain links so it
 * works without client JS and survives back/forward.
 */
export function FilterChips({
  options,
  activeKey,
}: {
  options: FilterOption[]
  activeKey?: string
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = o.key === activeKey || (!o.key && !activeKey)
        return (
          <Link
            key={o.label}
            href={o.href}
            className={cn(
              "rounded-full border px-3 py-1 text-sm transition-colors",
              active
                ? "border-primary bg-accent text-accent-foreground"
                : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {o.label}
          </Link>
        )
      })}
    </div>
  )
}

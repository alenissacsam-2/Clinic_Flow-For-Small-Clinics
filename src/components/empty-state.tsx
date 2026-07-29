import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Shared empty state. Every "nothing here yet" surface used to be a grey
 * one-liner; this gives them an icon, a voice, and somewhere to go next.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "relative flex flex-col items-center overflow-hidden rounded-xl border border-dashed border-border bg-card/60 px-6 py-14 text-center",
        className,
      )}
    >
      {/* A ghost of the ruled register, so even empty pages carry the brand. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-ruled opacity-40" />
      <div className="relative flex flex-col items-center">
        {Icon && (
          <span className="mb-4 flex size-11 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <Icon className="size-5" />
          </span>
        )}
        <p className="font-heading text-base font-semibold">{title}</p>
        {description && (
          <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{description}</p>
        )}
        {action && <div className="mt-5">{action}</div>}
      </div>
    </div>
  )
}

import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export function PageHeader({
  title,
  description,
  children,
  backHref,
  backLabel,
}: {
  title: string
  description?: string
  children?: React.ReactNode
  backHref?: string
  backLabel?: string
}) {
  return (
    <div className="mb-6">
      {backHref && (
        <Link
          href={backHref}
          className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> {backLabel ?? "Back"}
        </Link>
      )}
      <div className="flex flex-col gap-3 border-b border-edge/20 pb-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Accent rule beside every page title — the one place the indigo
            appears at full strength in the chrome, so it reads as a system
            marker rather than an alert. */}
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="mt-1 h-7 w-1 shrink-0 rounded-full bg-gradient-to-b from-primary to-[color-mix(in_oklab,var(--primary),var(--chart-3)_60%)]"
          />
          <div>
            <h1 className="font-heading text-2xl font-bold tracking-[-0.03em]">{title}</h1>
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
        </div>
        {children && <div className="flex items-center gap-2">{children}</div>}
      </div>
    </div>
  )
}

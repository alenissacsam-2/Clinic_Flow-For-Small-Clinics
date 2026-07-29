import { cn } from "@/lib/utils"

/**
 * Wrapper for the three no-login patient pages (book / intake / pay), which
 * previously each carried their own copy of this markup.
 *
 * The ruled-paper motif is confined to a band behind the header card: it keeps
 * the ClinicFlow character without putting texture behind form fields, which
 * matters on the low-end Android screens most patients will use.
 */
export function PublicShell({
  children,
  width = "lg",
  logo = null,
  brandName = "",
}: {
  children: React.ReactNode
  width?: "md" | "lg"
  logo?: string | null
  brandName?: string
}) {
  return (
    <div className="relative min-h-screen bg-background py-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-56 overflow-hidden">
        <div className="h-full w-full bg-ruled" />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-background" />
      </div>

      <div
        className={cn(
          "relative mx-auto w-full px-4",
          width === "md" ? "max-w-md" : "max-w-lg",
        )}
      >
        {logo && (
          <div className="mb-4 flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logo}
              alt={brandName}
              className="animate-pop size-16 rounded-xl border border-border bg-card object-cover shadow-sm"
            />
          </div>
        )}
        {children}
        <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/mark.png" alt="" className="size-4 object-contain" />
          Powered by ClinicFlow
        </p>
      </div>
    </div>
  )
}

/** Card surface shared by the public pages. */
export function PublicCard({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("rounded-xl border border-border bg-card p-6 shadow-sm", className)}>
      {children}
    </div>
  )
}

import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

/**
 * Page-through for the long list screens.
 *
 * ── The bug this exists to fix ────────────────────────────────────────────
 * Billing, Patients, Messages and Insurance all ended their query with a bare
 * `.limit(100)` and rendered whatever came back. That is not a page size, it
 * is **silent truncation**: a clinic with 400 invoices got exactly the newest
 * hundred, with nothing on screen saying so, and an invoice from three months
 * ago was simply unreachable through the UI. Caught by seeding a realistic
 * amount of history and looking at the result — with 18 rows the screen is
 * indistinguishable from a correct one, which is the whole reason "looks fine
 * empty" is not verification.
 *
 * Rendered only when there is more than one page, so a small clinic never sees
 * chrome it does not need.
 *
 * Plain `<Link>`s, no client component: the list is a server render keyed on
 * `?page`, so links are the smallest correct implementation and they keep the
 * back button, shareable URLs, and no-JS working.
 */
export function Pagination({
  page,
  pageSize,
  total,
  /** Path plus any filter params already in play, e.g. `/billing?status=unpaid`. */
  baseHref,
  noun = "rows",
}: {
  page: number
  pageSize: number
  total: number
  baseHref: string
  noun?: string
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  const href = (p: number) => `${baseHref}${baseHref.includes("?") ? "&" : "?"}page=${p}`

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-edge/15 px-4 py-3">
      <p className="text-xs text-muted-foreground">
        Showing{" "}
        <span className="font-medium tabular-nums text-foreground">
          {from}–{to}
        </span>{" "}
        of <span className="font-medium tabular-nums text-foreground">{total}</span> {noun}
      </p>

      {pages > 1 && (
        <div className="flex items-center gap-2">
          <PageLink href={href(page - 1)} disabled={page <= 1} label="Previous">
            <ChevronLeft className="size-4" />
            Prev
          </PageLink>
          <span className="text-xs tabular-nums text-muted-foreground">
            {page} / {pages}
          </span>
          <PageLink href={href(page + 1)} disabled={page >= pages} label="Next">
            Next
            <ChevronRight className="size-4" />
          </PageLink>
        </div>
      )}
    </div>
  )
}

/**
 * A disabled control must not be a link. An `<a>` with no `href` is not
 * focusable and announces as plain text, which is right — there is nowhere to
 * go — whereas a link to page 0 would be a real, followable, wrong URL.
 */
function PageLink({
  href,
  disabled,
  label,
  children,
}: {
  href: string
  disabled: boolean
  label: string
  children: React.ReactNode
}) {
  const className = cn(buttonVariants({ variant: "outline", size: "sm" }), disabled && "opacity-40")
  if (disabled) {
    return (
      <span aria-disabled className={className}>
        {children}
      </span>
    )
  }
  return (
    <Link href={href} aria-label={label} className={className}>
      {children}
    </Link>
  )
}

/** Clamp a `?page=` string to a sane 1-based integer. */
export function parsePage(raw: string | undefined): number {
  const n = Number(raw)
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1
}

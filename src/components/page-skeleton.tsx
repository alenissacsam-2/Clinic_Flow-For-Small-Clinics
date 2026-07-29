import { Skeleton } from "@/components/ui/skeleton"

/**
 * Shared route-loading placeholder. Mirrors the real page rhythm (header,
 * optional stat row, then a list) so the layout doesn't jump on hydration.
 */
export function PageSkeleton({ stats = 0, rows = 5 }: { stats?: number; rows?: number }) {
  return (
    <div>
      <div className="mb-6 space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-56" />
      </div>

      {stats > 0 && (
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: stats }).map((_, i) => (
            <Skeleton key={i} className="h-[86px] rounded-lg" />
          ))}
        </div>
      )}

      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-lg" />
        ))}
      </div>
    </div>
  )
}

import { Skeleton } from "@/components/ui/skeleton";

type PageSkeletonVariant = "dashboard" | "table" | "detail" | "cards";

interface PageSkeletonProps {
  variant?: PageSkeletonVariant;
  /** Number of rows for the table variant (default 6) */
  rows?: number;
  /** Number of cards for the cards variant (default 4) */
  count?: number;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* 4 KPI cards in a row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border border-border/50 bg-card p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-20 bg-zinc-800" />
              <Skeleton className="h-4 w-4 rounded bg-zinc-800" />
            </div>
            <Skeleton className="h-7 w-24 bg-zinc-800" />
            <Skeleton className="h-2 w-16 bg-zinc-800" />
          </div>
        ))}
      </div>

      {/* Large chart area */}
      <div className="rounded-lg border border-border/50 bg-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-40 bg-zinc-800" />
          <Skeleton className="h-8 w-24 rounded bg-zinc-800" />
        </div>
        <Skeleton className="h-[200px] w-full rounded bg-zinc-800" />
      </div>

      {/* Table skeleton below */}
      <div className="rounded-lg border border-border/50 bg-card p-6 space-y-4">
        <Skeleton className="h-5 w-48 bg-zinc-800" />
        <div className="space-y-3">
          {/* Header row */}
          <div className="flex gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-3 flex-1 bg-zinc-800" />
            ))}
          </div>
          {/* Data rows */}
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-4">
              {Array.from({ length: 4 }).map((_, j) => (
                <Skeleton
                  key={j}
                  className="h-4 flex-1 bg-zinc-800"
                  style={{ opacity: 1 - i * 0.12 }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-40 bg-zinc-800" />
        <Skeleton className="h-8 w-28 rounded bg-zinc-800" />
      </div>

      {/* Table header */}
      <div className="rounded-lg border border-border/50 bg-card overflow-hidden">
        <div className="flex gap-4 px-4 py-3 border-b border-border/30">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-3 flex-1 bg-zinc-800" />
          ))}
        </div>

        {/* Table rows */}
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="flex gap-4 px-4 py-3 border-b border-border/20 last:border-b-0"
          >
            <Skeleton className="h-4 flex-[2] bg-zinc-800" />
            <Skeleton className="h-4 flex-1 bg-zinc-800" />
            <Skeleton className="h-4 flex-1 bg-zinc-800" />
            <Skeleton className="h-4 flex-1 bg-zinc-800" />
          </div>
        ))}
      </div>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      {/* Title skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-7 w-64 bg-zinc-800" />
        <Skeleton className="h-4 w-96 bg-zinc-800" />
      </div>

      {/* 2-column layout of details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-lg border border-border/50 bg-card p-6 space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-20 bg-zinc-800" />
              <Skeleton className="h-5 w-full bg-zinc-800" />
            </div>
          ))}
        </div>
        <div className="rounded-lg border border-border/50 bg-card p-6 space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-20 bg-zinc-800" />
              <Skeleton className="h-5 w-full bg-zinc-800" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-lg border border-border/50 bg-card p-5 space-y-4"
        >
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-lg bg-zinc-800" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-3/4 bg-zinc-800" />
              <Skeleton className="h-3 w-1/2 bg-zinc-800" />
            </div>
          </div>
          <Skeleton className="h-8 w-20 bg-zinc-800" />
          <Skeleton className="h-2 w-full rounded-full bg-zinc-800" />
        </div>
      ))}
    </div>
  );
}

export function PageSkeleton({
  variant = "table",
  rows,
  count,
}: PageSkeletonProps) {
  switch (variant) {
    case "dashboard":
      return <DashboardSkeleton />;
    case "table":
      return <TableSkeleton rows={rows} />;
    case "detail":
      return <DetailSkeleton />;
    case "cards":
      return <CardsSkeleton count={count} />;
    default:
      return <TableSkeleton rows={rows} />;
  }
}

export default PageSkeleton;

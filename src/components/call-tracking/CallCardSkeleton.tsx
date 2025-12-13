import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function CallCardSkeleton() {
  return (
    <Card className="p-4 space-y-3">
      {/* Row 1 */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Skeleton className="w-12 h-12 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Skeleton className="h-8 w-24" />
      </div>
      {/* Row 2 */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-28" />
      </div>
      {/* Row 3 */}
      <div className="flex items-center gap-4">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-4 w-24" />
      </div>
    </Card>
  );
}

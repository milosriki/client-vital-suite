import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Activity } from "lucide-react";

export function ExecutiveDashboardGhost() {
  return (
    <div className="p-6 space-y-6 bg-slate-50/50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-9 w-64 mb-2" />
          <Skeleton className="h-5 w-96" />
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-white text-transparent">
            <Skeleton className="h-4 w-32" />
          </Badge>
          <Button size="sm" variant="outline" disabled>
            <Activity className="mr-2 h-4 w-4 opacity-50" />
            Live Validation
          </Button>
        </div>
      </div>

      {/* Top Row: 5 Cards (Pulse Metrics) */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card
            key={i}
            className="shadow-sm h-full border-l-4 border-l-slate-200"
          >
            <CardHeader className="pb-2">
              <CardTitle className="flex justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4 rounded-full" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-32 mb-2" />
              <Skeleton className="h-3 w-40" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions Bar */}
      <div className="flex items-center gap-4 overflow-x-auto pb-2">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-9 w-48 rounded-md" />
        ))}
      </div>

      {/* Middle Row: System Health + Tabs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* System Health Monitor Ghost */}
        <div className="lg:col-span-1">
          <Card className="h-full">
            <CardHeader>
              <Skeleton className="h-6 w-48" />
            </CardHeader>
            <CardContent className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-2 w-2 rounded-full" />
                  <Skeleton className="h-4 w-full" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Main Dashboard Tabs Ghost */}
        <div className="lg:col-span-2">
          {/* Connection Diagnostics Placeholder */}
          <Skeleton className="h-10 w-full mb-4 rounded-lg" />

          <Card className="h-full">
            <CardHeader>
              <div className="flex items-center justify-between">
                <Skeleton className="h-6 w-40" />
                <div className="flex gap-2">
                  <Skeleton className="h-9 w-24" />
                  <Skeleton className="h-9 w-24" />
                  <Skeleton className="h-9 w-24" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[400px] w-full rounded-lg" />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Bottom Row: Super Intelligence Ghost */}
      <div className="grid grid-cols-1">
        <Card className="bg-slate-800 border-none">
          <CardHeader>
            <Skeleton className="h-6 w-56 bg-white/10" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <Skeleton className="h-4 w-full bg-white/10" />
                <Skeleton className="h-4 w-3/4 bg-white/10" />
                <Skeleton className="h-32 w-full rounded-lg bg-white/5" />
              </div>
              <div className="h-[400px] rounded-lg bg-white/10 overflow-hidden">
                <Skeleton className="h-full w-full bg-transparent" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

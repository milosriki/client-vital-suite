import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity, TrendingUp, Target, Brain } from "lucide-react";

export function MarketingIntelligenceGhost() {
  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-8 animate-in fade-in duration-500">
      {/* Header Ghost */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <Skeleton className="h-10 w-64 mb-2" />
          <Skeleton className="h-5 w-96" />
        </div>
        <div className="flex items-center gap-2 bg-card border rounded-lg p-1 shadow-sm">
          <Skeleton className="h-8 w-16 rounded" />
          <Skeleton className="h-8 w-16 rounded" />
          <Skeleton className="h-8 w-16 rounded" />
          <div className="w-px h-6 bg-border mx-1" />
          <Skeleton className="h-8 w-8 rounded" />
        </div>
      </div>

      {/* ZONE A: THE PULSE Ghost */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Activity className="h-5 w-5 text-muted-foreground/50" />
          <Skeleton className="h-6 w-32" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <Card key={i} className="h-full">
              <CardContent className="pt-6">
                <div className="flex justify-between items-start mb-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-8 w-8 rounded-full" />
                </div>
                <Skeleton className="h-8 w-24 mb-2" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* ZONE B: GROWTH ENGINE Ghost */}
        <section className="lg:col-span-2 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-5 w-5 text-muted-foreground/50" />
            <Skeleton className="h-6 w-40" />
          </div>

          <Card className="h-[400px]">
            <CardHeader>
              <Skeleton className="h-6 w-32 mb-2" />
              <Skeleton className="h-4 w-48" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 bg-muted/20 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <div>
                        <Skeleton className="h-4 w-32 mb-1" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                    <div className="text-right">
                      <Skeleton className="h-4 w-16 mb-1 ml-auto" />
                      <Skeleton className="h-5 w-20 ml-auto rounded-full" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ZONE C: FUNNEL TRUTH Ghost */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Target className="h-5 w-5 text-muted-foreground/50" />
            <Skeleton className="h-6 w-36" />
          </div>

          <Card className="h-[400px]">
            <CardHeader>
              <Skeleton className="h-6 w-32 mb-2" />
              <Skeleton className="h-4 w-40" />
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex flex-col gap-2">
                    <Skeleton className="h-12 w-full rounded-lg" />
                    {i < 4 && (
                      <Skeleton className="h-4 w-4 mx-auto rounded-full opacity-50" />
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>
      </div>

      {/* ZONE D: CREATIVE BRAIN Ghost */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Brain className="h-5 w-5 text-muted-foreground/50" />
          <Skeleton className="h-6 w-40" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="border-l-4 border-l-muted">
              <CardContent className="pt-6">
                <Skeleton className="h-6 w-3/4 mb-4" />
                <div className="grid grid-cols-3 gap-2">
                  {[1, 2, 3].map((j) => (
                    <div key={j}>
                      <Skeleton className="h-3 w-10 mb-1" />
                      <Skeleton className="h-5 w-16" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}

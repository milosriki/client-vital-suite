import { useState } from "react";
import { Users, Activity } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard/layout/DashboardHeader";
import { DataTableCard } from "@/components/dashboard/cards/DataTableCard";
import { MetricCard } from "@/components/dashboard/cards/MetricCard";
import { useCoachCommand } from "@/hooks/enterprise/useCoachCommand";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { CoachCapacityRecord } from "@/types/enterprise";

export default function CoachPerformance() {
  const [activeZone, setActiveZone] = useState<string | undefined>(undefined);
  const { coachLoad, segmentHud, totalCoaches, avgLoadDubai, avgLoadAD, isLoading } =
    useCoachCommand(activeZone);

  if (isLoading) {
    return (
      <div className="p-6 space-y-8 bg-background min-h-screen">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-[400px] rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 bg-background min-h-screen text-foreground">
      <DashboardHeader
        title="Coach Command"
        description="Real-time capacity and performance load balancing"
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard label="Active Coaches" value={totalCoaches} icon={Users} />
        <MetricCard
          label="Avg Load (Dubai)"
          value={`${avgLoadDubai}%`}
          delta={{
            value: avgLoadDubai > 80 ? 5 : -5,
            type: avgLoadDubai > 80 ? "negative" : "positive",
          }}
          icon={Activity}
        />
        <MetricCard
          label="Avg Load (Abu Dhabi)"
          value={`${avgLoadAD}%`}
          delta={{
            value: avgLoadAD > 80 ? 5 : -12,
            type: avgLoadAD > 80 ? "negative" : "positive",
          }}
          icon={Activity}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <DataTableCard<CoachCapacityRecord>
            title="Real-time Coach Load (14d Rolling)"
            data={coachLoad.data || []}
            columns={[
              {
                key: "coach_name",
                label: "Coach",
                render: (item) => (
                  <div>
                    <div className="font-bold text-sm">{item.coach_name}</div>
                    <div className="text-xs text-muted-foreground uppercase">
                      {item.zone} • {item.gender || "N/A"}
                    </div>
                  </div>
                ),
              },
              {
                key: "load_percentage",
                label: "Current Load",
                render: (item) => (
                  <div className="w-full max-w-[120px]">
                    <div className="flex justify-between text-xs mb-1">
                      <span
                        className={cn(
                          item.load_percentage > 90
                            ? "text-destructive"
                            : "text-muted-foreground"
                        )}
                      >
                        {item.load_percentage}%
                      </span>
                    </div>
                    <Progress
                      value={item.load_percentage}
                      className="h-1 bg-muted"
                      indicatorClassName={
                        item.load_percentage > 90
                          ? "bg-destructive"
                          : "bg-primary"
                      }
                    />
                  </div>
                ),
              },
              {
                key: "sessions_14d",
                label: "Sessions (14d)",
                render: (item) => (
                  <div className="font-mono text-sm">{item.sessions_14d}</div>
                ),
              },
              {
                key: "capacity_status",
                label: "Status",
                render: (item) => (
                  <Badge
                    variant={
                      item.capacity_status === "CRITICAL"
                        ? "destructive"
                        : "outline"
                    }
                    className="text-xs"
                  >
                    {item.capacity_status}
                  </Badge>
                ),
              },
            ]}
          />
        </div>

        <div className="space-y-6">
          <div className="p-6 rounded-2xl border border-border bg-card">
            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-4">
              Capacity Predictions
            </h3>
            <div className="space-y-4 text-sm">
              {(coachLoad.data || []).filter(
                (c) => c.capacity_status === "CRITICAL"
              ).length > 0 ? (
                <p className="leading-relaxed">
                  <span className="text-destructive font-bold">CRITICAL:</span>{" "}
                  {
                    (coachLoad.data || []).filter(
                      (c) => c.capacity_status === "CRITICAL"
                    ).length
                  }{" "}
                  coaches at capacity limit. Consider pausing campaigns or
                  onboarding new coaches.
                </p>
              ) : (
                <p className="text-emerald-400">
                  All coaches within healthy capacity range.
                </p>
              )}
              <Button className="w-full font-bold h-9 text-xs">
                Manage Ad Spend
              </Button>
            </div>
          </div>

          <div className="p-6 rounded-2xl border border-border bg-card">
            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-4">
              Zone Performance
            </h3>
            <div className="space-y-3">
              {(segmentHud.data || []).map((seg) => (
                <div
                  key={`${seg.zone}-${seg.gender}`}
                  className="flex justify-between items-center"
                >
                  <span className="text-xs text-muted-foreground">
                    {seg.zone} {seg.gender}
                  </span>
                  <span
                    className={cn(
                      "font-mono text-xs font-bold",
                      seg.avg_segment_load > 80
                        ? "text-destructive"
                        : "text-emerald-400"
                    )}
                  >
                    {seg.avg_segment_load}% load
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

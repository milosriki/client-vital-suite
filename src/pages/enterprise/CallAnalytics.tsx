import { Phone, PhoneIncoming, PhoneOutgoing, Zap, Target, DollarSign } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard/layout/DashboardHeader";
import { DataTableCard } from "@/components/dashboard/cards/DataTableCard";
import { MetricCard } from "@/components/dashboard/cards/MetricCard";
import { useCallAnalytics } from "@/hooks/enterprise/useCallAnalytics";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { EnrichedCallRecord } from "@/types/enterprise";

export default function CallAnalytics() {
  const { callLog, metrics, isLoading } = useCallAnalytics(14);

  if (isLoading) {
    return (
      <div className="p-6 space-y-8 bg-background min-h-screen">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-[400px] rounded-xl" />
      </div>
    );
  }

  const m = metrics.data;

  return (
    <div className="p-6 space-y-8 bg-background min-h-screen text-foreground">
      <DashboardHeader title="Call Intelligence" description="Decoding lead intent through conversation DNA" />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard label="Total Calls (14d)" value={m?.totalCalls?.toLocaleString() ?? "0"} icon={Phone} />
        <MetricCard label="Avg Intent IQ" value={`${m?.avgIntentIQ ?? 0}%`} icon={Zap} />
        <MetricCard label="Booking Conv %" value={`${m?.bookingConversionRate ?? 0}%`} icon={Target} />
        <MetricCard label="Revenue Shadow" value={`AED ${((m?.revenueShadow ?? 0) / 1000).toFixed(0)}K`} icon={DollarSign} />
      </div>

      <DataTableCard<EnrichedCallRecord>
        title="Live Call Stream"
        data={callLog.data ?? []}
        columns={[
          {
            key: "lead_name",
            label: "Lead Identity",
            render: (item: EnrichedCallRecord) => (
              <div>
                <div className="font-bold text-sm">{item.lead_name}</div>
                <div className="text-xs text-muted-foreground uppercase">{item.coach}</div>
              </div>
            ),
          },
          {
            key: "direction",
            label: "Type",
            render: (item: EnrichedCallRecord) => (
              <div className="flex items-center gap-2">
                {item.direction === "inbound" ? (
                  <PhoneIncoming className="w-3 h-3 text-emerald-400" />
                ) : (
                  <PhoneOutgoing className="w-3 h-3 text-violet-400" />
                )}
                <span className="text-xs capitalize">{item.direction}</span>
              </div>
            ),
          },
          {
            key: "intent_iq",
            label: "Intent IQ",
            render: (item: EnrichedCallRecord) => (
              <div className={cn(
                "inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-bold",
                item.intent_iq > 70 ? "text-violet-400 bg-violet-500/10" : "text-muted-foreground bg-muted"
              )}>
                <Zap className="w-3 h-3" /> {item.intent_iq}%
              </div>
            ),
          },
          {
            key: "verdict",
            label: "Atlas Verdict",
            render: (item: EnrichedCallRecord) => (
              <span className="text-xs text-muted-foreground italic">&ldquo;{item.verdict}&rdquo;</span>
            ),
          },
          {
            key: "status",
            label: "Status",
            render: (item: EnrichedCallRecord) => (
              <Badge variant="secondary" className="text-xs">{item.status}</Badge>
            ),
          },
        ]}
      />
    </div>
  );
}

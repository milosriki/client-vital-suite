import { useState } from "react";
import { Heart, Activity, Search, TrendingDown, TrendingUp, Clock, Target } from "lucide-react";
import { MetricCard } from "@/components/dashboard/cards/MetricCard";
import { useClientXRay } from "@/hooks/enterprise/useClientXRay";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { ClientXRayRecord } from "@/types/enterprise";

export default function ClientHealth() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClient, setSelectedClient] = useState<ClientXRayRecord | null>(null);
  const { clients, isLoading } = useClientXRay(searchTerm || undefined);

  if (isLoading) {
    return (
      <div className="flex h-screen bg-background">
        <div className="w-[350px] border-r border-border p-6 space-y-4">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-9 w-full" />
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
        <div className="flex-1 p-8">
          <Skeleton className="h-[400px] w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* Left Panel */}
      <div className="w-[350px] border-r border-border flex flex-col">
        <div className="p-6 border-b border-border space-y-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Heart className="w-5 h-5 text-destructive" /> Client X-Ray
          </h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search clients..."
              className="pl-10 h-9 text-xs"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {(clients.data || []).map((client) => (
            <div
              key={client.id}
              onClick={() => setSelectedClient(client)}
              className={cn(
                "p-4 border-b border-border/50 cursor-pointer transition-all hover:bg-muted/30",
                selectedClient?.id === client.id &&
                  "bg-muted/30 border-l-4 border-l-primary"
              )}
            >
              <div className="flex justify-between items-start mb-1">
                <span className="font-bold text-sm">
                  {client.firstname} {client.lastname}
                </span>
                <Badge
                  className={cn(
                    "text-xs h-5",
                    client.health_zone === "RED"
                      ? "bg-destructive/20 text-destructive"
                      : client.health_zone === "PURPLE"
                        ? "bg-violet-500/20 text-violet-400"
                        : client.health_zone === "YELLOW"
                          ? "bg-amber-500/20 text-amber-500"
                          : "bg-emerald-500/20 text-emerald-400"
                  )}
                >
                  {client.health_zone}
                </Badge>
              </div>
              <div className="flex justify-between items-center text-xs text-muted-foreground">
                <span>Score: {client.health_score}</span>
                <span className="flex items-center gap-1">
                  {(client.health_score || 0) < 50 ? (
                    <TrendingDown className="w-2 h-2 text-destructive" />
                  ) : (
                    <TrendingUp className="w-2 h-2 text-emerald-400" />
                  )}
                  {client.assigned_coach}
                </span>
              </div>
            </div>
          ))}
          {(clients.data || []).length === 0 && (
            <div className="p-8 text-center text-muted-foreground text-sm">
              No clients found
            </div>
          )}
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 overflow-y-auto p-8 space-y-8">
        {selectedClient ? (
          <>
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-4xl font-bold">
                  {selectedClient.firstname} {selectedClient.lastname}
                </h1>
                <p className="text-muted-foreground mt-1 uppercase text-xs tracking-widest font-mono">
                  Managed by {selectedClient.assigned_coach} •{" "}
                  {selectedClient.health_zone}
                </p>
              </div>
              <Button className="bg-violet-600 hover:bg-violet-700 text-white font-bold">
                Generate Intervention
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <MetricCard
                label="Health Score"
                value={selectedClient.health_score}
                icon={Activity}
              />
              <MetricCard
                label="Outstanding Sessions"
                value={selectedClient.outstanding_sessions}
                icon={Clock}
              />
              <MetricCard
                label="Days Inactive"
                value={selectedClient.days_since_last_session ?? 0}
                icon={Target}
              />
            </div>

            <div className="p-6 rounded-2xl border border-border bg-card min-h-[300px]">
              <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-8">
                Activity Timeline
              </h3>
              <div className="text-center py-8 text-muted-foreground text-sm">
                Timeline events load from intervention_log
              </div>
            </div>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground space-y-4">
            <Target className="w-16 h-16 opacity-20" />
            <p className="font-mono text-sm uppercase">
              Select a client to view X-Ray
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

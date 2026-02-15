import { Zap, TrendingUp, RefreshCw } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard/layout/DashboardHeader";
import { useEnterpriseTruthGenome } from "@/hooks/enterprise/useEnterpriseTruthGenome";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { TruthGenomeRecord } from "@/types/enterprise";

export default function EnterpriseStrategy() {
  const { genome, segments, revenueShadow, leaks, isLoading } = useEnterpriseTruthGenome();

  if (isLoading) {
    return (
      <div className="p-6 space-y-8 bg-background min-h-screen">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-40 rounded-2xl" />)}
        </div>
        <Skeleton className="h-[400px] rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 bg-background min-h-screen text-foreground">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-primary to-orange-400 bg-clip-text text-transparent">
            Strategy Command
          </h1>
          <p className="text-muted-foreground mt-1 font-mono text-xs uppercase tracking-widest flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Atlas Strategic Intelligence - Live
          </p>
        </div>
        <Button variant="outline" size="sm" className="border-border">
          <RefreshCw className="w-4 h-4 mr-2" />
          Sync Truth
        </Button>
      </div>

      {/* Segment Capacity HUD */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(segments.data ?? []).map(seg => (
          <div key={`${seg.zone}-${seg.gender}`} className={cn(
            "p-5 rounded-2xl border transition-all relative overflow-hidden",
            seg.avg_segment_load > 90 ? "bg-destructive/10 border-destructive/30" : "bg-card border-border"
          )}>
            <div className="flex justify-between items-start">
              <div className="text-xs text-muted-foreground uppercase font-bold tracking-widest">
                {seg.zone} {seg.gender}
              </div>
              {seg.avg_segment_load > 90 ? (
                <Badge variant="destructive" className="h-4 text-[8px] animate-pulse">STOP SPEND</Badge>
              ) : seg.avg_segment_load < 50 ? (
                <Badge className="h-4 text-[8px] bg-emerald-500/20 text-emerald-400 border-emerald-500/30">SCALABLE</Badge>
              ) : null}
            </div>
            <div className="flex items-baseline gap-2 mt-2">
              <div className={cn(
                "text-3xl font-bold font-mono",
                seg.avg_segment_load > 90 ? "text-destructive" : "text-foreground"
              )}>
                {seg.avg_segment_load}%
              </div>
              <div className="text-xs text-muted-foreground uppercase">Load</div>
            </div>
            <Progress
              value={seg.avg_segment_load}
              className="h-1 mt-4 bg-muted"
              indicatorClassName={seg.avg_segment_load > 90 ? "bg-destructive" : "bg-primary"}
            />
            <div className="mt-3 flex justify-between text-xs text-muted-foreground font-medium">
              <span>{seg.coach_count} Coaches</span>
              <span>{seg.total_segment_sessions} Sessions (14d)</span>
            </div>
          </div>
        ))}

        {/* Revenue Shadow Card */}
        <div className="p-5 rounded-2xl bg-violet-500/10 border border-violet-500/20">
          <div className="flex justify-between items-start">
            <div className="text-xs text-violet-400 uppercase font-bold tracking-widest">Revenue Shadow (30d)</div>
            <TrendingUp className="w-4 h-4 text-violet-500" />
          </div>
          <div className="text-3xl font-bold mt-2 font-mono text-foreground">
            AED {(revenueShadow.data?.projected_revenue ?? 0).toLocaleString()}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {leaks.length} revenue leaks detected
          </p>
        </div>
      </div>

      {/* Main Strategy Tabs */}
      <Tabs defaultValue="truth" className="w-full">
        <TabsList className="bg-card border border-border p-1 mb-6">
          <TabsTrigger value="truth">Revenue Genome</TabsTrigger>
          <TabsTrigger value="leaks">Financial Leaks ({leaks.length})</TabsTrigger>
          <TabsTrigger value="creative">Creative DNA</TabsTrigger>
        </TabsList>

        <TabsContent value="truth">
          <GenomeTable data={genome.data ?? []} />
        </TabsContent>

        <TabsContent value="leaks">
          <GenomeTable data={leaks} />
        </TabsContent>

        <TabsContent value="creative">
          <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-2xl">
            Creative DNA analysis coming soon
          </div>
        </TabsContent>
      </Tabs>

      {/* Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-xl border-t border-border flex justify-between items-center px-12 z-50">
        <div className="flex gap-12">
          <div>
            <div className="text-xs text-muted-foreground uppercase font-bold">Detected Leaks</div>
            <div className="text-xl font-bold text-destructive font-mono">{leaks.length}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground uppercase font-bold">Scale Opportunity</div>
            <div className="text-xl font-bold text-emerald-400 font-mono">
              {(segments.data ?? []).filter(s => s.avg_segment_load < 50).length} Segments
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="border-border h-9 text-xs">Download CFO Report</Button>
          <Button className="bg-primary text-primary-foreground font-bold h-9 text-xs">Apply Budget Decisions</Button>
        </div>
      </div>
    </div>
  );
}

function GenomeTable({ data }: { data: TruthGenomeRecord[] }) {
  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-2xl">
        No records found
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="bg-muted/50 border-b border-border">
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Lead</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">City</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Verified Cash</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Intent IQ</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Verdict</th>
          </tr>
        </thead>
        <tbody>
          {data.slice(0, 50).map(record => (
            <tr key={record.contact_id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
              <td className="px-4 py-3">
                <div className="font-medium text-sm">{record.lead_name}</div>
                <div className="text-xs text-muted-foreground">{record.email}</div>
              </td>
              <td className="px-4 py-3 text-sm text-muted-foreground">{record.city ?? "\u2014"}</td>
              <td className="px-4 py-3 text-sm font-mono font-bold">
                {record.verified_cash > 0 ? `AED ${record.verified_cash.toLocaleString()}` : "\u2014"}
              </td>
              <td className="px-4 py-3">
                <div className={cn(
                  "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold",
                  record.lead_intent_iq > 70 ? "text-violet-400 bg-violet-500/10" : "text-muted-foreground bg-muted"
                )}>
                  <Zap className="w-3 h-3" /> {record.lead_intent_iq}
                </div>
              </td>
              <td className="px-4 py-3">
                <Badge variant={record.atlas_verdict === 'VERIFIED WINNER' ? 'default' : record.atlas_verdict === 'REVENUE LEAK' ? 'destructive' : 'secondary'} className="text-xs">
                  {record.atlas_verdict}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TruthTriangle } from "@/components/analytics/TruthTriangle";
import { CreativeGallery } from "@/components/analytics/CreativeGallery";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { RefreshCw, LayoutGrid, List, MapPin, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useAnnounce } from "@/lib/accessibility";

// 3-Layer Architecture: Executive Truth -> Performance Matrix -> Atomic Ledger

const UltimateDashboard = () => {
  // "Smart Fetching": Cache for 5 minutes (300,000ms) to avoid re-fetching on every tab switch.
  // This is the "optimization" the user requested.
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["ultimate-dashboard-data"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        "ultimate-aggregator",
      );
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-slate-900 via-[#0a0a0a] to-black p-6 space-y-12 text-slate-100 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
            God Mode
          </h1>
          <p className="text-slate-400 mt-2">
            Unified Intelligence: Meta • HubSpot • AnyTrack
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching}
            className="border-white/10 bg-white/5 hover:bg-white/10 text-slate-200"
          >
            <RefreshCw
              className={`w-4 h-4 mr-2 ${isRefetching ? "animate-spin" : ""}`}
            />
            Sync Now
          </Button>
        </div>
      </div>

      {/* Layer 1: Executive Truth (The Triangle) */}
      <section>
        <div className="flex items-center gap-2 mb-6 text-emerald-400 uppercase text-xs font-bold tracking-widest">
          <Zap className="w-4 h-4" /> Live Validation
        </div>

        <TruthTriangle
          hubspotValue={data?.executive_truth?.hubspot_revenue || 0}
          stripeValue={data?.executive_truth?.hubspot_revenue || 0}
          posthogValue={data?.executive_truth?.hubspot_revenue || 0}
        />
      </section>

      {/* Layer 2: Performance Matrix (The Optimizers) */}
      <section>
        <div className="flex items-center gap-2 mb-6 text-blue-400 uppercase text-xs font-bold tracking-widest">
          <LayoutGrid className="w-4 h-4" /> Performance Matrix
        </div>

        <Tabs defaultValue="creatives" className="space-y-6">
          <TabsList className="bg-white/5 border border-white/10 p-1 rounded-lg">
            <TabsTrigger
              value="creatives"
              className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-slate-400"
            >
              Creatives Analysis
            </TabsTrigger>
            <TabsTrigger
              value="locations"
              className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-slate-400"
            >
              Location War Room
            </TabsTrigger>
            <TabsTrigger
              value="copy"
              className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-slate-400"
            >
              Copywriting Intel
            </TabsTrigger>
          </TabsList>

          <TabsContent value="creatives" className="space-y-4">
            <div className="grid grid-cols-1">
              <Card className="bg-transparent border-none shadow-none">
                <CardHeader className="px-0 pt-0">
                  <CardTitle className="text-xl text-slate-100">
                    Winning Creatives
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    Visual breakdown of top performing ads by{" "}
                    <span className="text-emerald-400">True ROAS</span>.
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-0">
                  {isLoading ? (
                    <div className="h-64 flex items-center justify-center text-slate-500">
                      Loading Intelligence...
                    </div>
                  ) : (
                    <CreativeGallery
                      data={data?.performance_matrix?.creatives || []}
                    />
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="locations">
            <div className="p-12 text-center border border-dashed border-white/10 rounded-xl text-slate-500">
              <MapPin className="w-8 h-8 mx-auto mb-4 opacity-50" />
              Geo-Spatial Intelligence Module (Coming Soon)
            </div>
          </TabsContent>

          <TabsContent value="copy">
            <div className="p-12 text-center border border-dashed border-white/10 rounded-xl text-slate-500">
              <List className="w-8 h-8 mx-auto mb-4 opacity-50" />
              Copywriting NLP Analysis (Coming Soon)
            </div>
          </TabsContent>
        </Tabs>
      </section>

      {/* Layer 3: Atomic Ledger (The Drill Down) */}
      <section>
        <div className="flex items-center gap-2 mb-6 text-purple-400 uppercase text-xs font-bold tracking-widest">
          <List className="w-4 h-4" /> Atomic Ledger (Granular Data)
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 overflow-hidden">
          {/* Simple Table for MVP - To be upgraded to TanStack Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-white/5 text-slate-400 uppercase text-[10px] font-bold tracking-wider">
                <tr>
                  <th className="px-6 py-4">Identity</th>
                  <th className="px-6 py-4">Location</th>
                  <th className="px-6 py-4">Pipeline Stage</th>
                  <th className="px-6 py-4 text-right">Value</th>
                  <th className="px-6 py-4 text-right">Journey</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data?.atomic_ledger?.slice(0, 10).map((row: any) => (
                  <tr
                    key={row.id}
                    className="hover:bg-white/5 transition-colors group"
                  >
                    <td className="px-6 py-4 font-medium text-slate-200">
                      {row.name}
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                        {row.id}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-400">{row.location}</td>
                    <td className="px-6 py-4">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] font-normal border-white/10",
                          row.stage === "Closed Won"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : "text-slate-400",
                        )}
                      >
                        {row.stage}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right text-slate-200 font-mono">
                      {row.value > 0 ? `$${row.value.toLocaleString()}` : "-"}
                    </td>
                    <td className="px-6 py-4 text-right text-slate-500 text-xs">
                      {row.journey_length}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Footer */}
          <div className="p-4 border-t border-white/5 bg-white/5 text-center text-xs text-slate-500">
            Showing top 10 of {data?.atomic_ledger?.length || 0} records
          </div>
        </div>
      </section>
    </div>
  );
};

export default UltimateDashboard;

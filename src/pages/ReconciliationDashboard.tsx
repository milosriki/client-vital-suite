import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Database,
  Search,
  Users,
  Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const ReconciliationDashboard = () => {
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["aws-reconciliation-data"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        "aws-backoffice-sync",
      );
      if (error) throw error;
      return data;
    },
    refetchOnWindowFocus: false,
  });

  const reconciliations = data?.data || [];
  const summary = data?.summary || {
    total_checked: 0,
    matches: 0,
    total_leaks: 0,
    active_leaks: 0,
    potential_revenue_loss_sessions: 0,
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-slate-900 via-[#0a0a0a] to-black p-6 space-y-12 text-slate-100 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-red-400 to-orange-400">
            Leak Detector
          </h1>
          <p className="text-slate-400 mt-2">
            AWS Backoffice vs HubSpot: Training Session Reconciliation
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
            {isRefetching ? "Reconciling..." : "Run Audit"}
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-white/5 border-white/10 backdrop-blur-xl">
          <CardHeader className="pb-2">
            <CardDescription className="text-slate-400 uppercase text-[10px] tracking-widest font-bold">
              Total Clients
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-white">
              {summary.total_checked}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-xs text-slate-500">
              <Users className="w-3 h-3 mr-1" /> Verified from RDS
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10 backdrop-blur-xl">
          <CardHeader className="pb-2">
            <CardDescription className="text-emerald-400 uppercase text-[10px] tracking-widest font-bold">
              Clean Matches
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-emerald-400">
              {summary.matches}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-xs text-emerald-500/50">
              <CheckCircle2 className="w-3 h-3 mr-1" /> Data Integrity In Sync
            </div>
          </CardContent>
        </Card>

        <Card className="bg-red-500/10 border-red-500/20 backdrop-blur-xl">
          <CardHeader className="pb-2">
            <CardDescription className="text-red-400 uppercase text-[10px] tracking-widest font-bold">
              Active Leaks
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-red-500">
              {summary.active_leaks}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-xs text-red-400/50">
              <ShieldAlert className="w-3 h-3 mr-1" /> Training with 0 Paid Ops
            </div>
          </CardContent>
        </Card>

        <Card className="bg-orange-500/10 border-orange-500/20 backdrop-blur-xl">
          <CardHeader className="pb-2">
            <CardDescription className="text-orange-400 uppercase text-[10px] tracking-widest font-bold">
              Lost Revenue Capacity
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-orange-400">
              {summary.potential_revenue_loss_sessions}{" "}
              <span className="text-xs font-normal opacity-50">sessions</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-xs text-orange-400/50">
              <AlertTriangle className="w-3 h-3 mr-1" /> RDS Balance {">"}{" "}
              HubSpot
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Comparison Ledger */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2 text-slate-400 uppercase text-xs font-bold tracking-widest">
            <Database className="w-4 h-4" /> Reconciliation Ledger
          </div>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search client or package..."
              className="bg-white/5 border border-white/10 rounded-full pl-9 pr-4 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-red-500/50 transition-colors w-64"
            />
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/40 overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-white/5 text-slate-400 uppercase text-[10px] font-bold tracking-wider">
                <tr>
                  <th className="px-6 py-4">Client</th>
                  <th className="px-6 py-4">Package</th>
                  <th className="px-6 py-4 text-center">Truth</th>
                  <th className="px-6 py-4 text-center">HubSpot</th>
                  <th className="px-6 py-4 text-center">Diff</th>
                  <th className="px-6 py-4 text-center">Recent Activity</th>
                  <th className="px-6 py-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {isLoading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={7} className="px-6 py-8">
                        <div className="h-4 bg-white/5 rounded w-3/4 mx-auto"></div>
                      </td>
                    </tr>
                  ))
                ) : reconciliations.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-12 text-center text-slate-500 italic"
                    >
                      No discrepancies found. All data is in sync.
                    </td>
                  </tr>
                ) : (
                  reconciliations.map((row: any, i: number) => (
                    <tr
                      key={i}
                      className={cn(
                        "hover:bg-white/5 transition-colors group",
                        row.is_active_leaking && "bg-red-500/[0.05]",
                        row.status === "LEAK_DETECTED" &&
                          !row.is_active_leaking &&
                          "bg-orange-500/[0.03]",
                      )}
                    >
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-200 whitespace-nowrap">
                          {row.name}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                          {row.email}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-xs text-slate-400 line-clamp-1 max-w-[150px]">
                          {row.package || (
                            <span className="text-slate-600 italic">
                              No Active Pkg
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center font-mono">
                        <span
                          className={cn(
                            "px-2 py-1 rounded bg-slate-800 text-slate-300",
                            row.backoffice_sessions <= 0 && "text-red-400",
                          )}
                        >
                          {row.backoffice_sessions}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center font-mono text-slate-400">
                        {row.hubspot_sessions}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={cn(
                            "font-mono font-bold",
                            row.discrepancy > 0
                              ? "text-red-500"
                              : row.discrepancy < 0
                                ? "text-orange-400"
                                : "text-emerald-500",
                          )}
                        >
                          {row.discrepancy > 0
                            ? `+${row.discrepancy}`
                            : row.discrepancy}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="text-xs font-bold text-slate-300">
                          {row.recent_sessions}{" "}
                          <span className="text-[10px] font-normal opacity-50">
                            sess
                          </span>
                        </div>
                        {row.last_training && (
                          <div className="text-[9px] text-slate-500 mt-0.5">
                            Last:{" "}
                            {new Date(row.last_training).toLocaleDateString()}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] font-bold border-white/10 uppercase tracking-tighter",
                            row.status === "MATCH"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : row.is_active_leaking
                                ? "bg-red-500 text-white border-red-600 animate-pulse"
                                : row.status === "LEAK_DETECTED"
                                  ? "bg-orange-500/10 text-orange-400 border-orange-500/20"
                                  : "bg-slate-500/10 text-slate-400 border-slate-500/20",
                          )}
                        >
                          {row.is_active_leaking
                            ? "CRITICAL LEAK"
                            : row.status.replace("_", " ")}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {/* Footer */}
          <div className="p-4 border-t border-white/5 bg-white/5 text-center text-[10px] text-slate-500 uppercase tracking-widest font-bold">
            Deep Intelligence Sync via AWS RDS (enhancesch schema)
          </div>
        </div>
      </section>
    </div>
  );
};

export default ReconciliationDashboard;

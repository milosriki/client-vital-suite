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
import { EmptyState } from "@/components/ui/empty-state";
import { useAnnounce } from "@/lib/accessibility";

import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

const ReconciliationDashboard = () => {
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["aws-reconciliation-data"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        "aws-truth-alignment",
      );
      if (error) throw error;
      return data;
    },
    refetchOnWindowFocus: false,
  });

  const forceAlignMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        "aws-truth-alignment",
        {
          body: { force_align: true },
        },
      );
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Successfully aligned ${data?.report?.aligned || 0} records with AWS Truth.`);
      refetch();
    },
    onError: (error: any) => {
      toast.error(`Alignment failed: ${error.message}`);
    },
  });

  const reconciliations = data?.report?.discrepancies || [];
  const summary = data?.report || {
    total_checked: 0,
    matched: 0,
    aligned: 0,
    discrepancies: [],
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-slate-900 via-[#0a0a0a] to-black p-6 space-y-12 text-slate-100 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-red-400 to-orange-400">
            Leak Detector
          </h1>
          <p className="text-slate-300 mt-2">
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
          
          <Button
            variant="default"
            size="sm"
            onClick={() => forceAlignMutation.mutate()}
            disabled={forceAlignMutation.isPending || reconciliations.length === 0}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <ShieldAlert className="w-4 h-4 mr-2" />
            {forceAlignMutation.isPending ? "Aligning..." : "Force Align All"}
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-white/5 border-white/10 backdrop-blur-xl">
          <CardHeader className="pb-2">
            <CardDescription className="text-slate-300 uppercase text-[10px] tracking-widest font-bold">
              Total Checked
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-white">
              {summary.total_checked}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-xs text-slate-400">
              <Users className="w-3 h-3 mr-1" /> AWS Master Records
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10 backdrop-blur-xl">
          <CardHeader className="pb-2">
            <CardDescription className="text-emerald-400 uppercase text-[10px] tracking-widest font-bold">
              Identity Matches
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-emerald-400">
              {summary.matched}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-xs text-emerald-500/50">
              <CheckCircle2 className="w-3 h-3 mr-1" /> Linked by Email
            </div>
          </CardContent>
        </Card>

        <Card className="bg-blue-500/10 border-blue-500/20 backdrop-blur-xl">
          <CardHeader className="pb-2">
            <CardDescription className="text-blue-400 uppercase text-[10px] tracking-widest font-bold">
              Auto-Aligned
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-blue-500">
              {summary.aligned}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-xs text-blue-400/50">
              <ShieldAlert className="w-3 h-3 mr-1" /> Forced Truth from AWS
            </div>
          </CardContent>
        </Card>

        <Card className="bg-orange-500/10 border-orange-500/20 backdrop-blur-xl">
          <CardHeader className="pb-2">
            <CardDescription className="text-orange-400 uppercase text-[10px] tracking-widest font-bold">
              Discrepancies
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-orange-400">
              {reconciliations.length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-xs text-orange-400/50">
              <AlertTriangle className="w-3 h-3 mr-1" /> Actionable Gaps Found
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Comparison Ledger */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2 text-slate-300 uppercase text-xs font-bold tracking-widest">
            <Database className="w-4 h-4" /> Discrepancy Ledger
          </div>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by email..."
              className="bg-white/5 border border-white/10 rounded-full pl-9 pr-4 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-blue-500/50 transition-colors w-64"
            />
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/40 overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-white/5 text-slate-300 uppercase text-[10px] font-bold tracking-wider">
                <tr>
                  <th className="px-6 py-4">Client Email</th>
                  <th className="px-6 py-4">Field</th>
                  <th className="px-6 py-4 text-center">Old State</th>
                  <th className="px-6 py-4 text-center">New Truth</th>
                  <th className="px-6 py-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {isLoading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={5} className="px-6 py-8">
                        <div className="h-4 bg-white/5 rounded w-3/4 mx-auto"></div>
                      </td>
                    </tr>
                  ))
                ) : reconciliations.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-12 text-center text-slate-400 italic"
                    >
                      No active discrepancies. System is 100% aligned with AWS.
                    </td>
                  </tr>
                ) : (
                  reconciliations.map((row: any, i: number) => (
                    <tr
                      key={i}
                      className="hover:bg-white/5 transition-colors group"
                    >
                      <td className="px-6 py-4">
                        <div className="text-xs text-slate-200 font-mono">
                          {row.email}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant="secondary" className="bg-slate-800 text-slate-300 text-[9px]">
                          {row.field}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-center font-mono text-slate-400 text-xs">
                        {JSON.stringify(row.old)}
                      </td>
                      <td className="px-6 py-4 text-center font-mono text-blue-400 text-xs font-bold">
                        {JSON.stringify(row.new)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Badge
                          variant="outline"
                          className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-[10px] font-bold uppercase tracking-tighter"
                        >
                          ALIGNED
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {/* Footer */}
          <div className="p-4 border-t border-white/10 bg-white/5 text-center text-[10px] text-slate-400 uppercase tracking-widest font-bold">
            Deep Intelligence Sync via AWS RDS (enhancesch schema)
          </div>
        </div>
      </section>
    </div>
  );
};

export default ReconciliationDashboard;

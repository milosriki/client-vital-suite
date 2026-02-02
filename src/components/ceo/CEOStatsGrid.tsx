import { Card, CardContent } from "@/components/ui/card";
import {
  DollarSign,
  Users,
  TrendingUp,
  AlertTriangle,
  Clock,
  Target,
} from "lucide-react";
import {
  RevenueMetrics,
  ClientHealthMetrics,
  PreparedAction,
  BusinessGoal,
} from "@/types/ceo";
import { formatCurrency } from "@/lib/ceo-utils";

interface CEOStatsGridProps {
  revenueData: RevenueMetrics | undefined;
  clientHealth: ClientHealthMetrics | undefined;
  pendingActions: PreparedAction[] | undefined;
  goals: BusinessGoal[] | undefined;
}

export function CEOStatsGrid({
  revenueData,
  clientHealth,
  pendingActions,
  goals,
}: CEOStatsGridProps) {
  const stats = {
    total: pendingActions?.length || 0,
    critical:
      pendingActions?.filter((a) => a.risk_level === "critical").length || 0,
    high: pendingActions?.filter((a) => a.risk_level === "high").length || 0,
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
      {/* Revenue This Month */}
      <Card className="bg-emerald-500/10 border-emerald-500/30 col-span-1">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-white/60 uppercase">Revenue</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-white">
            {formatCurrency(revenueData?.totalRevenue || 0)}
          </p>
          <p className="text-xs text-emerald-400">This month</p>
        </CardContent>
      </Card>

      {/* Active Clients */}
      <Card className="bg-blue-500/10 border-blue-500/30 col-span-1">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-white/60 uppercase">Clients</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-white">
            {clientHealth?.total || 0}
          </p>
          <p className="text-xs text-blue-400">Active total</p>
        </CardContent>
      </Card>

      {/* Avg Deal Value */}
      <Card className="bg-purple-500/10 border-purple-500/30 col-span-1">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-purple-400" />
            <span className="text-xs text-white/60 uppercase">Avg Deal</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-white">
            {formatCurrency(revenueData?.avgDealValue || 0)}
          </p>
          <p className="text-xs text-purple-400">
            {revenueData?.dealsCount || 0} deals
          </p>
        </CardContent>
      </Card>

      {/* At-Risk Revenue */}
      <Card className="bg-red-500/10 border-red-500/30 col-span-1">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span className="text-xs text-white/60 uppercase">At Risk</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-white">
            {formatCurrency(clientHealth?.atRiskRevenue || 0)}
          </p>
          <p className="text-xs text-red-400">
            {(clientHealth?.red || 0) + (clientHealth?.yellow || 0)} clients
          </p>
        </CardContent>
      </Card>

      {/* Pending Actions */}
      <Card className="bg-orange-500/10 border-orange-500/30 col-span-1">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-orange-400" />
            <span className="text-xs text-white/60 uppercase">Pending</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-white">
            {stats.total}
          </p>
          <p className="text-xs text-orange-400">
            {stats.critical + stats.high} urgent
          </p>
        </CardContent>
      </Card>

      {/* Active Goals */}
      <Card className="bg-cyan-500/10 border-cyan-500/30 col-span-1">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-cyan-400" />
            <span className="text-xs text-white/60 uppercase">Goals</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-white">
            {goals?.length || 0}
          </p>
          <p className="text-xs text-cyan-400">Active targets</p>
        </CardContent>
      </Card>
    </div>
  );
}

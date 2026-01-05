import { MetricCard } from "./MetricCard";
import { 
  DollarSign, 
  Users, 
  AlertTriangle, 
  TrendingUp, 
  Phone, 
  Calendar, 
  Target,
  Activity,
  LucideIcon
} from "lucide-react";
import { cn } from "@/lib/utils";

interface KPIData {
  revenue: { value: number; trend?: number };
  revenueToday?: number;
  clients: { total: number; atRisk: number };
  pipeline: { value: number; count: number };
  leads: number;
  calls: number;
  appointments: number;
  criticalAlerts: number;
  adSpend?: number;
  roas?: number;
}

interface KPIGridProps {
  data: KPIData;
  isLoading?: boolean;
  onMetricClick?: (metric: string) => void;
}

export function KPIGrid({ data, isLoading = false, onMetricClick }: KPIGridProps) {
  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `AED ${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `AED ${(value / 1000).toFixed(0)}K`;
    }
    return `AED ${value.toLocaleString()}`;
  };

  return (
    <div className="space-y-6">
      {/* Primary Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Revenue Today"
          value={formatCurrency(data.revenueToday || 0)}
          icon={DollarSign}
          variant="default"
          isLoading={isLoading}
          onClick={() => onMetricClick?.("revenue")}
        />
        <MetricCard
          label="Ad Spend"
          value={formatCurrency(data.adSpend || 0)}
          icon={TrendingUp}
          variant="warning"
          isLoading={isLoading}
          subtitle="Facebook Marketing"
        />
        <MetricCard
          label="ROAS"
          value={`${(data.roas || 0).toFixed(1)}x`}
          icon={Zap}
          variant={data.roas && data.roas > 3 ? "success" : "default"}
          isLoading={isLoading}
          subtitle="Return on Ad Spend"
        />
        <MetricCard
          label="Pipeline"
          value={formatCurrency(data.pipeline.value)}
          icon={TrendingUp}
          variant="info"
          isLoading={isLoading}
          onClick={() => onMetricClick?.("pipeline")}
          subtitle={`${data.pipeline.count} active deals`}
        />
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Active Clients"
          value={data.clients.total}
          icon={Users}
          variant="default"
          isLoading={isLoading}
          onClick={() => onMetricClick?.("clients")}
        />
        <MetricCard
          label="Leads Today"
          value={data.leads}
          icon={Target}
          variant="default"
          isLoading={isLoading}
          onClick={() => onMetricClick?.("leads")}
        />
        <MetricCard
          label="Calls Today"
          value={data.calls}
          icon={Phone}
          variant="default"
          isLoading={isLoading}
          onClick={() => onMetricClick?.("calls")}
        />
        <MetricCard
          label="Critical Alerts"
          value={data.criticalAlerts}
          icon={Activity}
          variant={data.criticalAlerts > 0 ? "danger" : "success"}
          pulse={data.criticalAlerts > 0}
          isLoading={isLoading}
          onClick={() => onMetricClick?.("alerts")}
        />
      </div>
    </div>
  );
}

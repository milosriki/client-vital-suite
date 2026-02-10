/**
 * Enterprise Analytics Types
 * Type definitions for dashboard, KPI, and reporting data
 */

export interface DashboardMetric {
  label: string;
  value: number | string;
  change?: number;
  changeDirection?: "up" | "down" | "flat";
  format: "number" | "currency" | "percentage" | "text";
  period?: string;
}

export interface KPISummary {
  mrr: number;
  arr: number;
  activeClients: number;
  churnRate: number;
  avgHealthScore: number;
  totalRevenue: number;
  cpl: number;
  roas: number;
  trueRoas: number;
  period: DateRange;
}

export interface DateRange {
  startDate: string;
  endDate: string;
  label?: string;
}

export interface TimeSeriesPoint {
  date: string;
  value: number;
  label?: string;
}

export interface ChartData {
  series: ChartSeries[];
  labels?: string[];
  config?: ChartConfig;
}

export interface ChartSeries {
  name: string;
  data: TimeSeriesPoint[];
  color?: string;
  type?: "line" | "bar" | "area";
}

export interface ChartConfig {
  showLegend?: boolean;
  showGrid?: boolean;
  yAxisLabel?: string;
  xAxisLabel?: string;
  stacked?: boolean;
}

export interface CoachPerformance {
  coach_id: string;
  coach_name: string;
  active_clients: number;
  retention_rate: number;
  avg_health_score: number;
  revenue: number;
  sessions_this_month: number;
  percentile_rank: number;
}

export interface SyncStatus {
  platform: string;
  lastSyncAt: string | null;
  status: "fresh" | "stale" | "critical" | "unknown";
  recordsProcessed?: number;
  errorsCount?: number;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  severity: "info" | "warning" | "critical";
  read: boolean;
  created_at: string;
  metadata?: Record<string, unknown>;
}

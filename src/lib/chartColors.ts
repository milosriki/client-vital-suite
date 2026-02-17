/**
 * Semantic Chart Color Palette
 * 
 * Consistent colors across all Recharts visualizations.
 * Derived from the PTD Fitness OLED brand tokens.
 * 
 * Usage:
 *   import { CHART_COLORS } from '@/lib/chartColors';
 *   <Bar fill={CHART_COLORS.revenue} />
 *   <Line stroke={CHART_COLORS.growth} />
 */

export const CHART_COLORS = {
  /** Amber — revenue, money in/out, spend */
  revenue: '#F59E0B',
  /** Emerald — success, growth, positive trends */
  growth: '#10B981',
  /** Rose — risk, churn, negative trends, losses */
  danger: '#F43F5E',
  /** Violet — marketing spend, campaigns, CTA */
  marketing: '#8B5CF6',
  /** Sky — volume, neutral metrics, counts */
  neutral: '#38BDF8',
  /** Slate — comparisons, baselines, secondary series */
  secondary: '#94A3B8',
  /** Cyan — attribution, tracking, data flow */
  attribution: '#06B6D4',
  /** Orange — warnings, attention needed */
  warning: '#F97316',
} as const;

/** Ordered palette for multi-series charts (pie, stacked bar) */
export const RECHARTS_PALETTE = [
  CHART_COLORS.revenue,
  CHART_COLORS.marketing,
  CHART_COLORS.growth,
  CHART_COLORS.neutral,
  CHART_COLORS.danger,
  CHART_COLORS.attribution,
  CHART_COLORS.warning,
  CHART_COLORS.secondary,
] as const;

/** Health zone colors (semantic — don't change) */
export const HEALTH_COLORS = {
  red: '#EF4444',
  yellow: '#EAB308',
  green: '#22C55E',
  purple: '#A855F7',
} as const;

/** Axis and grid styling for dark theme */
export const CHART_AXIS = {
  stroke: '#64748B',      // slate-500 for axis lines
  tickFill: '#94A3B8',    // slate-400 for tick labels
  gridStroke: '#1E293B',  // slate-800 for grid lines
  gridOpacity: 0.5,
} as const;

export type ChartColorKey = keyof typeof CHART_COLORS;

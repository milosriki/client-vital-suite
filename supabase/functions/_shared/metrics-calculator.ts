/**
 * Canonical Metrics Calculator
 *
 * Single source of truth for all business metrics:
 * ROAS, CPL, CPO, CLV, CAC, churn rate, LTV:CAC ratio.
 *
 * Import this instead of computing inline. Ensures consistency
 * across all 28+ functions that compute ROAS.
 */

export interface MetricInput {
  revenue: number;
  spend: number;
  leads?: number;
  deals?: number;
  clients?: number;
  churned?: number;
  totalActive?: number;
  arpu?: number;
}

export interface MetricResult {
  roas: number | null;
  cpl: number | null;
  cpo: number | null;
  cac: number | null;
  clv: number | null;
  ltvCacRatio: number | null;
  churnRate: number | null;
}

/**
 * ROAS = Revenue / Ad Spend
 * Returns null if spend is zero (avoid division by zero).
 */
export function computeROAS(revenue: number, spend: number): number | null {
  if (!spend || spend <= 0) return null;
  return Math.round((revenue / spend) * 100) / 100;
}

/**
 * CPL = Total Ad Spend / Number of Leads Generated
 */
export function computeCPL(spend: number, leads: number): number | null {
  if (!leads || leads <= 0) return null;
  return Math.round((spend / leads) * 100) / 100;
}

/**
 * CPO = Total Ad Spend / Number of Deals (Opportunities) Created
 */
export function computeCPO(spend: number, deals: number): number | null {
  if (!deals || deals <= 0) return null;
  return Math.round((spend / deals) * 100) / 100;
}

/**
 * CAC = Total Cost / Number of New Customers Acquired
 * Total cost includes ad spend + operational costs.
 */
export function computeCAC(totalCost: number, newClients: number): number | null {
  if (!newClients || newClients <= 0) return null;
  return Math.round((totalCost / newClients) * 100) / 100;
}

/**
 * CLV = ARPU / Monthly Churn Rate
 * Uses simple CLV formula. churnRate should be a decimal (e.g. 0.05 for 5%).
 */
export function computeCLV(arpu: number, churnRate: number): number | null {
  if (!churnRate || churnRate <= 0) return null;
  return Math.round((arpu / churnRate) * 100) / 100;
}

/**
 * Churn Rate = Churned Customers / (Total Active + Churned) * 100
 * Returns percentage (e.g. 5.2 for 5.2%).
 */
export function computeChurnRate(churned: number, totalActive: number): number | null {
  const total = totalActive + churned;
  if (total <= 0) return null;
  return Math.round((churned / total) * 10000) / 100;
}

/**
 * LTV:CAC Ratio = CLV / CAC
 * Healthy ratio is > 3:1.
 */
export function computeLTVCACRatio(clv: number, cac: number): number | null {
  if (!cac || cac <= 0) return null;
  return Math.round((clv / cac) * 100) / 100;
}

/**
 * Compute all metrics from a single input object.
 */
export function computeAllMetrics(input: MetricInput): MetricResult {
  const roas = computeROAS(input.revenue, input.spend);
  const cpl = input.leads ? computeCPL(input.spend, input.leads) : null;
  const cpo = input.deals ? computeCPO(input.spend, input.deals) : null;
  const cac = input.clients ? computeCAC(input.spend, input.clients) : null;

  const churnRate = (input.churned != null && input.totalActive != null)
    ? computeChurnRate(input.churned, input.totalActive)
    : null;

  const churnDecimal = churnRate ? churnRate / 100 : null;
  const clv = (input.arpu && churnDecimal) ? computeCLV(input.arpu, churnDecimal) : null;
  const ltvCacRatio = (clv && cac) ? computeLTVCACRatio(clv, cac) : null;

  return { roas, cpl, cpo, cac, clv, ltvCacRatio, churnRate };
}

/**
 * Format ROAS for display: "2.45x" or "N/A"
 */
export function formatROAS(roas: number | null): string {
  if (roas === null) return "N/A";
  return `${roas.toFixed(2)}x`;
}

/**
 * Format currency for display: "AED 1,234" or "N/A"
 */
export function formatAED(value: number | null): string {
  if (value === null) return "N/A";
  return `AED ${value.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

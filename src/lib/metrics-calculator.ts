/**
 * Canonical Metrics Calculator (Frontend)
 *
 * Mirrors supabase/functions/_shared/metrics-calculator.ts.
 * Single source of truth for ROAS, CPL, CPO, CAC.
 */

/**
 * ROAS = Revenue / Ad Spend
 */
export function computeROAS(revenue: number, spend: number): number | null {
  if (!spend || spend <= 0) return null;
  return Math.round((revenue / spend) * 100) / 100;
}

/**
 * CPL = Total Ad Spend / Number of Leads
 */
export function computeCPL(spend: number, leads: number): number | null {
  if (!leads || leads <= 0) return null;
  return Math.round((spend / leads) * 100) / 100;
}

/**
 * CPO = Total Ad Spend / Number of Deals
 */
export function computeCPO(spend: number, deals: number): number | null {
  if (!deals || deals <= 0) return null;
  return Math.round((spend / deals) * 100) / 100;
}

/**
 * CAC = Total Cost / Number of New Customers
 */
export function computeCAC(totalCost: number, newClients: number): number | null {
  if (!newClients || newClients <= 0) return null;
  return Math.round((totalCost / newClients) * 100) / 100;
}

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

export async function executeStripeTools(
  supabase: any,
  toolName: string,
  input: any,
): Promise<string> {
  switch (toolName) {
    case "stripe_control": {
      const { action, days = 90 } = input;

      // Force a live sync for high-priority actions
      if (
        action === "live_pulse" ||
        action === "fraud_scan" ||
        action === "integrity_check"
      ) {
        console.log(`🚀 Triggering live sync for ${action}...`);
        await supabase.functions.invoke("stripe-dashboard-data", {
          body: { force_refresh: true },
        });
      }

      if (action === "fraud_scan") {
        try {
          const { data } = await supabase.functions.invoke("stripe-forensics", {
            body: { action: "full-audit", days_back: days },
          });
          return `🚨 LIVE STRIPE FRAUD SCAN:\n${JSON.stringify(data, null, 2)}`;
        } catch (e) {
          return `Stripe forensics error: ${e}`;
        }
      }

      if (action === "live_pulse") {
        try {
          const { data } = await supabase.functions.invoke(
            "stripe-dashboard-data",
            { body: {} },
          );
          return (
            `📊 LIVE STRIPE PULSE (Current as of ${new Date().toLocaleTimeString()}):\n` +
            `- Net Revenue: ${data.metrics.netRevenue / 100} AED\n` +
            `- Successful Payments: ${data.metrics.successfulPaymentsCount}\n` +
            `- Pending Balance: ${data.balance.pending[0].amount / 100} AED\n` +
            `Recent Activity Summary: ${JSON.stringify(data.chartData.slice(-3))}`
          );
        } catch (e) {
          return `Live pulse error: ${e}`;
        }
      }
      if (action === "get_summary" || action === "analyze") {
        try {
          const { data } = await supabase.functions.invoke(
            "stripe-dashboard-data",
            { body: {} },
          );
          return JSON.stringify(data);
        } catch (e) {
          return `Stripe dashboard error: ${e}`;
        }
      }
      return "Unknown action";
    }

    default:
      return `Tool ${toolName} not handled by Stripe executor.`;
  }
}

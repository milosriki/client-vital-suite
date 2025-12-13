import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface CreateNotification {
  type: "critical" | "important" | "info";
  title: string;
  message: string;
  category?: string;
  metadata?: Record<string, unknown>;
}

export const useNotifications = () => {
  const createNotification = async (notification: CreateNotification) => {
    const { error } = await supabase.from("notifications").insert({
      type: notification.type,
      title: notification.title,
      message: notification.message,
      category: notification.category || "system",
      metadata: notification.metadata || {},
    } as any);
    if (error) console.error("Error creating notification:", error);
  };

  // Monitor for critical events
  useEffect(() => {
    // Monitor deals for large closures
    const dealsChannel = supabase
      .channel("deals-monitor")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "deals" },
        async (payload) => {
          const deal = payload.new as { status: string; deal_value: number; deal_name: string };
          if (deal.status === "closed" && deal.deal_value > 10000) {
            await createNotification({
              type: "important",
              title: "🎉 Large Deal Closed!",
              message: `${deal.deal_name || "Deal"} closed for AED ${deal.deal_value.toLocaleString()}`,
              category: "deals",
              metadata: payload.new as Record<string, unknown>,
            });
          }
        }
      )
      .subscribe();

    // Monitor client health for churn risk
    const healthChannel = supabase
      .channel("health-monitor")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "client_health_scores" },
        async (payload) => {
          const client = payload.new as { churn_risk_score: number; firstname: string; lastname: string };
          if (client.churn_risk_score && client.churn_risk_score > 80) {
            await createNotification({
              type: "critical",
              title: "⚠️ High Churn Risk Alert",
              message: `${client.firstname} ${client.lastname} has ${client.churn_risk_score.toFixed(0)}% churn risk`,
              category: "churn",
              metadata: payload.new as Record<string, unknown>,
            });
          }
        }
      )
      .subscribe();

    // Monitor sync errors
    const errorsChannel = supabase
      .channel("errors-monitor")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "sync_errors" },
        async (payload) => {
          const error = payload.new as { error_type: string; error_message: string };
          await createNotification({
            type: "critical",
            title: "System Error",
            message: `${error.error_type}: ${error.error_message}`,
            category: "system",
            metadata: payload.new as Record<string, unknown>,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(dealsChannel);
      supabase.removeChannel(healthChannel);
      supabase.removeChannel(errorsChannel);
    };
  }, []);

  return { createNotification };
};

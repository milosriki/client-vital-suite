import { useDedupedQuery } from "@/hooks/useDedupedQuery";
import { supabase } from "@/integrations/supabase/client";

export interface ClientPrediction {
  client_id: string;
  client_name: string;
  churn_score: number;
  churn_factors: {
    days_since_last_session: number;
    sessions_ratio: number;
    decline_rate: number;
    future_booked: number;
    cancel_rate: number;
    remaining_sessions: number;
    coach: string | null;
    phone: string | null;
  };
  revenue_at_risk: number;
  predicted_churn_date: string;
  updated_at: string;
}

export interface RevenueForecast {
  forecast_date: string;
  revenue_30d: number;
  revenue_60d: number;
  revenue_90d: number;
  at_risk_30d: number;
  at_risk_60d: number;
  at_risk_90d: number;
  total_pipeline: number;
  updated_at: string;
}

export function usePredictions() {
  const predictions = useDedupedQuery<ClientPrediction[]>({
    queryKey: ["client-predictions"],
    dedupeIntervalMs: 5000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_predictions" as never)
        .select("*")
        .order("churn_score", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ClientPrediction[];
    },
    staleTime: 2 * 60 * 1000,
  });

  const forecast = useDedupedQuery<RevenueForecast | null>({
    queryKey: ["revenue-forecast"],
    dedupeIntervalMs: 5000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("revenue_forecasts" as never)
        .select("*")
        .order("forecast_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as RevenueForecast;
    },
    staleTime: 2 * 60 * 1000,
  });

  return { predictions, forecast };
}

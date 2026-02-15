import { useDedupedQuery } from "@/hooks/useDedupedQuery";
import { QUERY_KEYS } from "@/config/queryKeys";
import { supabase } from "@/integrations/supabase/client";
import type { EnrichedCallRecord, CallAnalyticsMetrics } from "@/types/enterprise";

export function useCallAnalytics(days: number = 14) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const callLog = useDedupedQuery({
    queryKey: QUERY_KEYS.callAnalytics.log(days),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("call_records")
        .select("id, caller_number, direction, duration_seconds, call_score, sentiment_score, status, started_at, assigned_coach")
        .gte("started_at", since)
        .order("started_at", { ascending: false })
        .limit(200);

      if (error) throw error;

      // Enrich with contact names
      const phones = [...new Set((data || []).map(c => c.caller_number).filter(Boolean))];
      const { data: contacts } = await supabase
        .from("contacts")
        .select("phone, first_name, last_name")
        .in("phone", phones);

      const contactMap = new Map((contacts || []).map(c => [c.phone, `${c.first_name} ${c.last_name}`]));

      return (data || []).map(call => ({
        id: call.id,
        lead_name: contactMap.get(call.caller_number) || call.caller_number || 'Unknown',
        direction: (call.direction || 'inbound') as 'inbound' | 'outbound',
        duration_seconds: Math.round((call.duration_seconds || 0) / 1000),
        intent_iq: Math.round(((call.call_score || 0) * 0.6) + ((call.sentiment_score || 0) * 100 * 0.4)),
        verdict: call.call_score && call.call_score > 7 ? 'High Intent' : 'Low Intent',
        coach: call.assigned_coach || 'Unassigned',
        status: call.status || 'completed',
        created_at: call.started_at || '',
      })) as EnrichedCallRecord[];
    },
  });

  const metrics = useDedupedQuery({
    queryKey: QUERY_KEYS.callAnalytics.metrics(days),
    queryFn: async (): Promise<CallAnalyticsMetrics> => {
      const calls = callLog.data || [];
      const totalCalls = calls.length;
      const avgIntentIQ = totalCalls > 0
        ? Math.round(calls.reduce((sum, c) => sum + c.intent_iq, 0) / totalCalls)
        : 0;
      const booked = calls.filter(c => c.status === 'booked' || c.status === 'completed').length;
      const bookingConversionRate = totalCalls > 0 ? Math.round((booked / totalCalls) * 100 * 10) / 10 : 0;
      const highIntent = calls.filter(c => c.intent_iq > 70);
      const revenueShadow = highIntent.length * 3500; // AED estimate per high-intent call

      return { totalCalls, avgIntentIQ, bookingConversionRate, revenueShadow };
    },
    enabled: !!callLog.data,
  });

  return { callLog, metrics, isLoading: callLog.isLoading };
}

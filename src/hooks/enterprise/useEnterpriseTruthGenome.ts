import { useDedupedQuery } from "@/hooks/useDedupedQuery";
import { QUERY_KEYS } from "@/config/queryKeys";
import { supabase } from "@/integrations/supabase/client";
import type { TruthGenomeRecord, SegmentCapacity } from "@/types/enterprise";

export function useEnterpriseTruthGenome() {
  const genome = useDedupedQuery({
    queryKey: QUERY_KEYS.enterprise.truthGenome,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mv_enterprise_truth_genome")
        .select("contact_id, lead_name, email, city, stage, first_touch_source, ad_id, verified_cash, payback_days, lead_intent_iq, avg_call_min, atlas_verdict, last_reconciled_at")
        .order("verified_cash", { ascending: false })
        .limit(500);

      if (error) throw error;
      return (data || []) as TruthGenomeRecord[];
    },
  });

  const segments = useDedupedQuery({
    queryKey: QUERY_KEYS.enterprise.segmentCapacity,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("view_segment_capacity_hud")
        .select("zone, gender, coach_count, avg_segment_load, total_segment_sessions");

      if (error) throw error;
      return (data || []) as SegmentCapacity[];
    },
  });

  const revenueShadow = useDedupedQuery({
    queryKey: QUERY_KEYS.enterprise.revenueShadow,
    queryFn: async () => {
      const genomeData = genome.data || [];
      const leaks = genomeData.filter(r =>
        r.atlas_verdict === 'ACTIVE PIPELINE' || r.atlas_verdict === 'HIGH INTENT'
      );
      const totalProjected = genomeData.reduce((sum, r) => sum + r.verified_cash, 0);
      return {
        projected_revenue: totalProjected,
        leads_in_shadow: leaks.length,
      };
    },
    enabled: !!genome.data,
  });

  return {
    genome,
    segments,
    revenueShadow,
    leaks: (genome.data || []).filter(r =>
      r.atlas_verdict === 'ACTIVE PIPELINE' || r.atlas_verdict === 'HIGH INTENT'
    ),
    isLoading: genome.isLoading || segments.isLoading,
  };
}

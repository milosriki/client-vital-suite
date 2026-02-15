import { useDedupedQuery } from "@/hooks/useDedupedQuery";
import { QUERY_KEYS } from "@/config/queryKeys";
import { supabase } from "@/integrations/supabase/client";
import type { CoachCapacityRecord, SegmentCapacity } from "@/types/enterprise";

export function useCoachCommand(zone?: string) {
  const coachLoad = useDedupedQuery({
    queryKey: QUERY_KEYS.coachCommand.load(zone),
    queryFn: async () => {
      let query = supabase
        .from("view_coach_capacity_load")
        .select("zone, gender, coach_name, sessions_14d, load_percentage, capacity_status")
        .order("load_percentage", { ascending: false });

      if (zone && zone !== 'all') {
        query = query.eq("zone", zone);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as CoachCapacityRecord[];
    },
  });

  const segmentHud = useDedupedQuery({
    queryKey: QUERY_KEYS.coachCommand.segmentHud,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("view_segment_capacity_hud")
        .select("zone, gender, coach_count, avg_segment_load, total_segment_sessions");

      if (error) throw error;
      return (data || []) as SegmentCapacity[];
    },
  });

  const totalCoaches = (coachLoad.data || []).length;
  const avgLoadDubai = (() => {
    const dubai = (coachLoad.data || []).filter(c => c.zone === 'Dubai');
    return dubai.length > 0 ? Math.round(dubai.reduce((s, c) => s + c.load_percentage, 0) / dubai.length) : 0;
  })();
  const avgLoadAD = (() => {
    const ad = (coachLoad.data || []).filter(c => c.zone === 'Abu Dhabi');
    return ad.length > 0 ? Math.round(ad.reduce((s, c) => s + c.load_percentage, 0) / ad.length) : 0;
  })();

  return {
    coachLoad,
    segmentHud,
    totalCoaches,
    avgLoadDubai,
    avgLoadAD,
    isLoading: coachLoad.isLoading || segmentHud.isLoading,
  };
}

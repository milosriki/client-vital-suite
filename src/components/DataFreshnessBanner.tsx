import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, Clock, CheckCircle } from "lucide-react";
import { differenceInHours, format } from "date-fns";

export function DataFreshnessBanner() {
  const { data: lastSync } = useQuery({
    queryKey: ["data-freshness"],
    queryFn: async () => {
      const { data } = await supabase
        .from("sync_logs")
        .select("started_at, sync_type, status")
        .eq("status", "completed")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  if (!lastSync) return null;

  const hoursAgo = differenceInHours(new Date(), new Date(lastSync.started_at));

  if (hoursAgo < 24) return null; // Fresh data — no banner

  const isStale = hoursAgo > 72;
  const isWarning = hoursAgo > 24 && hoursAgo <= 72;

  return (
    <div
      className={`flex items-center gap-2 px-4 py-1.5 text-xs font-medium ${
        isStale
          ? "bg-red-500/10 text-red-400 border-b border-red-500/20"
          : "bg-yellow-500/10 text-yellow-400 border-b border-yellow-500/20"
      }`}
    >
      {isStale ? (
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
      ) : (
        <Clock className="h-3.5 w-3.5 shrink-0" />
      )}
      <span>
        Data is {hoursAgo}h old — last sync: {format(new Date(lastSync.started_at), "MMM d, HH:mm")}.
        {isStale && " Run sync to update."}
      </span>
    </div>
  );
}

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { RefreshCw, Check, AlertCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type SyncLog = {
  id: string;
  platform: string;
  status: string;
  sync_type: string;
  started_at: string | null;
  completed_at: string | null;
  duration_ms: number | null;
  records_processed: number | null;
  records_failed: number | null;
  error_details: any | null;
};

type BadgeState = {
  variant: "default" | "secondary" | "destructive" | "outline";
  label: string;
  icon: typeof RefreshCw | typeof Check | typeof AlertCircle;
  className: string;
  animate?: boolean;
};

export function SyncStatusBadge() {
  const { data: syncLog } = useQuery({
    queryKey: ["hubspot-sync-status"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sync_logs")
        .select("*")
        .eq("platform", "hubspot")
        .order("started_at", { ascending: false })
        .limit(1)
        .single();

      // PGRST116 is the "no rows returned" error code
      if (error && error.code !== "PGRST116") {
        throw error;
      }

      return data as SyncLog | null;
    },
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });

  const getBadgeState = (): BadgeState => {
    if (!syncLog) {
      return {
        variant: "outline",
        label: "Unknown",
        icon: AlertCircle,
        className: "bg-gray-100 text-gray-700 border-gray-300",
      };
    }

    // Check for in-progress sync
    if (
      syncLog.status === "in_progress" ||
      syncLog.status === "running" ||
      syncLog.status === "syncing"
    ) {
      return {
        variant: "outline",
        label: "Syncing...",
        icon: RefreshCw,
        className: "bg-yellow-100 text-yellow-700 border-yellow-300",
        animate: true,
      };
    }

    // Check for failed sync
    if (
      syncLog.status === "error" ||
      syncLog.status === "failed" ||
      syncLog.status === "failure"
    ) {
      return {
        variant: "outline",
        label: "Sync Failed",
        icon: AlertCircle,
        className: "bg-red-100 text-red-700 border-red-300",
      };
    }

    // Check for successful sync within the last hour
    if (
      (syncLog.status === "completed" || syncLog.status === "success") &&
      syncLog.completed_at
    ) {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const completedAt = new Date(syncLog.completed_at);

      if (completedAt > oneHourAgo) {
        return {
          variant: "outline",
          label: "Synced",
          icon: Check,
          className: "bg-green-100 text-green-700 border-green-300",
        };
      }
    }

    // Default to unknown for any other state
    return {
      variant: "outline",
      label: "Unknown",
      icon: AlertCircle,
      className: "bg-gray-100 text-gray-700 border-gray-300",
    };
  };

  const formatTimestamp = (timestamp: string | null): string => {
    if (!timestamp) return "Never";

    try {
      const date = new Date(timestamp);
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return "Invalid date";
      }
      return formatDistanceToNow(date, { addSuffix: true });
    } catch {
      return "Unknown";
    }
  };

  const getTooltipText = (): string => {
    if (!syncLog) {
      return "No sync records found";
    }

    const timestamp = syncLog.completed_at || syncLog.started_at;
    const timeText = formatTimestamp(timestamp);

    if (syncLog.status === "in_progress" || syncLog.status === "running") {
      return `Sync started: ${timeText}`;
    }

    if (syncLog.status === "error" || syncLog.status === "failed") {
      return `Last sync failed: ${timeText}`;
    }

    return `Last sync: ${timeText}`;
  };

  const state = getBadgeState();
  const Icon = state.icon;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant={state.variant} className={state.className}>
            <Icon
              className={`w-3 h-3 mr-1 ${state.animate ? "animate-spin" : ""}`}
            />
            {state.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-sm">{getTooltipText()}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

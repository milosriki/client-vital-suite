import { RefreshCw, CheckCircle, AlertTriangle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatDistanceToNow } from "date-fns";
import { useMasterSync } from "@/hooks/useMasterSync";

/**
 * Master Sync Button — pulls fresh data from ALL sources:
 * HubSpot contacts/deals, Facebook ad insights, Stripe payments,
 * attribution linking, and owner name propagation.
 *
 * Place this in the global header or on key dashboard pages.
 */
export function SyncButton() {
  const { runSync, isSyncing, lastSync, lastSyncTime } = useMasterSync();

  const hasErrors = lastSync?.steps.some((s) => s.status === "error");
  const stepSummary = lastSync?.steps
    .filter((s) => s.status !== "skipped")
    .map(
      (s) =>
        `${s.status === "done" ? "✅" : s.status === "error" ? "❌" : "⏳"} ${s.name}: ${s.count ?? "-"} records${s.error ? ` (${s.error.substring(0, 60)})` : ""}`
    )
    .join("\n");

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            onClick={() => runSync()}
            disabled={isSyncing}
            className={
              isSyncing
                ? "border-blue-500/50 text-blue-400"
                : hasErrors
                  ? "border-amber-500/50 text-amber-400"
                  : ""
            }
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${isSyncing ? "animate-spin" : ""}`}
            />
            {isSyncing ? "Syncing..." : "Sync All"}
            {lastSyncTime && !isSyncing && (
              <span className="ml-2 text-xs text-muted-foreground">
                {formatDistanceToNow(lastSyncTime, { addSuffix: true })}
              </span>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          className="max-w-sm whitespace-pre-line text-xs"
        >
          {lastSync ? (
            <>
              <p className="font-semibold mb-1">
                Last sync: {(lastSync.durationMs / 1000).toFixed(1)}s
              </p>
              <p>{stepSummary}</p>
            </>
          ) : (
            <p>
              Sync all data from HubSpot, Facebook, Stripe.
              <br />
              Runs attribution linking & owner propagation.
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

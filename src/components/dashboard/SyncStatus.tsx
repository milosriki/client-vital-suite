import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, CheckCircle, XCircle, AlertCircle, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

interface SyncStatusData {
  sync_type: string;
  last_sync_time: string;
  status: string;
  records_processed: number;
  records_failed: number;
  duration_ms: number;
}

const syncTypeLabels: Record<string, string> = {
  deals: "Deals",
  contacts: "Contacts",
  owners: "Owners",
};

const syncTypeSchedules: Record<string, string> = {
  deals: "Every 15 minutes",
  contacts: "Every 5 minutes",
  owners: "Daily at 6 AM",
};

export function SyncStatus() {
  const { toast } = useToast();

  // Fetch sync status
  const { data: syncStatuses, isLoading, refetch } = useQuery<SyncStatusData[]>({
    queryKey: ["sync-status"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_latest_sync_status");
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Manual sync mutation
  const forceSyncMutation = useMutation({
    mutationFn: async (syncType: string) => {
      const { data, error } = await supabase.rpc("trigger_hubspot_sync", {
        sync_type: syncType,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, syncType) => {
      toast({
        title: "Sync Triggered",
        description: `${syncTypeLabels[syncType]} sync has been triggered successfully.`,
      });
      // Refetch status after a short delay to show updated data
      setTimeout(() => refetch(), 2000);
    },
    onError: (error: any) => {
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to trigger sync",
        variant: "destructive",
      });
    },
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-600" />;
      case "partial":
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      success: "default",
      failed: "destructive",
      partial: "secondary",
    } as const;

    return (
      <Badge variant={variants[status as keyof typeof variants] || "secondary"}>
        {status}
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>HubSpot Sync Status</CardTitle>
            <CardDescription>
              Real-time synchronization status from HubSpot
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            Loading sync status...
          </div>
        ) : !syncStatuses || syncStatuses.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No sync history available
          </div>
        ) : (
          <div className="space-y-4">
            {["deals", "contacts", "owners"].map((syncType) => {
              const status = syncStatuses.find((s) => s.sync_type === syncType);
              const isSyncing = forceSyncMutation.isPending && forceSyncMutation.variables === syncType;

              return (
                <div
                  key={syncType}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {status && getStatusIcon(status.status)}
                      <h4 className="font-semibold">{syncTypeLabels[syncType]}</h4>
                      {status && getStatusBadge(status.status)}
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      {status ? (
                        <>
                          <p>
                            Last synced:{" "}
                            {formatDistanceToNow(new Date(status.last_sync_time), {
                              addSuffix: true,
                            })}
                          </p>
                          <p>
                            Records: {status.records_processed} synced
                            {status.records_failed > 0 && `, ${status.records_failed} failed`}
                          </p>
                          <p>Duration: {(status.duration_ms / 1000).toFixed(2)}s</p>
                          <p className="text-xs">Schedule: {syncTypeSchedules[syncType]}</p>
                        </>
                      ) : (
                        <>
                          <p>Not synced yet</p>
                          <p className="text-xs">Schedule: {syncTypeSchedules[syncType]}</p>
                        </>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => forceSyncMutation.mutate(syncType)}
                    disabled={isSyncing}
                  >
                    {isSyncing ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Syncing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Force Sync
                      </>
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

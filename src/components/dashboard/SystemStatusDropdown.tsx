import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, RefreshCw, ExternalLink, AlertCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";

interface SystemStatusDropdownProps {
  isSyncing: boolean;
  onSync: () => void;
}

export function SystemStatusDropdown({ isSyncing, onSync }: SystemStatusDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Check connection statuses
  const { data: status, refetch: refetchStatus } = useQuery({
    queryKey: ['system-status'],
    queryFn: async () => {
      const supabaseConnected = true; // We're using it right now
      
      // Check last sync time from sync_queue
      const { data: syncData } = await supabase
        .from('sync_queue')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1);
      
      // Check for recent errors
      const { data: errors } = await supabase
        .from('sync_errors')
        .select('id')
        .gte('created_at', new Date(Date.now() - 3600000).toISOString());

      // Check HubSpot - look for recent successful sync logs
      const { data: hubspotSync } = await supabase
        .from('sync_logs')
        .select('status, started_at')
        .eq('platform', 'hubspot')
        .order('started_at', { ascending: false })
        .limit(1);
      
      // HubSpot is connected if last sync was successful and within 24 hours
      const hubspotConnected = hubspotSync?.[0]?.status === 'success' && 
        hubspotSync?.[0]?.started_at &&
        (Date.now() - new Date(hubspotSync[0].started_at).getTime()) < 86400000;

      // Check Stripe - look for recent webhook events in stripe_events (within 24h)
      // This properly verifies Stripe integration is working, not just that deals exist
      const { data: stripeData } = await supabase
        .from('stripe_events')
        .select('event_id, created_at')
        .order('created_at', { ascending: false })
        .limit(1);

      // Stripe is connected if we have recent events (within last 24 hours)
      const stripeConnected = stripeData?.[0]?.created_at &&
        (Date.now() - new Date(stripeData[0].created_at).getTime()) < 86400000;

      return {
        supabase: supabaseConnected,
        hubspot: hubspotConnected,
        stripe: stripeConnected,
        lastSync: syncData?.[0]?.created_at || hubspotSync?.[0]?.started_at,
        recentErrors: errors?.length || 0,
      };
    },
    refetchInterval: 60000,
  });

  const allGood = status?.supabase && status?.hubspot && status?.stripe && (status?.recentErrors || 0) === 0;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all cursor-pointer",
            "hover:bg-muted/50",
            allGood 
              ? "bg-success/10 border-success/20 text-success" 
              : "bg-warning/10 border-warning/20 text-warning"
          )}
          title="Click to see sync status"
        >
          {allGood ? (
            <CheckCircle className="h-3 w-3" />
          ) : (
            <AlertCircle className="h-3 w-3" />
          )}
          <span className="text-xs font-medium">
            {allGood ? "Connected" : "Issues"}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-4" align="end">
        <div className="space-y-4">
          <h4 className="font-semibold text-sm">System Status</h4>
          
          {/* Connection statuses */}
          <div className="space-y-2">
            <StatusRow 
              label="Supabase" 
              connected={status?.supabase ?? false} 
            />
            <StatusRow 
              label="HubSpot" 
              connected={status?.hubspot ?? false} 
            />
            <StatusRow 
              label="Stripe" 
              connected={status?.stripe ?? false} 
            />
          </div>
          
          {/* Last sync time */}
          {status?.lastSync && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>Last sync: {formatDistanceToNow(new Date(status.lastSync), { addSuffix: true })}</span>
            </div>
          )}
          
          {/* Recent errors */}
          {(status?.recentErrors || 0) > 0 && (
            <div className="flex items-center gap-2 text-xs text-warning">
              <AlertCircle className="h-3 w-3" />
              <span>{status?.recentErrors} errors in last hour</span>
            </div>
          )}
          
          {/* Actions */}
          <div className="flex flex-col gap-2 pt-2 border-t">
            <Button 
              size="sm" 
              onClick={() => { onSync(); setIsOpen(false); }}
              disabled={isSyncing}
              className="w-full justify-center"
            >
              <RefreshCw className={cn("h-3.5 w-3.5 mr-2", isSyncing && "animate-spin")} />
              {isSyncing ? "Syncing..." : "Sync Now"}
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full justify-center"
              onClick={() => window.open('https://app.hubspot.com', '_blank')}
            >
              <ExternalLink className="h-3.5 w-3.5 mr-2" />
              Open HubSpot
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function StatusRow({ label, connected }: { label: string; connected: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm">{label}</span>
      {connected ? (
        <div className="flex items-center gap-1 text-success">
          <CheckCircle className="h-3.5 w-3.5" />
          <span className="text-xs">Connected</span>
        </div>
      ) : (
        <div className="flex items-center gap-1 text-destructive">
          <XCircle className="h-3.5 w-3.5" />
          <span className="text-xs">Disconnected</span>
        </div>
      )}
    </div>
  );
}

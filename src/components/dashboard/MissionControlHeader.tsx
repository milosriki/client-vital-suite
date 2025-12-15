import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Wifi, WifiOff, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface MissionControlHeaderProps {
  title: string;
  subtitle?: string;
  isConnected?: boolean;
  lastUpdated?: Date | null;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export function MissionControlHeader({
  title,
  subtitle,
  isConnected = true,
  lastUpdated,
  onRefresh,
  isRefreshing = false,
}: MissionControlHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-border/50">
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{title}</h1>
          <Badge 
            variant="outline" 
            className={cn(
              "flex items-center gap-1.5 text-xs font-medium",
              isConnected 
                ? "border-success/30 bg-success/10 text-success" 
                : "border-destructive/30 bg-destructive/10 text-destructive"
            )}
          >
            {isConnected ? (
              <>
                <Wifi className="h-3 w-3" />
                Live
              </>
            ) : (
              <>
                <WifiOff className="h-3 w-3" />
                Offline
              </>
            )}
          </Badge>
        </div>
        {subtitle && (
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>
      
      <div className="flex items-center gap-3">
        {lastUpdated && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>Updated {format(lastUpdated, "HH:mm:ss")}</span>
          </div>
        )}
        {onRefresh && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onRefresh}
            disabled={isRefreshing}
            className="gap-2"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </Button>
        )}
      </div>
    </div>
  );
}

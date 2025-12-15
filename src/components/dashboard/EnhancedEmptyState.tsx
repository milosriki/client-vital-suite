import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { 
  CheckCircle, 
  Users, 
  Phone, 
  AlertTriangle, 
  Database, 
  RefreshCw,
  Zap,
  TrendingUp,
  Calendar,
  FileText
} from "lucide-react";

type EmptyStateType = 
  | "all-clear" 
  | "no-data" 
  | "no-clients" 
  | "no-calls" 
  | "no-alerts" 
  | "no-activity"
  | "sync-needed"
  | "no-interventions"
  | "no-revenue";

interface EnhancedEmptyStateProps {
  type: EmptyStateType;
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

const EMPTY_STATE_CONFIG: Record<EmptyStateType, {
  icon: React.ElementType;
  iconColor: string;
  defaultTitle: string;
  defaultDescription: string;
  defaultAction?: string;
}> = {
  "all-clear": {
    icon: CheckCircle,
    iconColor: "text-success",
    defaultTitle: "All Clear!",
    defaultDescription: "No items requiring attention right now.",
  },
  "no-data": {
    icon: Database,
    iconColor: "text-muted-foreground",
    defaultTitle: "No Data Yet",
    defaultDescription: "Data will appear here once synced.",
    defaultAction: "Sync Now",
  },
  "no-clients": {
    icon: Users,
    iconColor: "text-primary",
    defaultTitle: "No Clients Found",
    defaultDescription: "Sync from HubSpot to see client data.",
    defaultAction: "Sync HubSpot",
  },
  "no-calls": {
    icon: Phone,
    iconColor: "text-primary",
    defaultTitle: "No Calls Today",
    defaultDescription: "Call records will appear here.",
    defaultAction: "View All Calls",
  },
  "no-alerts": {
    icon: AlertTriangle,
    iconColor: "text-success",
    defaultTitle: "No Alerts",
    defaultDescription: "Everything is running smoothly.",
  },
  "no-activity": {
    icon: Zap,
    iconColor: "text-muted-foreground",
    defaultTitle: "No Recent Activity",
    defaultDescription: "Activity will appear here in real-time.",
    defaultAction: "Refresh",
  },
  "sync-needed": {
    icon: RefreshCw,
    iconColor: "text-warning",
    defaultTitle: "Sync Required",
    defaultDescription: "Connect and sync to see your data.",
    defaultAction: "Sync Now",
  },
  "no-interventions": {
    icon: CheckCircle,
    iconColor: "text-success",
    defaultTitle: "All Caught Up!",
    defaultDescription: "No interventions needed at this time.",
  },
  "no-revenue": {
    icon: TrendingUp,
    iconColor: "text-muted-foreground",
    defaultTitle: "No Revenue Data",
    defaultDescription: "Revenue will appear once deals are closed.",
    defaultAction: "View Pipeline",
  },
};

export function EnhancedEmptyState({
  type,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: EnhancedEmptyStateProps) {
  const config = EMPTY_STATE_CONFIG[type];
  const Icon = config.icon;

  return (
    <div className={cn(
      "flex flex-col items-center justify-center py-12 px-4 text-center",
      className
    )}>
      <div className={cn(
        "relative mb-4",
        type === "all-clear" && "animate-bounce"
      )}>
        <div className={cn(
          "w-16 h-16 rounded-full flex items-center justify-center",
          type === "all-clear" ? "bg-success/10" : "bg-muted/30"
        )}>
          <Icon className={cn("h-8 w-8", config.iconColor)} />
        </div>
        {type === "all-clear" && (
          <div className="absolute -top-1 -right-1 w-5 h-5 bg-success rounded-full flex items-center justify-center">
            <span className="text-xs">✓</span>
          </div>
        )}
      </div>

      <h3 className="text-lg font-semibold mb-1">
        {title || config.defaultTitle}
      </h3>
      <p className="text-sm text-muted-foreground max-w-xs mb-4">
        {description || config.defaultDescription}
      </p>

      {(actionLabel || config.defaultAction) && onAction && (
        <Button variant="outline" size="sm" onClick={onAction} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          {actionLabel || config.defaultAction}
        </Button>
      )}
    </div>
  );
}

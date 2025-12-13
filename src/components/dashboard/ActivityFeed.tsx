import { formatDistanceToNow } from "date-fns";
import { 
  UserPlus, 
  AlertTriangle, 
  DollarSign, 
  CheckCircle,
  XCircle,
  RefreshCw,
  ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

interface ActivityItem {
  id: string;
  type: "signup" | "churn" | "payment" | "intervention" | "sync" | "alert";
  title: string;
  description: string;
  timestamp: Date;
  metadata?: any;
}

interface ActivityFeedProps {
  activities: ActivityItem[];
  isLoading?: boolean;
}

export function ActivityFeed({ activities, isLoading }: ActivityFeedProps) {
  const getIcon = (type: string) => {
    switch (type) {
      case "signup":
        return { icon: UserPlus, color: "text-success bg-success/20" };
      case "churn":
        return { icon: XCircle, color: "text-destructive bg-destructive/20" };
      case "payment":
        return { icon: DollarSign, color: "text-success bg-success/20" };
      case "intervention":
        return { icon: AlertTriangle, color: "text-warning bg-warning/20" };
      case "sync":
        return { icon: RefreshCw, color: "text-primary bg-primary/20" };
      case "alert":
        return { icon: AlertTriangle, color: "text-destructive bg-destructive/20" };
      default:
        return { icon: CheckCircle, color: "text-muted-foreground bg-muted" };
    }
  };

  const displayActivities = activities.slice(0, 5);

  return (
    <div className="premium-card p-6 animate-fade-up" style={{ animationDelay: '400ms' }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Recent Activity</h3>
        <Link to="/interventions">
          <Button variant="ghost" size="sm" className="text-xs gap-1 text-muted-foreground hover:text-foreground">
            View All <ArrowRight className="h-3 w-3" />
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-start gap-3 animate-pulse">
              <div className="w-8 h-8 rounded-lg bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-muted rounded w-2/3" />
                <div className="h-2 bg-muted rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : displayActivities.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <CheckCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No recent activity</p>
          <p className="text-xs">All systems running smoothly</p>
        </div>
      ) : (
        <div className="space-y-4">
          {displayActivities.map((activity) => {
            const { icon: Icon, color } = getIcon(activity.type);
            return (
              <div key={activity.id} className="flex items-start gap-3 group">
                <div className={cn("p-2 rounded-lg transition-colors", color)}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {activity.title}
                  </p>
                  <p className="text-xs text-muted-foreground line-clamp-1">
                    {activity.description}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {formatDistanceToNow(activity.timestamp, { addSuffix: true })}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

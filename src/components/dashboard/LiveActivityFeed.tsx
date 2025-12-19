import { supabase } from "@/integrations/supabase/client";
import { QUERY_KEYS } from "@/config/queryKeys";
import { useDedupedQuery } from "@/hooks/useDedupedQuery";
import { formatDistanceToNow } from "date-fns";
import {
  Phone,
  Mail,
  Calendar,
  DollarSign,
  UserPlus,
  CheckCircle,
  ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

interface Activity {
  id: string;
  activity_type: string;
  activity_title: string;
  activity_description: string;
  occurred_at: string;
  hubspot_contact_id?: string;
}

const HUBSPOT_PORTAL_ID = "139617706"; // PTD Fitness HubSpot Portal

export function LiveActivityFeed() {
  const { data: activities, isLoading } = useDedupedQuery({
    queryKey: QUERY_KEYS.activity.liveFeed,
    dedupeIntervalMs: 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contact_activities')
        .select('id, activity_type, activity_title, activity_description, occurred_at, hubspot_contact_id')
        .order('occurred_at', { ascending: false })
        .limit(8);
      
      if (error) throw error;
      return data as Activity[];
    },
    staleTime: Infinity, // Real-time updates via useVitalState
  });

  const getActivityIcon = (type: string) => {
    const iconMap: Record<string, { icon: React.ElementType; color: string }> = {
      'call': { icon: Phone, color: "text-primary bg-primary/10" },
      'email': { icon: Mail, color: "text-blue-400 bg-blue-400/10" },
      'meeting': { icon: Calendar, color: "text-success bg-success/10" },
      'payment': { icon: DollarSign, color: "text-success bg-success/10" },
      'signup': { icon: UserPlus, color: "text-warning bg-warning/10" },
      'note': { icon: CheckCircle, color: "text-muted-foreground bg-muted" },
    };
    return iconMap[type?.toLowerCase()] || iconMap['note'];
  };

  const handleActivityClick = (activity: Activity) => {
    if (activity.hubspot_contact_id) {
      window.open(
        `https://app.hubspot.com/contacts/${HUBSPOT_PORTAL_ID}/contact/${activity.hubspot_contact_id}`,
        '_blank',
        'noopener,noreferrer'
      );
    }
  };

  return (
    <div className="premium-card p-6 animate-fade-up" style={{ animationDelay: '300ms' }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Live Activity
        </h3>
        <Link to="/hubspot-live">
          <Button variant="ghost" size="sm" className="text-xs gap-1 text-muted-foreground hover:text-foreground">
            View All <ArrowRight className="h-3 w-3" />
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-start gap-3 animate-pulse">
              <div className="w-8 h-8 rounded-lg bg-muted/30 shimmer" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-muted/30 rounded w-2/3 shimmer" />
                <div className="h-2 bg-muted/30 rounded w-1/2 shimmer" />
              </div>
            </div>
          ))}
        </div>
      ) : !activities?.length ? (
        <div className="text-center py-8 text-muted-foreground">
          <CheckCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No recent activity</p>
          <p className="text-xs">Sync HubSpot to see activity</p>
        </div>
      ) : (
        <div className="space-y-1">
          {/* Timeline line */}
          <div className="relative">
            <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
            
            <div className="space-y-4">
              {activities.map((activity) => {
                const { icon: Icon, color } = getActivityIcon(activity.activity_type);
                const isClickable = !!activity.hubspot_contact_id;
                
                return (
                  <div 
                    key={activity.id} 
                    onClick={() => isClickable && handleActivityClick(activity)}
                    className={cn(
                      "relative flex items-start gap-3 pl-0 group",
                      isClickable && "cursor-pointer"
                    )}
                  >
                    <div className={cn(
                      "relative z-10 p-2 rounded-lg transition-colors",
                      color,
                      isClickable && "group-hover:ring-2 group-hover:ring-primary/20"
                    )}>
                      <Icon className="h-4 w-4" />
                    </div>
                    
                    <div className="flex-1 min-w-0 pt-0.5">
                      <p className={cn(
                        "text-sm font-medium text-foreground truncate",
                        isClickable && "group-hover:text-primary"
                      )}>
                        {activity.activity_title || activity.activity_type}
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {activity.activity_description}
                      </p>
                    </div>
                    
                    <span className="text-xs text-muted-foreground shrink-0">
                      {formatDistanceToNow(new Date(activity.occurred_at), { addSuffix: false })}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

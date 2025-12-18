import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import {
  RefreshCw,
  Users,
  Phone,
  TrendingUp,
  Zap,
  Target,
  Play,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useState } from "react";
import { useSyncLock, SYNC_OPERATIONS } from "@/hooks/useSyncLock";

interface QuickAction {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  action: () => void | Promise<void>;
  variant?: "default" | "primary" | "success" | "warning";
}

export function QuickActionsPanel() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState<string | null>(null);
  
  // Use sync locks to prevent race conditions
  const hubspotSync = useSyncLock(SYNC_OPERATIONS.HUBSPOT_SYNC);
  const biAgentSync = useSyncLock(SYNC_OPERATIONS.BI_AGENT);
  const interventionsSync = useSyncLock(SYNC_OPERATIONS.INTERVENTIONS);

  const runBIAgent = async () => {
    await biAgentSync.execute(async () => {
      setLoading("bi-agent");
      try {
        const { data, error } = await supabase.functions.invoke("business-intelligence");
        if (error) throw error;
        toast({
          title: "BI Agent Complete",
          description: `Analyzed ${data?.clients_analyzed || 0} clients`,
        });
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'An error occurred';
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
      } finally {
        setLoading(null);
      }
    }, { lockMessage: 'BI Agent is already running' });
  };

  const syncHubSpot = async () => {
    await hubspotSync.execute(async () => {
      setLoading("sync");
      try {
        const { data, error } = await supabase.functions.invoke("sync-hubspot-to-supabase");
        if (error) throw error;
        toast({
          title: "Sync Complete",
          description: `Synced ${data?.contacts_synced || 0} contacts`,
        });
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'An error occurred';
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
      } finally {
        setLoading(null);
      }
    }, { lockMessage: 'HubSpot sync is already in progress' });
  };

  const generateInterventions = async () => {
    await interventionsSync.execute(async () => {
      setLoading("interventions");
      try {
        const { data, error } = await supabase.functions.invoke("intervention-recommender");
        if (error) throw error;
        toast({
          title: "Interventions Generated",
          description: `Created ${data?.interventions_created || 0} recommendations`,
        });
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'An error occurred';
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
      } finally {
        setLoading(null);
      }
    }, { lockMessage: 'Intervention generation is already running' });
  };

  const actions: QuickAction[] = [
    {
      id: "sync",
      label: "Sync HubSpot",
      description: "Fetch latest CRM data",
      icon: RefreshCw,
      action: syncHubSpot,
      variant: "default",
    },
    {
      id: "bi-agent",
      label: "Run BI Agent",
      description: "Analyze client health",
      icon: TrendingUp,
      action: runBIAgent,
      variant: "primary",
    },
    {
      id: "interventions",
      label: "Generate Interventions",
      description: "AI recommendations",
      icon: Target,
      action: generateInterventions,
      variant: "warning",
    },
    {
      id: "clients",
      label: "View Clients",
      description: "Client health dashboard",
      icon: Users,
      action: () => navigate("/clients"),
    },
    {
      id: "calls",
      label: "Call Tracking",
      description: "Review call logs",
      icon: Phone,
      action: () => navigate("/call-tracking"),
    },
    {
      id: "ptd",
      label: "AI Control",
      description: "PTD Intelligence",
      icon: Zap,
      action: () => navigate("/ptd-control"),
      variant: "primary",
    },
  ];

  const variantStyles = {
    default: "bg-card/80 border-border/50 hover:border-primary/30",
    primary: "bg-primary/5 border-primary/20 hover:bg-primary/10 hover:border-primary/40",
    success: "bg-success/5 border-success/20 hover:bg-success/10 hover:border-success/40",
    warning: "bg-warning/5 border-warning/20 hover:bg-warning/10 hover:border-warning/40",
  };

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Play className="h-4 w-4 text-primary" />
          Quick Actions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {actions.map((action) => {
            const Icon = action.icon;
            const isLoading = loading === action.id;
            const variant = action.variant || "default";

            return (
              <button
                key={action.id}
                onClick={() => action.action()}
                disabled={isLoading}
                className={cn(
                  "group relative flex flex-col items-start p-4 rounded-xl border transition-all duration-200",
                  "hover:-translate-y-0.5 hover:shadow-md",
                  variantStyles[variant],
                  isLoading && "opacity-70 pointer-events-none"
                )}
              >
                <div className={cn(
                  "p-2 rounded-lg mb-2 transition-colors",
                  variant === "primary" && "bg-primary/10",
                  variant === "warning" && "bg-warning/10",
                  variant === "success" && "bg-success/10",
                  variant === "default" && "bg-muted/50"
                )}>
                  <Icon className={cn(
                    "h-4 w-4",
                    isLoading && "animate-spin",
                    variant === "primary" && "text-primary",
                    variant === "warning" && "text-warning",
                    variant === "success" && "text-success",
                    variant === "default" && "text-muted-foreground"
                  )} />
                </div>
                <span className="font-medium text-sm">{action.label}</span>
                <span className="text-xs text-muted-foreground line-clamp-1">
                  {action.description}
                </span>
                <ArrowRight className="absolute top-4 right-4 h-3 w-3 text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
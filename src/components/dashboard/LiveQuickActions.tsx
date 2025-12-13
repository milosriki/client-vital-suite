import { useNavigate } from "react-router-dom";
import { 
  BrainCircuit, 
  RefreshCw, 
  AlertTriangle, 
  Command,
  Bot,
  ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface LiveQuickActionsProps {
  onRunBI: () => void;
  onSyncHubSpot: () => void;
  onOpenAI: () => void;
  isRunningBI?: boolean;
  isSyncing?: boolean;
}

export function LiveQuickActions({ 
  onRunBI, 
  onSyncHubSpot, 
  onOpenAI,
  isRunningBI = false,
  isSyncing = false
}: LiveQuickActionsProps) {
  const navigate = useNavigate();

  const actions = [
    {
      label: "Run BI Agent",
      icon: BrainCircuit,
      onClick: onRunBI,
      loading: isRunningBI,
      variant: "primary" as const,
    },
    {
      label: "Sync HubSpot",
      icon: RefreshCw,
      onClick: onSyncHubSpot,
      loading: isSyncing,
      variant: "default" as const,
    },
    {
      label: "View At-Risk",
      icon: AlertTriangle,
      onClick: () => navigate('/clients?zone=RED'),
      variant: "danger" as const,
    },
    {
      label: "Today's Calls",
      icon: RefreshCw,
      onClick: () => navigate('/setter-activity-today'),
      variant: "default" as const,
    },
    {
      label: "PTD Control",
      icon: Command,
      onClick: () => navigate('/ptd-control'),
      variant: "default" as const,
    },
    {
      label: "Open HubSpot",
      icon: ExternalLink,
      onClick: () => window.open('https://app.hubspot.com', '_blank', 'noopener,noreferrer'),
      variant: "default" as const,
    },
  ];

  const getVariantClass = (variant: string) => {
    switch (variant) {
      case "primary":
        return "bg-primary/10 border-primary/30 hover:bg-primary/20 hover:border-primary/50 text-primary";
      case "danger":
        return "bg-destructive/10 border-destructive/30 hover:bg-destructive/20 hover:border-destructive/50 text-destructive";
      default:
        return "bg-muted/30 border-border hover:bg-muted/50 hover:border-primary/30 text-foreground";
    }
  };

  return (
    <div className="premium-card p-6 animate-fade-up" style={{ animationDelay: '300ms' }}>
      <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground mb-4">
        Quick Actions
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {actions.map((action) => (
          <Button
            key={action.label}
            variant="outline"
            onClick={action.onClick}
            disabled={action.loading}
            className={cn(
              "h-16 flex flex-col items-center justify-center gap-1.5 border transition-all duration-200",
              getVariantClass(action.variant)
            )}
          >
            <action.icon className={cn("h-4 w-4", action.loading && "animate-spin")} />
            <span className="text-xs font-medium text-center leading-tight">
              {action.loading ? "Running..." : action.label}
            </span>
          </Button>
        ))}
      </div>
    </div>
  );
}

import { useNavigate } from "react-router-dom";
import { 
  BrainCircuit, 
  RefreshCw, 
  AlertTriangle, 
  FileText, 
  Command,
  Bot,
  Zap,
  TrendingUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface QuickActionsProps {
  onRunBI: () => void;
  onSyncHubSpot: () => void;
  onOpenAI: () => void;
  isRunningBI?: boolean;
  isSyncing?: boolean;
}

export function QuickActions({ 
  onRunBI, 
  onSyncHubSpot, 
  onOpenAI,
  isRunningBI = false,
  isSyncing = false
}: QuickActionsProps) {
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
      onClick: () => navigate('/clients?filter=at-risk'),
      variant: "warning" as const,
    },
    {
      label: "Analytics",
      icon: TrendingUp,
      onClick: () => navigate('/analytics'),
      variant: "default" as const,
    },
    {
      label: "PTD Control",
      icon: Command,
      onClick: () => navigate('/ptd-control'),
      variant: "default" as const,
    },
    {
      label: "AI Assistant",
      icon: Bot,
      onClick: onOpenAI,
      variant: "purple" as const,
    },
  ];

  const getVariantClass = (variant: string) => {
    switch (variant) {
      case "primary":
        return "bg-primary/10 border-primary/30 hover:bg-primary/20 hover:border-primary/50 text-primary";
      case "warning":
        return "bg-warning/10 border-warning/30 hover:bg-warning/20 hover:border-warning/50 text-warning";
      case "purple":
        return "bg-health-purple/10 border-health-purple/30 hover:bg-health-purple/20 hover:border-health-purple/50 text-health-purple";
      default:
        return "bg-muted/30 border-border hover:bg-muted/50 hover:border-primary/30 text-foreground";
    }
  };

  return (
    <div className="premium-card p-6 animate-fade-up" style={{ animationDelay: '300ms' }}>
      <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {actions.map((action, i) => (
          <Button
            key={action.label}
            variant="outline"
            onClick={action.onClick}
            disabled={action.loading}
            className={cn(
              "h-20 flex flex-col items-center justify-center gap-2 border transition-all duration-200",
              getVariantClass(action.variant)
            )}
          >
            <action.icon className={cn("h-5 w-5", action.loading && "animate-spin")} />
            <span className="text-xs font-medium text-center leading-tight">
              {action.loading ? "Running..." : action.label}
            </span>
          </Button>
        ))}
      </div>
    </div>
  );
}

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  BrainCircuit, 
  RefreshCw, 
  AlertTriangle, 
  Command,
  ExternalLink,
  Phone,
  Sparkles,
  Activity,
  FileText,
  Zap
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

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
  const [isRunningChurn, setIsRunningChurn] = useState(false);
  const [isRunningReport, setIsRunningReport] = useState(false);

  const runChurnPredictor = async () => {
    setIsRunningChurn(true);
    try {
      const { data, error } = await supabase.functions.invoke('churn-predictor');
      if (error) throw error;
      toast({ title: 'Churn Analysis Complete', description: `Analyzed ${data?.clients_analyzed || 0} clients` });
    } catch (error: any) {
      toast({ title: 'Churn Analysis Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsRunningChurn(false);
    }
  };

  const generateDailyReport = async () => {
    setIsRunningReport(true);
    try {
      const { data, error } = await supabase.functions.invoke('daily-report');
      if (error) throw error;
      toast({ title: 'Report Generated', description: 'Daily report is ready' });
    } catch (error: any) {
      toast({ title: 'Report Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsRunningReport(false);
    }
  };

  const actions = [
    {
      label: "Run BI Agent",
      description: "Analyze data",
      icon: BrainCircuit,
      onClick: onRunBI,
      loading: isRunningBI,
      variant: "primary" as const,
    },
    {
      label: "Sync HubSpot",
      description: "Pull latest",
      icon: RefreshCw,
      onClick: onSyncHubSpot,
      loading: isSyncing,
      variant: "default" as const,
    },
    {
      label: "Churn Predictor",
      description: "Predict risk",
      icon: Activity,
      onClick: runChurnPredictor,
      loading: isRunningChurn,
      variant: "danger" as const,
    },
    {
      label: "Daily Report",
      description: "Generate now",
      icon: FileText,
      onClick: generateDailyReport,
      loading: isRunningReport,
      variant: "default" as const,
    },
    {
      label: "PTD Control",
      description: "Command center",
      icon: Command,
      onClick: () => navigate('/ptd-control'),
      variant: "default" as const,
    },
    {
      label: "At-Risk Clients",
      description: "View critical",
      icon: AlertTriangle,
      onClick: () => navigate('/clients?zone=RED'),
      variant: "danger" as const,
    },
  ];

  const getVariantStyles = (variant: string) => {
    switch (variant) {
      case "primary":
        return {
          bg: "bg-gradient-to-br from-primary/20 to-primary/5",
          border: "border-primary/30 hover:border-primary/60",
          text: "text-primary",
          glow: "hover:shadow-[0_0_25px_hsl(var(--primary)/0.4)]",
        };
      case "danger":
        return {
          bg: "bg-gradient-to-br from-destructive/20 to-destructive/5",
          border: "border-destructive/30 hover:border-destructive/60",
          text: "text-destructive",
          glow: "hover:shadow-[0_0_25px_hsl(var(--destructive)/0.4)]",
        };
      default:
        return {
          bg: "bg-gradient-to-br from-muted/50 to-muted/20",
          border: "border-border hover:border-primary/40",
          text: "text-foreground",
          glow: "hover:shadow-[0_0_25px_hsl(var(--primary)/0.2)]",
        };
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-br from-card via-card to-primary/5 p-6 animate-fade-up shadow-sm hover:shadow-md transition-shadow duration-300" style={{ animationDelay: '300ms' }}>
      {/* Decorative sparkle glow */}
      <div className="absolute top-0 right-0 w-28 h-28 bg-gradient-to-bl from-primary/10 to-transparent rounded-full blur-2xl" />
      
      <div className="relative flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Quick Actions
          </h3>
        </div>
        <span className="text-[10px] text-muted-foreground bg-muted/40 px-2 py-1 rounded-full border border-border/50">
          {actions.length} actions
        </span>
      </div>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {actions.map((action) => {
          const styles = getVariantStyles(action.variant);
          
          return (
            <button
              key={action.label}
              onClick={action.onClick}
              disabled={action.loading}
              className={cn(
                "group relative overflow-hidden h-20 flex flex-col items-center justify-center gap-1.5 rounded-xl border transition-all duration-300",
                styles.bg,
                styles.border,
                styles.glow,
                "hover:-translate-y-1 hover:scale-[1.02]",
                "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:scale-100"
              )}
            >
              {/* Shine effect */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              </div>
              
              <action.icon className={cn(
                "relative h-5 w-5 transition-transform duration-300 group-hover:scale-110",
                styles.text,
                action.loading && "animate-spin"
              )} />
              
              <div className="relative text-center">
                <span className={cn(
                  "text-xs font-semibold block",
                  styles.text
                )}>
                  {action.loading ? "Running..." : action.label}
                </span>
                <span className="text-[10px] text-muted-foreground hidden sm:block">
                  {action.description}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
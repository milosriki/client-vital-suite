import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: "default" | "success" | "warning" | "danger" | "purple";
  delay?: number;
  subtitle?: string;
  pulse?: boolean;
}

export function StatCard({ 
  label, 
  value, 
  icon: Icon, 
  trend, 
  variant = "default",
  delay = 0,
  subtitle,
  pulse = false
}: StatCardProps) {
  const variantStyles = {
    default: "from-primary/10 to-primary/5 border-primary/20",
    success: "from-success/10 to-success/5 border-success/20",
    warning: "from-warning/10 to-warning/5 border-warning/20",
    danger: "from-destructive/10 to-destructive/5 border-destructive/20",
    purple: "from-health-purple/10 to-health-purple/5 border-health-purple/20",
  };

  const iconColors = {
    default: "text-primary bg-primary/20",
    success: "text-success bg-success/20",
    warning: "text-warning bg-warning/20",
    danger: "text-destructive bg-destructive/20",
    purple: "text-health-purple bg-health-purple/20",
  };

  return (
    <div 
      className={cn(
        "stat-card bg-gradient-to-br border animate-fade-up",
        variantStyles[variant]
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className="stat-number text-3xl sm:text-4xl text-foreground">
            {value}
          </p>
          {trend && (
            <div className="flex items-center gap-1.5">
              {trend.isPositive ? (
                <TrendingUp className="h-3.5 w-3.5 text-success" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5 text-destructive" />
              )}
              <span className={cn(
                "text-xs font-medium",
                trend.isPositive ? "text-success" : "text-destructive"
              )}>
                {trend.isPositive ? "+" : ""}{trend.value}%
              </span>
              <span className="text-xs text-muted-foreground">vs last period</span>
            </div>
          )}
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
        <div className={cn(
          "p-3 rounded-xl transition-transform hover:scale-110",
          iconColors[variant],
          pulse && "relative"
        )}>
          <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
          {pulse && (
            <span className="absolute inset-0 rounded-xl animate-ping bg-destructive/40" />
          )}
        </div>
      </div>
    </div>
  );
}

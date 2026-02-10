import { LucideIcon, TrendingUp, TrendingDown, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { PremiumCard } from "@/components/ui/premium-card";
import { Skeleton } from "@/components/ui/skeleton";

interface MetricCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: "default" | "success" | "warning" | "danger" | "info";
  isLoading?: boolean;
  onClick?: () => void;
  subtitle?: string;
  pulse?: boolean;
  className?: string;
}

export function MetricCard({
  label,
  value,
  icon: Icon,
  trend,
  variant = "default",
  isLoading = false,
  onClick,
  subtitle,
  pulse = false,
  className,
}: MetricCardProps) {
  const variantStyles = {
    default: {
      container: "bg-card/80 border-border/50 hover:border-primary/30",
      iconBg: "bg-primary/10",
      iconColor: "text-primary",
      glow: "group-hover:shadow-primary/5",
    },
    success: {
      container: "bg-success/5 border-success/20 hover:border-success/40",
      iconBg: "bg-success/15",
      iconColor: "text-success",
      glow: "group-hover:shadow-success/10",
    },
    warning: {
      container: "bg-warning/5 border-warning/20 hover:border-warning/40",
      iconBg: "bg-warning/15",
      iconColor: "text-warning",
      glow: "group-hover:shadow-warning/10",
    },
    danger: {
      container:
        "bg-destructive/5 border-destructive/20 hover:border-destructive/40",
      iconBg: "bg-destructive/15",
      iconColor: "text-destructive",
      glow: "group-hover:shadow-destructive/10",
    },
    info: {
      container: "bg-primary/5 border-primary/20 hover:border-primary/40",
      iconBg: "bg-primary/15",
      iconColor: "text-primary",
      glow: "group-hover:shadow-primary/10",
    },
  };

  const styles = variantStyles[variant];

  if (isLoading && !data) {
    return (
      <PremiumCard
        className={cn(
          "relative rounded-xl border p-4 sm:p-5",
          styles.container,
          className,
        )}
        variant="glass"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2 flex-1">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="h-10 w-10 rounded-lg" />
        </div>
      </PremiumCard>
    );
  }

  return (
    <PremiumCard
      onClick={onClick}
      className={cn(
        "group relative rounded-xl border p-4 sm:p-5 transition-all duration-200",
        styles.container,
        onClick && "cursor-pointer", // hover lift is built-in to PremiumCard but we can keep cursor
        pulse && "animate-pulse",
        className,
      )}
      variant="glass"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {label}
          </p>
          <p className="text-2xl sm:text-3xl font-bold font-mono tabular-nums">
            {value}
          </p>
          {trend && (
            <div
              className={cn(
                "flex items-center gap-1 text-xs font-medium",
                trend.isPositive ? "text-success" : "text-destructive",
              )}
            >
              {trend.isPositive ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              <span>
                {trend.isPositive ? "+" : ""}
                {trend.value}%
              </span>
              <span className="text-muted-foreground font-normal">
                vs last period
              </span>
            </div>
          )}
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>

        <div
          className={cn(
            "p-2.5 rounded-lg transition-transform duration-200 group-hover:scale-105",
            styles.iconBg,
          )}
        >
          <Icon className={cn("h-5 w-5", styles.iconColor)} />
        </div>
      </div>

      {onClick && (
        <ArrowRight className="absolute bottom-4 right-4 h-4 w-4 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
    </PremiumCard>
  );
}

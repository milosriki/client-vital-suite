import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

interface HeroStatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: "default" | "success" | "warning" | "danger";
  delay?: number;
  subtitle?: string;
  pulse?: boolean;
  href?: string;
  emptyMessage?: string;
  isLoading?: boolean;
  metricType?: "revenue" | "clients" | "pipeline" | "attention";
  onDrilldown?: (type: string) => void;
}

function AnimatedNumber({ value, duration = 800 }: { value: number; duration?: number }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let startTime: number;
    let animationFrame: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      
      setDisplayValue(Math.floor(progress * value));
      
      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [value, duration]);

  return <>{displayValue.toLocaleString()}</>;
}

export function HeroStatCard({ 
  label, 
  value, 
  icon: Icon, 
  trend, 
  variant = "default",
  delay = 0,
  subtitle,
  pulse = false,
  href,
  emptyMessage,
  isLoading = false,
  metricType,
  onDrilldown
}: HeroStatCardProps) {
  const navigate = useNavigate();

  const variantStyles = {
    default: "border-primary/20 hover:border-primary/40",
    success: "border-success/20 hover:border-success/40",
    warning: "border-warning/20 hover:border-warning/40",
    danger: "border-destructive/20 hover:border-destructive/40",
  };

  const iconColors = {
    default: "text-primary bg-primary/10",
    success: "text-success bg-success/10",
    warning: "text-warning bg-warning/10",
    danger: "text-destructive bg-destructive/10",
  };

  const numericValue = typeof value === 'number' ? value : parseFloat(value.toString().replace(/[^0-9.-]/g, ''));
  const isNumeric = !isNaN(numericValue);
  const isEmpty = value === 0 || value === '0' || value === 'AED 0';

  const handleClick = () => {
    if (metricType && onDrilldown) {
      onDrilldown(metricType);
    } else if (href) {
      navigate(href);
    }
  };

  if (isLoading) {
    return (
      <div 
        className={cn(
          "stat-card animate-fade-up",
          variantStyles[variant]
        )}
        style={{ animationDelay: `${delay}ms` }}
      >
        <div className="flex items-start justify-between">
          <div className="space-y-3 flex-1">
            <div className="skeleton h-3 w-24" />
            <div className="skeleton h-10 w-32" />
            <div className="skeleton h-3 w-20" />
          </div>
          <div className={cn("p-3 rounded-xl", iconColors[variant])}>
            <Icon className="h-6 w-6 opacity-50" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      onClick={handleClick}
      className={cn(
        "stat-card animate-fade-up cursor-pointer",
        variantStyles[variant],
        pulse && "pulse-glow"
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          
          {isEmpty && emptyMessage ? (
            <div>
              <p className="text-lg font-medium text-muted-foreground">{emptyMessage}</p>
            </div>
          ) : (
            <p className="stat-number text-3xl sm:text-4xl text-foreground animate-count-up">
              {typeof value === 'string' && value.startsWith('AED') ? (
                <>AED <AnimatedNumber value={numericValue} /></>
              ) : isNumeric ? (
                <AnimatedNumber value={numericValue} />
              ) : (
                value
              )}
            </p>
          )}
          
          {trend && !isEmpty && (
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
              <span className="text-xs text-muted-foreground">vs last month</span>
            </div>
          )}
          
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
        
        <div className={cn(
          "p-3 rounded-xl transition-transform hover:scale-110",
          iconColors[variant]
        )}>
          <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
        </div>
      </div>
    </div>
  );
}

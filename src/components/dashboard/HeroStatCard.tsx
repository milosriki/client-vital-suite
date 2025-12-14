import { LucideIcon, TrendingUp, TrendingDown, ArrowRight } from "lucide-react";
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
      
      // Easing function for smoother animation
      const easeOut = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.floor(easeOut * value));
      
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
  const [isHovered, setIsHovered] = useState(false);

  const variantStyles = {
    default: {
      border: "border-primary/10 hover:border-primary/30",
      gradient: "from-primary/5 via-transparent to-transparent",
      iconBg: "bg-primary/10",
      iconColor: "text-primary",
      glow: "hover:shadow-glow-sm",
    },
    success: {
      border: "border-success/10 hover:border-success/30",
      gradient: "from-success/5 via-transparent to-transparent",
      iconBg: "bg-success/10",
      iconColor: "text-success",
      glow: "hover:shadow-glow-success",
    },
    warning: {
      border: "border-warning/10 hover:border-warning/30",
      gradient: "from-warning/5 via-transparent to-transparent",
      iconBg: "bg-warning/10",
      iconColor: "text-warning",
      glow: "hover:shadow-glow-warning",
    },
    danger: {
      border: "border-destructive/10 hover:border-destructive/30",
      gradient: "from-destructive/5 via-transparent to-transparent",
      iconBg: "bg-destructive/10",
      iconColor: "text-destructive",
      glow: "hover:shadow-glow-danger",
    },
  };

  const styles = variantStyles[variant];
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
          "relative overflow-hidden rounded-xl border bg-card/50 backdrop-blur-sm p-5 animate-fade-up stat-shine",
          styles.border
        )}
        style={{ animationDelay: `${delay}ms` }}
      >
        <div className="flex items-start justify-between">
          <div className="space-y-3 flex-1">
            <div className="skeleton h-3 w-24" />
            <div className="skeleton h-9 w-32" />
            <div className="skeleton h-3 w-20" />
          </div>
          <div className={cn("p-3 rounded-xl", styles.iconBg)}>
            <Icon className={cn("h-5 w-5 opacity-50", styles.iconColor)} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        "group relative overflow-hidden rounded-xl border bg-card/50 backdrop-blur-sm p-5 cursor-pointer transition-all duration-300 animate-fade-up",
        styles.border,
        styles.glow,
        pulse && "animate-glow-pulse",
        "hover:-translate-y-1"
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Gradient Background */}
      <div className={cn(
        "absolute inset-0 bg-gradient-to-br opacity-50 transition-opacity duration-300",
        styles.gradient,
        isHovered && "opacity-100"
      )} />
      
      {/* Shine Effect */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
      </div>

      <div className="relative flex items-start justify-between">
        <div className="space-y-2 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {label}
            </p>
            <ArrowRight className={cn(
              "h-3 w-3 text-muted-foreground transition-all duration-300",
              isHovered ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2"
            )} />
          </div>
          
          {isEmpty && emptyMessage ? (
            <div>
              <p className="text-lg font-medium text-muted-foreground">{emptyMessage}</p>
            </div>
          ) : (
            <p className="stat-number text-3xl sm:text-4xl text-foreground">
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
              <div className={cn(
                "flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs font-medium",
                trend.isPositive 
                  ? "bg-success/10 text-success" 
                  : "bg-destructive/10 text-destructive"
              )}>
                {trend.isPositive ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {trend.isPositive ? "+" : ""}{trend.value}%
              </div>
              <span className="text-xs text-muted-foreground">vs last month</span>
            </div>
          )}
          
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
        
        <div className={cn(
          "relative p-3 rounded-xl transition-all duration-300",
          styles.iconBg,
          isHovered && "scale-110"
        )}>
          {/* Icon Glow */}
          <div className={cn(
            "absolute inset-0 rounded-xl blur-xl opacity-0 transition-opacity duration-300",
            styles.iconBg,
            isHovered && "opacity-50"
          )} />
          <Icon className={cn("relative h-5 w-5 sm:h-6 sm:w-6", styles.iconColor)} />
        </div>
      </div>
    </div>
  );
}
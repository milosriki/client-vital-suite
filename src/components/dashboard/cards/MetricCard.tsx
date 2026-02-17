import { ReactNode } from "react";
import { ArrowUpRight, ArrowDownRight, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  label: string;
  value: string | number;
  delta?: {
    value: number;
    type: "positive" | "negative" | "neutral";
  };
  icon?: LucideIcon;
  sparkline?: ReactNode;
  onClick?: () => void;
  className?: string;
}

export function MetricCard({
  label,
  value,
  delta,
  icon: Icon,
  sparkline,
  onClick,
  className,
}: MetricCardProps) {
  const isClickable = !!onClick;

  return (
    <div
      onClick={onClick}
      className={cn(
        "bg-[#0A0A0A] border border-[#1F2937] p-6 rounded-xl transition-colors duration-200",
        isClickable && "cursor-pointer hover:border-primary",
        className
      )}
    >
      {/* Header: Icon + Label + Delta */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="w-5 h-5 text-primary" />}
          <span className="text-sm font-medium text-slate-300">{label}</span>
        </div>
        {delta && (
          <div
            className={cn(
              "flex items-center gap-1 text-sm font-medium",
              delta.type === "positive" && "text-emerald-500",
              delta.type === "negative" && "text-red-500",
              delta.type === "neutral" && "text-slate-300"
            )}
          >
            {delta.type === "positive" && <ArrowUpRight className="w-4 h-4" />}
            {delta.type === "negative" && <ArrowDownRight className="w-4 h-4" />}
            {delta.value > 0 ? "+" : ""}
            {delta.value}%
          </div>
        )}
      </div>

      {/* Metric Value */}
      <div className="text-3xl font-semibold text-slate-50 mb-2">{value}</div>

      {/* Optional Sparkline */}
      {sparkline && <div className="mt-3">{sparkline}</div>}
    </div>
  );
}

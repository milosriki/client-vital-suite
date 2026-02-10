import { cn } from "@/lib/utils";

interface PulseIndicatorProps {
  className?: string;
  variant?: "success" | "warning" | "destructive" | "default";
  label?: string;
}

export function PulseIndicator({
  className,
  variant = "success",
  label,
}: PulseIndicatorProps) {
  const colorMap = {
    success: "bg-emerald-500",
    warning: "bg-amber-500",
    destructive: "bg-red-500",
    default: "bg-blue-500",
  };

  const color = colorMap[variant];

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="relative flex h-2.5 w-2.5">
        <span
          className={cn(
            "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
            color,
          )}
        ></span>
        <span
          className={cn("relative inline-flex rounded-full h-2.5 w-2.5", color)}
        ></span>
      </span>
      {label && (
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {label}
        </span>
      )}
    </div>
  );
}

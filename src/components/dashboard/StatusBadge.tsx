import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: "healthy" | "warning" | "critical" | "offline" | "syncing";
  label?: string;
  showDot?: boolean;
  size?: "sm" | "md";
}

export function StatusBadge({ 
  status, 
  label, 
  showDot = true,
  size = "md" 
}: StatusBadgeProps) {
  const statusConfig = {
    healthy: {
      bg: "bg-success/10",
      border: "border-success/30",
      text: "text-success",
      dot: "bg-success",
      label: label || "Healthy",
    },
    warning: {
      bg: "bg-warning/10",
      border: "border-warning/30",
      text: "text-warning",
      dot: "bg-warning",
      label: label || "Warning",
    },
    critical: {
      bg: "bg-destructive/10",
      border: "border-destructive/30",
      text: "text-destructive",
      dot: "bg-destructive animate-pulse",
      label: label || "Critical",
    },
    offline: {
      bg: "bg-muted/50",
      border: "border-muted",
      text: "text-muted-foreground",
      dot: "bg-muted-foreground",
      label: label || "Offline",
    },
    syncing: {
      bg: "bg-primary/10",
      border: "border-primary/30",
      text: "text-primary",
      dot: "bg-primary animate-pulse",
      label: label || "Syncing...",
    },
  };

  const config = statusConfig[status];

  return (
    <div className={cn(
      "inline-flex items-center gap-1.5 px-2 py-1 rounded-full border",
      config.bg,
      config.border,
      size === "sm" ? "text-[10px]" : "text-xs"
    )}>
      {showDot && (
        <span className={cn("h-1.5 w-1.5 rounded-full", config.dot)} />
      )}
      <span className={cn("font-medium", config.text)}>{config.label}</span>
    </div>
  );
}

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Status = "success" | "warning" | "error" | "info" | "neutral";

interface StatusBadgeProps {
  status: Status;
  label: string;
  className?: string;
}

const statusConfig: Record<
  Status,
  { bg: string; text: string; border: string }
> = {
  success: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    border: "border-emerald-500/30",
  },
  warning: {
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    border: "border-amber-500/30",
  },
  error: {
    bg: "bg-red-500/10",
    text: "text-red-400",
    border: "border-red-500/30",
  },
  info: {
    bg: "bg-blue-500/10",
    text: "text-blue-400",
    border: "border-blue-500/30",
  },
  neutral: {
    bg: "bg-slate-500/10",
    text: "text-slate-300",
    border: "border-slate-500/30",
  },
};

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <Badge
      variant="outline"
      className={cn(config.bg, config.text, config.border, className)}
    >
      {label}
    </Badge>
  );
}

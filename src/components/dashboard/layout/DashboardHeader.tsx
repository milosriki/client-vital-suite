import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface DashboardHeaderProps {
  title: string;
  description?: string | ReactNode;
  actions?: ReactNode;
  badge?: ReactNode;
  className?: string;
}

export function DashboardHeader({
  title,
  description,
  actions,
  badge,
  className,
}: DashboardHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between mb-6", className)}>
      <div>
        <h1 className="text-3xl font-bold text-slate-50">{title}</h1>
        {(description || badge) && (
          <p className="text-sm text-slate-300 mt-1 flex items-center gap-2 flex-wrap">
            {description}
            {badge}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  );
}

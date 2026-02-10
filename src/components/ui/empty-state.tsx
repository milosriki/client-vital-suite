import { LucideIcon, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateAction {
  label: string;
  onClick: () => void;
  variant?: "default" | "outline" | "ghost";
}

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  className?: string;
  compact?: boolean;
}

/**
 * Enterprise EmptyState Component
 *
 * Use for every list/collection/table that can be empty.
 * Per react-ui-patterns skill: "Every list/collection MUST have an empty state"
 *
 * @example
 * <EmptyState
 *   icon={Users}
 *   title="No clients found"
 *   description="Clients will appear after your first HubSpot sync"
 *   action={{ label: "Sync Now", onClick: handleSync }}
 * />
 */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  secondaryAction,
  className,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "py-8 px-4" : "py-16 px-6",
        className,
      )}
      role="status"
      aria-label={title}
    >
      <div
        className={cn(
          "rounded-full bg-muted/50 flex items-center justify-center mb-4",
          compact ? "w-10 h-10" : "w-14 h-14",
        )}
      >
        <Icon
          className={cn(
            "text-muted-foreground",
            compact ? "h-5 w-5" : "h-7 w-7",
          )}
        />
      </div>

      <h3
        className={cn(
          "font-semibold text-foreground",
          compact ? "text-sm" : "text-base",
        )}
      >
        {title}
      </h3>

      {description && (
        <p
          className={cn(
            "text-muted-foreground mt-1 max-w-sm",
            compact ? "text-xs" : "text-sm",
          )}
        >
          {description}
        </p>
      )}

      {(action || secondaryAction) && (
        <div className="flex items-center gap-2 mt-4">
          {action && (
            <Button
              size={compact ? "sm" : "default"}
              variant={action.variant || "default"}
              onClick={action.onClick}
            >
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button
              size={compact ? "sm" : "default"}
              variant={secondaryAction.variant || "outline"}
              onClick={secondaryAction.onClick}
            >
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export default EmptyState;

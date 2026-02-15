import { ReactNode } from "react";
import { Sparkles, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface InsightPanelProps {
  title?: string;
  content: ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
  onDismiss?: () => void;
  className?: string;
}

export function InsightPanel({
  title = "AI Insight",
  content,
  action,
  onDismiss,
  className,
}: InsightPanelProps) {
  return (
    <div
      className={cn(
        "bg-violet-500/10 border-l-4 border-violet-500 p-6 rounded-lg",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-violet-500" />
          <Badge variant="secondary" className="bg-violet-500/20 text-violet-300 border-violet-500/30">
            {title}
          </Badge>
        </div>
        {onDismiss && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onDismiss}
            className="h-6 w-6 hover:bg-violet-500/20"
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Content */}
      <div className="text-base text-slate-50 leading-relaxed mb-4">
        {content}
      </div>

      {/* Optional Action Button */}
      {action && (
        <Button
          variant="outline"
          size="sm"
          onClick={action.onClick}
          className="border-violet-500 text-violet-400 hover:bg-violet-500/10"
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}

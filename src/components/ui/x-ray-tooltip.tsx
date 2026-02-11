import { ReactNode } from "react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Scan } from "lucide-react";

export interface XRayInsight {
  label: string;
  value: string;
  color?: string;
}

interface XRayTooltipProps {
  children: ReactNode;
  title: string;
  insights: XRayInsight[];
  summary?: string;
}

/**
 * Power 7: The X-Ray
 * Hover over any metric to reveal WHY a number is what it is.
 * Wraps any element and shows contextual intelligence on hover.
 */
export function XRayTooltip({
  children,
  title,
  insights,
  summary,
}: XRayTooltipProps) {
  if (!insights || insights.length === 0) return <>{children}</>;

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        <div className="relative group cursor-help">
          {children}
          {/* X-Ray indicator dot */}
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <Scan className="h-3 w-3 text-primary/60" />
          </div>
        </div>
      </HoverCardTrigger>
      <HoverCardContent
        className="w-80 border-primary/20 bg-card/95 backdrop-blur-xl shadow-2xl"
        side="bottom"
        align="start"
      >
        {/* Header */}
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border/50">
          <Scan className="h-4 w-4 text-primary" />
          <span className="text-xs font-semibold text-primary uppercase tracking-wider">
            X-Ray: {title}
          </span>
        </div>

        {/* Insights Grid */}
        <div className="space-y-2">
          {insights.map((insight, i) => (
            <div key={i} className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground text-xs">
                {insight.label}
              </span>
              <span
                className={`font-mono font-semibold text-xs ${insight.color || "text-foreground"}`}
              >
                {insight.value}
              </span>
            </div>
          ))}
        </div>

        {/* Summary */}
        {summary && (
          <p className="mt-3 pt-2 border-t border-border/50 text-[11px] text-muted-foreground leading-relaxed italic">
            {summary}
          </p>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}

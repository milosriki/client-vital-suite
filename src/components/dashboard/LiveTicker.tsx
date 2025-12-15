import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Activity, ArrowRight, Clock } from "lucide-react";
import { format } from "date-fns";

interface TickerItem {
  id: string;
  type: "info" | "success" | "warning" | "danger";
  message: string;
  timestamp: Date;
  meta?: string;
}

interface LiveTickerProps {
  items: TickerItem[];
  maxItems?: number;
  className?: string;
}

export function LiveTicker({ items, maxItems = 10, className }: LiveTickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  
  const displayItems = items.slice(0, maxItems);

  const typeStyles = {
    info: "bg-primary/10 border-primary/20 text-primary",
    success: "bg-success/10 border-success/20 text-success",
    warning: "bg-warning/10 border-warning/20 text-warning",
    danger: "bg-destructive/10 border-destructive/20 text-destructive",
  };

  if (displayItems.length === 0) {
    return (
      <div className={cn(
        "flex items-center justify-center py-8 text-muted-foreground",
        className
      )}>
        <Activity className="h-4 w-4 mr-2 animate-pulse" />
        <span className="text-sm">Waiting for activity...</span>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className={cn(
        "space-y-2 max-h-[400px] overflow-y-auto scrollbar-thin",
        className
      )}
    >
      {displayItems.map((item, index) => (
        <div
          key={item.id}
          onMouseEnter={() => setHoveredItem(item.id)}
          onMouseLeave={() => setHoveredItem(null)}
          className={cn(
            "group flex items-start gap-3 p-3 rounded-lg border transition-all duration-200",
            typeStyles[item.type],
            hoveredItem === item.id && "scale-[1.01] shadow-sm",
            "animate-fade-in"
          )}
          style={{ animationDelay: `${index * 50}ms` }}
        >
          <div className={cn(
            "w-1.5 h-1.5 rounded-full mt-1.5 shrink-0",
            item.type === "info" && "bg-primary",
            item.type === "success" && "bg-success",
            item.type === "warning" && "bg-warning",
            item.type === "danger" && "bg-destructive animate-pulse"
          )} />
          
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {item.message}
            </p>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {format(item.timestamp, "HH:mm:ss")}
              </span>
              {item.meta && (
                <span className="text-xs text-muted-foreground truncate">
                  {item.meta}
                </span>
              )}
            </div>
          </div>
          
          <ArrowRight className={cn(
            "h-4 w-4 text-muted-foreground/50 shrink-0 transition-opacity",
            hoveredItem === item.id ? "opacity-100" : "opacity-0"
          )} />
        </div>
      ))}
    </div>
  );
}

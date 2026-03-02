import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface SourceBadgeProps {
  /** Data source label (e.g. "HubSpot", "Meta + HubSpot") */
  source: string;
  /** dataUpdatedAt from useQuery (ms timestamp) or undefined when loading */
  freshness?: number | null;
  /** Stale threshold in ms; if freshness older, show "stale" */
  staleThresholdMs?: number;
  size?: "sm" | "md";
}

const STALE_6H = 6 * 60 * 60 * 1000;
const STALE_24H = 24 * 60 * 60 * 1000;

function formatFreshness(
  freshness: number | null | undefined,
  staleThresholdMs: number
): string {
  if (freshness == null || freshness === 0) return "—";
  const age = Date.now() - freshness;
  if (age > staleThresholdMs) return "stale";
  return formatDistanceToNow(freshness, { addSuffix: true });
}

export function SourceBadge({
  source,
  freshness,
  staleThresholdMs = STALE_24H,
  size = "sm",
}: SourceBadgeProps) {
  const label = formatFreshness(freshness, staleThresholdMs);
  const isStale = label === "stale";

  const displayText = `${source} · ${label}`;
  const ariaLabel = `Data source: ${source}${label !== "—" ? `, last updated ${label}` : ""}`;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="secondary"
            className={
              size === "sm"
                ? "text-[10px] font-normal px-1.5 py-0 opacity-90"
                : "text-xs font-normal px-2 py-0.5 opacity-90"
            }
            aria-label={ariaLabel}
          >
            <span className={isStale ? "text-amber-400" : "text-muted-foreground"}>
              {displayText}
            </span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[240px]">
          <p className="text-xs">
            {label === "—"
              ? "Data loading or not yet fetched"
              : isStale
                ? `Data may be outdated. Last refreshed ${formatDistanceToNow(freshness!, { addSuffix: true })}.`
                : `Data last refreshed ${label}`}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

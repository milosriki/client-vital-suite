import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Play, TrendingUp, TrendingDown, AlertCircle, Flame, CheckCircle, AlertTriangle } from "lucide-react";

export interface Creative {
  id: string;
  name: string;
  thumbnail?: string;
  spend: number;
  revenue: number;
  roas: number;
  // Extended Creative DNA metrics
  cpa_aed?: number;
  ctr_pct?: number;
  frequency?: number;
  fatigue_status?: "OK" | "WARNING" | "CRITICAL";
  fatigue_reason?: string;
  cpl_aed?: number;
  action?: "KILL" | "SCALE" | "WATCH" | "REFRESH" | "HOLD" | "MAINTAIN";
  action_reason?: string;
  quality_ranking?: string;
  optimization?: {
    status: "optimized" | "warning" | "critical";
    action: string;
    reason: string;
  };
}

function FatigueBadge({ status, frequency }: { status?: "OK" | "WARNING" | "CRITICAL"; frequency?: number }) {
  if (!status || status === "OK") {
    return (
      <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 border border-emerald-500/40 text-emerald-400">
        <CheckCircle className="w-2.5 h-2.5" />
        OK {frequency != null ? `(${frequency.toFixed(1)}f)` : ""}
      </div>
    );
  }
  if (status === "WARNING") {
    return (
      <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 border border-amber-500/40 text-amber-400">
        <AlertTriangle className="w-2.5 h-2.5" />
        FATIGUE {frequency != null ? `(${frequency.toFixed(1)}f)` : ""}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 border border-red-500/40 text-red-400 animate-pulse">
      <Flame className="w-2.5 h-2.5" />
      BURNOUT {frequency != null ? `(${frequency.toFixed(1)}f)` : ""}
    </div>
  );
}

function ActionBadge({ action }: { action?: Creative["action"] }) {
  if (!action || action === "HOLD" || action === "MAINTAIN") return null;

  const styles: Record<string, string> = {
    KILL: "bg-red-500/20 border-red-500/40 text-red-400",
    SCALE: "bg-emerald-500/20 border-emerald-500/40 text-emerald-400",
    WATCH: "bg-amber-500/20 border-amber-500/40 text-amber-400",
    REFRESH: "bg-blue-500/20 border-blue-500/40 text-blue-400",
  };

  return (
    <div className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border", styles[action] || "bg-slate-500/20 border-slate-500/40 text-slate-400")}>
      {action === "SCALE" && <TrendingUp className="w-2.5 h-2.5" />}
      {action === "KILL" && <TrendingDown className="w-2.5 h-2.5" />}
      {action}
    </div>
  );
}

const CreativeCard = ({ creative }: { creative: Creative }) => {
  const isWinner = creative.roas >= 2.5;
  const isLoser = creative.roas < 1.0;
  const hasThumbnail = creative.thumbnail && creative.thumbnail !== "";

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className="group relative rounded-xl overflow-hidden border border-white/10 bg-black/40 backdrop-blur-sm"
    >
      {/* Thumbnail */}
      <div className="relative aspect-video bg-slate-800/60">
        {hasThumbnail ? (
          <img
            src={creative.thumbnail}
            alt={creative.name}
            className="w-full h-full object-cover group-hover:opacity-80 transition-opacity"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-600">
            <Play className="w-8 h-8" />
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
            <Play className="w-4 h-4 text-white fill-current" />
          </div>
        </div>

        {/* ROAS Badge */}
        <div
          className={cn(
            "absolute top-2 right-2 px-2 py-1 rounded-md text-xs font-bold backdrop-blur-md border",
            isWinner
              ? "bg-emerald-500/20 border-emerald-500 text-emerald-400"
              : isLoser
                ? "bg-red-500/20 border-red-500 text-red-400"
                : "bg-yellow-500/20 border-yellow-500 text-yellow-400",
          )}
        >
          {(creative.roas ?? 0).toFixed(2)}x ROAS
        </div>

        {/* Action Badge (top left) */}
        {creative.action && creative.action !== "HOLD" && creative.action !== "MAINTAIN" && (
          <div className="absolute top-2 left-2">
            <ActionBadge action={creative.action} />
          </div>
        )}
      </div>

      {/* Metrics */}
      <div className="p-4 space-y-3">
        <div className="flex justify-between items-start gap-2">
          <h4
            className="text-sm font-medium text-slate-100 truncate"
            title={creative.name}
          >
            {creative.name}
          </h4>
        </div>

        {/* Fatigue Badge */}
        {creative.fatigue_status && (
          <div>
            <FatigueBadge status={creative.fatigue_status} frequency={creative.frequency} />
          </div>
        )}

        {/* Core metrics grid */}
        <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
          <div>
            <div className="uppercase tracking-wider text-[10px] text-slate-500">Spend</div>
            <div className="text-slate-200 font-mono">AED {creative.spend.toLocaleString()}</div>
          </div>
          <div>
            <div className="uppercase tracking-wider text-[10px] text-slate-500">Revenue</div>
            <div className="text-slate-200 font-mono">AED {creative.revenue.toLocaleString()}</div>
          </div>
          {creative.cpa_aed !== undefined && creative.cpa_aed > 0 && (
            <div>
              <div className="uppercase tracking-wider text-[10px] text-slate-500">CPA</div>
              <div className="text-slate-200 font-mono">AED {creative.cpa_aed.toFixed(0)}</div>
            </div>
          )}
          {creative.ctr_pct !== undefined && (
            <div>
              <div className="uppercase tracking-wider text-[10px] text-slate-500">CTR</div>
              <div className={cn("font-mono", creative.ctr_pct > 1.5 ? "text-emerald-400" : creative.ctr_pct < 0.5 ? "text-red-400" : "text-slate-200")}>
                {(creative.ctr_pct ?? 0).toFixed(2)}%
              </div>
            </div>
          )}
          {creative.frequency !== undefined && creative.fatigue_status === undefined && (
            <div>
              <div className="uppercase tracking-wider text-[10px] text-slate-500">Frequency</div>
              <div className={cn("font-mono", creative.frequency >= 5 ? "text-red-400" : creative.frequency >= 3.5 ? "text-amber-400" : "text-slate-200")}>
                {(creative.frequency ?? 0).toFixed(1)}
              </div>
            </div>
          )}
        </div>

        {/* Optimization Intel */}
        {creative.action_reason && creative.action && creative.action !== "HOLD" && creative.action !== "MAINTAIN" ? (
          <div
            className={cn(
              "mt-2 p-2 rounded text-[10px] flex items-start gap-2 border",
              creative.action === "KILL"
                ? "bg-red-900/10 border-red-900/30 text-red-300"
                : creative.action === "SCALE"
                  ? "bg-emerald-900/10 border-emerald-900/30 text-emerald-300"
                  : "bg-blue-900/10 border-blue-900/30 text-blue-300",
            )}
          >
            {creative.action === "SCALE" ? (
              <TrendingUp className="w-3 h-3 mt-0.5 shrink-0" />
            ) : (
              <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
            )}
            <div>
              <span className="font-bold block mb-0.5">{creative.action}</span>
              <span className="opacity-80 leading-tight">{creative.action_reason}</span>
            </div>
          </div>
        ) : creative.optimization ? (
          <div
            className={cn(
              "mt-2 p-2 rounded text-[10px] flex items-start gap-2 border",
              creative.optimization.status === "optimized"
                ? "bg-emerald-900/10 border-emerald-900/30 text-emerald-300"
                : creative.optimization.status === "critical"
                  ? "bg-red-900/10 border-red-900/30 text-red-300"
                  : "bg-blue-900/10 border-blue-900/30 text-blue-300",
            )}
          >
            {creative.optimization.status === "optimized" ? (
              <TrendingUp className="w-3 h-3 mt-0.5 shrink-0" />
            ) : (
              <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
            )}
            <div>
              <span className="font-bold block mb-0.5">
                {creative.optimization.action}
              </span>
              <span className="opacity-80 leading-tight">
                {creative.optimization.reason}
              </span>
            </div>
          </div>
        ) : null}
      </div>
    </motion.div>
  );
};

export function CreativeGallery({ data }: { data: Creative[] }) {
  if (!data?.length)
    return (
      <div className="text-center py-12 text-slate-400">
        <Play className="w-8 h-8 mx-auto mb-3 opacity-30" />
        <p>No creative data available. Run ad-creative-analyst to populate.</p>
      </div>
    );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {data.map((creative) => (
        <CreativeCard key={creative.id} creative={creative} />
      ))}
    </div>
  );
}

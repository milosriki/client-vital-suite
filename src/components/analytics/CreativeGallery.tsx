import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Play, TrendingUp, TrendingDown, AlertCircle } from "lucide-react";

interface Creative {
  id: string;
  name: string;
  thumbnail: string;
  spend: number;
  revenue: number;
  roas: number;
  optimization?: {
    status: "optimized" | "warning" | "critical";
    action: string;
    reason: string;
  };
}

const CreativeCard = ({ creative }: { creative: Creative }) => {
  // Status Logic
  const isWinner = creative.roas >= 2.5;
  const isLoser = creative.roas < 1.0;

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className="group relative rounded-xl overflow-hidden border border-white/10 bg-black/40 backdrop-blur-sm"
    >
      {/* Thumbnail */}
      <div className="relative aspect-video">
        <img
          src={creative.thumbnail}
          alt={creative.name}
          className="w-full h-full object-cover group-hover:opacity-80 transition-opacity"
        />
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
          {creative.roas.toFixed(2)}x ROAS
        </div>
      </div>

      {/* Metrics */}
      <div className="p-4 space-y-3">
        <div className="flex justify-between items-start">
          <h4
            className="text-sm font-medium text-slate-100 truncate pr-2"
            title={creative.name}
          >
            {creative.name}
          </h4>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
          <div>
            <div className="uppercase tracking-wider text-[10px]">Spend</div>
            <div className="text-slate-200 font-mono">
              ${creative.spend.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="uppercase tracking-wider text-[10px]">Revenue</div>
            <div className="text-slate-200 font-mono">
              ${creative.revenue.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Optimization Intel */}
        {creative.optimization && (
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
        )}
      </div>
    </motion.div>
  );
};

export function CreativeGallery({ data }: { data: Creative[] }) {
  if (!data?.length)
    return <div className="text-slate-500">No creatives found.</div>;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {data.map((creative) => (
        <CreativeCard key={creative.id} creative={creative} />
      ))}
    </div>
  );
}

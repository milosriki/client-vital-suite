import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Brain, RefreshCw, Loader2 } from "lucide-react";
import { UseMutationResult } from "@tanstack/react-query";

interface CEOHeaderProps {
  runMonitor: UseMutationResult<any, Error, void, unknown>;
}

export function CEOHeader({ runMonitor }: CEOHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-cyan-500/25 shrink-0">
          <Brain className="w-6 h-6 sm:w-10 sm:h-10 text-white" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white">
            ULTIMATE AI CEO
          </h1>
          <p className="text-xs sm:text-sm text-cyan-400">
            Self-Coding • Multi-Model • Human-Controlled
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => runMonitor.mutate()}
          disabled={runMonitor.isPending}
          className="border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/20"
        >
          {runMonitor.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          <span className="ml-2 hidden sm:inline">Run Monitor</span>
        </Button>
        <Badge
          variant="outline"
          className="text-emerald-400 border-emerald-400/50 text-xs sm:text-sm"
        >
          <div className="w-2 h-2 bg-emerald-400 rounded-full mr-2 animate-pulse" />
          System Active
        </Badge>
      </div>
    </div>
  );
}

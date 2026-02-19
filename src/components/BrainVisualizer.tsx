import { useState, useEffect, useRef, useCallback } from "react";
import { Brain, Database, RefreshCw, Loader2, Zap, WifiOff } from "lucide-react";
import { getApiUrl } from "@/config/api";

interface KnowledgeChunk {
  id: string;
  category: string;
  content: string;
  created_at: string;
}

const BASE_INTERVAL = 30000;
const MAX_INTERVAL = 300000;
const MAX_FAILURES = 10;

export function BrainVisualizer() {
  const [chunks, setChunks] = useState<KnowledgeChunk[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [connectionLost, setConnectionLost] = useState(false);
  const failureCount = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentInterval = useRef(BASE_INTERVAL);

  const startPolling = useCallback((ms: number) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    currentInterval.current = ms;
    intervalRef.current = setInterval(fetchData, ms);
  }, []);

  useEffect(() => {
    fetchData();
    startPolling(BASE_INTERVAL);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Recent Knowledge
      const chunksRes = await fetch(
        getApiUrl("/api/brain?action=recent&limit=10"),
      );
      if (!chunksRes.ok) throw new Error(`Server error: ${chunksRes.status}`);
      const chunksData = await chunksRes.json();
      if (chunksData.ok) {
        setChunks(chunksData.chunks || []);
      }

      // 2. Fetch Stats
      const statsRes = await fetch(getApiUrl("/api/brain?action=stats"));
      if (!statsRes.ok) throw new Error(`Server error: ${statsRes.status}`);
      const statsData = await statsRes.json();
      if (statsData.ok) {
        setStats(statsData.stats);
      }

      // Success: reset backoff
      failureCount.current = 0;
      setConnectionLost(false);
      if (currentInterval.current !== BASE_INTERVAL) {
        startPolling(BASE_INTERVAL);
      }
    } catch (e) {
      console.error("Brain fetch error:", e);
      failureCount.current++;

      if (failureCount.current >= MAX_FAILURES) {
        // Stop polling after 10 consecutive failures
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = null;
        setConnectionLost(true);
      } else {
        // Exponential backoff: double interval, cap at 300s
        const newInterval = Math.min(currentInterval.current * 2, MAX_INTERVAL);
        startPolling(newInterval);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-black/40 border border-cyan-500/30 rounded-xl overflow-hidden backdrop-blur-md">
      {/* Header */}
      <div className="p-4 border-b border-cyan-500/20 flex items-center justify-between bg-white/5">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-cyan-500/20 rounded-lg">
            <Brain className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h3 className="font-bold text-white text-lg">Live Cortex Stream</h3>
            <p className="text-xs text-cyan-400/70">
              Real-time knowledge ingestion
            </p>
          </div>
        </div>

        {stats && (
          <div className="flex gap-4 text-xs">
            <div className="text-center">
              <p className="text-white/50">Total Nodes</p>
              <p className="text-cyan-400 font-mono text-lg">
                {stats.total_knowledge_chunks || stats.total_memories || 0}
              </p>
            </div>
          </div>
        )}

        <button
          onClick={fetchData}
          className="p-2 hover:bg-white/10 rounded-full transition-colors"
        >
          <RefreshCw
            className={`w-4 h-4 text-white/70 ${loading ? "animate-spin" : ""}`}
          />
        </button>
      </div>

      {/* Matrix Stream */}
      <div className="p-0">
        <div className="bg-gradient-to-b from-black/80 to-slate-900/80 min-h-[300px] max-h-[400px] overflow-y-auto p-4 space-y-3 font-mono text-sm">
          {chunks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[200px] text-white/30">
              <Database className="w-8 h-8 mb-2 opacity-50" />
              <p>Cortex Empty. Waiting for ingestion...</p>
            </div>
          ) : (
            chunks.map((chunk) => (
              <div
                key={chunk.id}
                className="group relative pl-4 border-l-2 border-cyan-500/20 hover:border-cyan-400 transition-colors pb-4"
              >
                {/* Timeline Dot */}
                <div className="absolute -left-[5px] top-0 w-2 h-2 rounded-full bg-cyan-900 group-hover:bg-cyan-400 transition-colors" />

                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] text-cyan-400/70 uppercase tracking-wider">
                    {chunk.category}
                  </span>
                  <span className="text-[10px] text-white/30">
                    {new Date(chunk.created_at).toLocaleTimeString()}
                  </span>
                </div>

                <p className="text-white/80 line-clamp-2 group-hover:text-white transition-colors">
                  {chunk.content}
                </p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Footer Status */}
      <div className="bg-cyan-900/20 p-2 text-center border-t border-cyan-500/20">
        {connectionLost ? (
          <span className="text-[10px] text-red-400 flex items-center justify-center gap-2">
            <WifiOff className="w-3 h-3" />
            CONNECTION LOST — Polling stopped after {MAX_FAILURES} failures
          </span>
        ) : (
          <span className="text-[10px] text-cyan-400 flex items-center justify-center gap-2">
            <Zap className="w-3 h-3" />
            SYSTEM: ONLINE // VECTOR_DIM: 768 (GEMINI-004)
          </span>
        )}
      </div>
    </div>
  );
}

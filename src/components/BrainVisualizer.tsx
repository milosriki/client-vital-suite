import { useState, useEffect } from "react";
import { Brain, Database, RefreshCw, Loader2, Zap } from "lucide-react";
import { getApiUrl } from "@/config/api";

interface KnowledgeChunk {
  id: string;
  category: string;
  content: string;
  created_at: string;
}

export function BrainVisualizer() {
  const [chunks, setChunks] = useState<KnowledgeChunk[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Recent Knowledge
      const chunksRes = await fetch(
        getApiUrl("/api/brain?action=recent_knowledge&limit=10"),
      );
      const chunksData = await chunksRes.json();
      if (chunksData.ok) {
        setChunks(chunksData.chunks || []);
      }

      // 2. Fetch Stats
      const statsRes = await fetch(getApiUrl("/api/brain?action=stats"));
      const statsData = await statsRes.json();
      if (statsData.ok) {
        setStats(statsData.stats);
      }
    } catch (e) {
      console.error("Brain fetch error:", e);
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
                {stats.total_knowledge_chunks}
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
        <span className="text-[10px] text-cyan-400 flex items-center justify-center gap-2">
          <Zap className="w-3 h-3" />
          SYSTEM: ONLINE // VECTOR_DIM: 768 (GEMINI-004)
        </span>
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import {
  Brain,
  Globe,
  Send,
  Database,
  FileText,
  Loader2,
  RefreshCw,
  Search,
  Eye,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import { getApiUrl } from "@/config/api";
import { BrainVisualizer } from "@/components/BrainVisualizer";
import { supabase } from "@/integrations/supabase/client";

interface Evidence {
  source: string;
  table?: string;
  data: Record<string, unknown>;
  timestamp?: string;
  relevance?: number;
}

interface QueryResult {
  ok: boolean;
  answer: string;
  evidence?: Evidence[];
  sourcesUsed: string[];
  latencyMs: number;
  meta?: {
    memoryCount: number;
    factCount: number;
  };
}

interface MemoryEntry {
  namespace: string;
  key: string;
  value: { query?: string; response?: string } | string;
  source?: string;
  updated_at?: string;
}

export default function GlobalBrain() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [showEvidence, setShowEvidence] = useState(false);

  // Memory viewer state
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [memoryLoading, setMemoryLoading] = useState(false);
  const [memoryNamespace, setMemoryNamespace] = useState("global");

  // New memory form
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newNamespace, setNewNamespace] = useState("global");
  const [addingMemory, setAddingMemory] = useState(false);

  // Brain stats
  const [stats, setStats] = useState<{
    total_memories: number;
    total_facts: number;
    total_patterns: number;
  } | null>(null);

  useEffect(() => {
    loadStats();
    loadMemories();
  }, []);

  const loadStats = async () => {
    try {
      const response = await fetch(getApiUrl("/api/brain?action=stats"));
      const data = await response.json();
      if (data.ok) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error("Failed to load stats:", error);
    }
  };

  const loadMemories = async () => {
    setMemoryLoading(true);
    try {
      // Use the brain API with recent action
      const response = await fetch(
        getApiUrl("/api/brain?action=recent&limit=20"),
      );
      const data = await response.json();
      if (data.ok && data.memories) {
        setMemories(
          data.memories.map((m: {
            id: string;
            query: string;
            response?: string;
            knowledge_extracted?: { source?: string };
            created_at: string;
          }) => ({
            namespace: "agent_memory",
            key: m.id,
            value: { query: m.query, response: m.response?.slice(0, 200) },
            source: m.knowledge_extracted?.source,
            updated_at: m.created_at,
          })),
        );
      }
    } catch (error) {
      console.error("Failed to load memories:", error);
      toast.error("Failed to load memories");
    } finally {
      setMemoryLoading(false);
    }
  };

  const handleQuery = async () => {
    if (!question.trim()) return;

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch(getApiUrl("/api/query"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          mode: "deep",
          includeEvidence: true,
        }),
      });

      const data = await response.json();
      setResult(data);

      if (!data.ok) {
        toast.error(data.error || "Query failed");
      }
    } catch (error) {
      console.error("Query error:", error);
      toast.error("Failed to query the global brain");
    } finally {
      setLoading(false);
    }
  };

  const handleWriteMemory = async () => {
    if (!newKey.trim() || !newValue.trim()) {
      toast.error("Key and value are required");
      return;
    }

    setAddingMemory(true);

    try {
      // Insert directly into agent_memory table using Supabase client
      const { data, error } = await supabase
        .from("agent_memory")
        .insert({
          query: newKey,
          response: newValue,
          thread_id: `global-brain-${Date.now()}`,
          agent_name: "global-brain-ui",
          agent_type: "manual",
          role: "user",
          knowledge_extracted: {
            source: "global-brain-ui",
            manual: true,
            timestamp: new Date().toISOString(),
          },
        })
        .select()
        .single();

      if (error) {
        console.error("Insert error:", error);
        toast.error(`Failed to store memory: ${error.message}`);
        return;
      }

      toast.success(`Memory stored: ${newKey}`);
      setNewKey("");
      setNewValue("");

      // Reload memories and stats to show the new entry
      await Promise.all([loadMemories(), loadStats()]);
    } catch (error) {
      console.error("Write error:", error);
      toast.error("Failed to write memory");
    } finally {
      setAddingMemory(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-black text-white">
      {/* Header */}
      <div className="border-b border-cyan-500/20 bg-black/30 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-cyan-500/20 to-purple-500/20 rounded-xl border border-cyan-500/30">
                <Brain className="w-8 h-8 text-cyan-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <Globe className="w-6 h-6 text-green-400" />
                  Global Brain
                </h1>
                <p className="text-sm text-white/60">
                  Company-wide AI memory - shared across all browsers
                </p>
              </div>
            </div>

            {/* Stats */}
            {stats && (
              <div className="flex gap-4 text-sm">
                <div className="flex items-center gap-1 text-cyan-400">
                  <Database className="w-4 h-4" />
                  <span>{stats.total_memories} memories</span>
                </div>
                <div className="flex items-center gap-1 text-purple-400">
                  <FileText className="w-4 h-4" />
                  <span>{stats.total_facts} facts</span>
                </div>
                <div className="flex items-center gap-1 text-green-400">
                  <Brain className="w-4 h-4" />
                  <span>{stats.total_patterns} patterns</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Query Section */}
          <div className="lg:col-span-2 space-y-6">
            {/* Company Chat Box */}
            <div className="bg-white/5 border border-cyan-500/30 rounded-xl p-6">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Search className="w-5 h-5 text-cyan-400" />
                Ask the Global Brain
              </h2>

              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyPress={(e) =>
                    e.key === "Enter" && !loading && handleQuery()
                  }
                  placeholder="Ask anything about your business data..."
                  className="flex-1 bg-white/10 border border-cyan-500/30 rounded-lg px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  disabled={loading}
                />
                <button
                  onClick={handleQuery}
                  disabled={loading || !question.trim()}
                  className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 disabled:opacity-50 rounded-lg text-white font-medium transition-all flex items-center gap-2"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                  Query
                </button>
              </div>

              {/* Result */}
              {result && (
                <div className="space-y-4">
                  <div className="bg-black/30 border border-white/10 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-white/50">Answer</span>
                      <span className="text-xs text-cyan-400">
                        {result.latencyMs}ms
                      </span>
                    </div>
                    <p className="text-white/90 whitespace-pre-wrap">
                      {result.answer}
                    </p>
                  </div>

                  {/* Sources Used */}
                  {result.sourcesUsed?.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      <span className="text-xs text-white/50">Sources:</span>
                      {result.sourcesUsed.map((source, i) => (
                        <span
                          key={i}
                          className="text-xs px-2 py-1 bg-cyan-500/20 text-cyan-300 rounded-full"
                        >
                          {source}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Evidence Panel */}
                  {result.evidence && result.evidence.length > 0 && (
                    <div className="border border-white/10 rounded-lg overflow-hidden">
                      <button
                        onClick={() => setShowEvidence(!showEvidence)}
                        className="w-full flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 transition-colors"
                      >
                        <span className="flex items-center gap-2 text-sm">
                          <Eye className="w-4 h-4 text-purple-400" />
                          Evidence ({result.evidence.length} items)
                        </span>
                        {showEvidence ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>

                      {showEvidence && (
                        <div className="p-4 space-y-3 bg-black/20">
                          {result.evidence.map((item, i) => (
                            <div
                              key={i}
                              className="bg-white/5 border border-white/10 rounded-lg p-3 text-sm"
                            >
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-xs px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded">
                                  {item.source}
                                </span>
                                {item.table && (
                                  <span className="text-xs text-white/40">
                                    {item.table}
                                  </span>
                                )}
                                {item.relevance && (
                                  <span className="text-xs text-green-400">
                                    {Number((item?.relevance ?? 0) * 100).toFixed(0)}% match
                                  </span>
                                )}
                              </div>
                              <pre className="text-white/70 text-xs overflow-auto max-h-32">
                                {JSON.stringify(item.data, null, 2)}
                              </pre>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar - Memory Viewer/Editor */}
          <div className="space-y-6">
            {/* Brain Visualizer (New Elite Component) */}
            <BrainVisualizer />

            {/* Write Memory */}
            <div className="bg-white/5 border border-purple-500/30 rounded-xl p-4">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-purple-400" />
                Store Memory
              </h3>

              <div className="space-y-3">
                <input
                  type="text"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  placeholder="Key (e.g., company_rule_1)"
                  className="w-full bg-white/10 border border-purple-500/30 rounded-lg px-3 py-2 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                />
                <textarea
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  placeholder="Value or fact to remember..."
                  rows={3}
                  className="w-full bg-white/10 border border-purple-500/30 rounded-lg px-3 py-2 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm resize-none"
                />
                <button
                  onClick={handleWriteMemory}
                  disabled={addingMemory || !newKey.trim() || !newValue.trim()}
                  className="w-full py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white font-medium transition-all text-sm flex items-center justify-center gap-2"
                >
                  {addingMemory ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Storing...
                    </>
                  ) : (
                    "Store in Global Memory"
                  )}
                </button>
              </div>
            </div>

            {/* Memory Viewer */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Database className="w-5 h-5 text-cyan-400" />
                  Recent Memories
                </h3>
                <button
                  onClick={loadMemories}
                  disabled={memoryLoading}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <RefreshCw
                    className={`w-4 h-4 ${memoryLoading ? "animate-spin" : ""}`}
                  />
                </button>
              </div>

              {memoryLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
                </div>
              ) : memories.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Database className="h-8 w-8 mb-3 opacity-50" />
                  <p className="text-sm">No memories yet</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {memories.map((mem, i) => (
                    <div
                      key={i}
                      className="bg-black/30 border border-white/10 rounded-lg p-3 text-sm cursor-pointer hover:bg-white/10 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-cyan-400 font-mono text-xs truncate max-w-[150px]">
                          {typeof mem.value === "object" && "query" in mem.value
                            ? mem.value.query?.slice(0, 30) || mem.key
                            : mem.key}
                        </span>
                        {mem.source && (
                          <span className="text-xs text-white/40">
                            {mem.source}
                          </span>
                        )}
                      </div>
                      <p className="text-white/60 text-xs truncate">
                        {typeof mem.value === "object" && "response" in mem.value
                          ? mem.value.response?.slice(0, 100) ||
                            JSON.stringify(mem.value).slice(0, 100)
                          : String(mem.value).slice(0, 100)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Brain,
  TrendingUp,
  CreditCard,
  Target,
  Send,
  Loader2,
  Sparkles,
  DollarSign,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";

interface AgentResponse {
  agent: string;
  analysis: string;
  recommendations: string[];
  metrics: Record<string, number>;
}

interface OrchestratorResponse {
  query: string;
  agents: AgentResponse[];
  synthesis: string;
  actionPlan: string[];
  projectedROI: number;
  timestamp: string;
}

const agentIcons: Record<string, any> = {
  Oracle: Brain,
  "Cost Optimizer": DollarSign,
  "Payment Intel": CreditCard,
  "Ads Strategist": Target,
};

const agentColors: Record<string, string> = {
  Oracle: "from-purple-500 to-violet-600",
  "Cost Optimizer": "from-emerald-500 to-green-600",
  "Payment Intel": "from-blue-500 to-cyan-600",
  "Ads Strategist": "from-orange-500 to-amber-600",
};

const AgentCard = ({ response }: { response: AgentResponse }) => {
  const Icon = agentIcons[response.agent] || Brain;
  const gradient = agentColors[response.agent] || "from-slate-500 to-slate-600";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-sm overflow-hidden"
    >
      <div className={cn("p-4 bg-gradient-to-r", gradient)}>
        <div className="flex items-center gap-3">
          <Icon className="w-5 h-5 text-white" />
          <h3 className="font-bold text-white">{response.agent}</h3>
        </div>
      </div>
      <div className="p-4 space-y-3">
        <p className="text-sm text-slate-300">{response.analysis}</p>

        {response.recommendations.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-wider text-slate-500">
              Recommendations
            </div>
            {response.recommendations.slice(0, 3).map((rec, i) => (
              <div
                key={i}
                className="flex items-start gap-2 text-sm text-slate-400"
              >
                <ChevronRight className="w-4 h-4 mt-0.5 text-emerald-400 shrink-0" />
                <span>{rec}</span>
              </div>
            ))}
          </div>
        )}

        {Object.keys(response.metrics).length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2 border-t border-white/5">
            {Object.entries(response.metrics)
              .slice(0, 3)
              .map(([key, value]) => (
                <Badge
                  key={key}
                  variant="outline"
                  className="text-[10px] border-white/10 text-slate-400"
                >
                  {key}:{" "}
                  {typeof value === "number" ? value.toLocaleString() : value}
                </Badge>
              ))}
          </div>
        )}
      </div>
    </motion.div>
  );
};

const IntelligenceDashboard = () => {
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState<OrchestratorResponse | null>(null);

  const mutation = useMutation({
    mutationFn: async (userQuery: string) => {
      const { data, error } = await supabase.functions.invoke(
        "multi-agent-orchestrator",
        {
          body: { query: userQuery },
        },
      );
      if (error) throw error;
      return data as OrchestratorResponse;
    },
    onSuccess: (data) => {
      setResponse(data);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      mutation.mutate(query);
    }
  };

  const suggestedQueries = [
    "How can I improve revenue this month?",
    "Which campaigns should I kill or scale?",
    "Who is at risk of churning?",
    "What's my deal pipeline health?",
  ];

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-slate-900 via-[#0a0a0a] to-black p-6 space-y-8 text-slate-100">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span className="text-sm text-slate-400">
            Multi-Agent Intelligence
          </span>
        </div>
        <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
          Ask Your AI Council
        </h1>
        <p className="text-slate-500 max-w-xl mx-auto">
          4 specialist agents analyze your data and brainstorm together to
          provide actionable recommendations.
        </p>
      </div>

      {/* Query Input */}
      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto">
        <div className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask anything about your business..."
            className="bg-white/5 border-white/10 text-slate-100 placeholder:text-slate-500"
          />
          <Button
            type="submit"
            disabled={mutation.isPending}
            className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500"
          >
            {mutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>

        {/* Suggested Queries */}
        <div className="flex flex-wrap gap-2 mt-4">
          {suggestedQueries.map((sq) => (
            <button
              key={sq}
              type="button"
              onClick={() => setQuery(sq)}
              className="text-xs px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              {sq}
            </button>
          ))}
        </div>
      </form>

      {/* Loading State */}
      <AnimatePresence>
        {mutation.isPending && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center py-12"
          >
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-violet-500 mb-4" />
            <p className="text-slate-400">Agents are analyzing your data...</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results */}
      {response && !mutation.isPending && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          {/* Agent Responses */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {response.agents.map((agent, i) => (
              <AgentCard key={agent.agent} response={agent} />
            ))}
          </div>

          {/* Synthesis */}
          <Card className="bg-gradient-to-br from-violet-900/20 to-purple-900/20 border-violet-500/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-violet-300">
                <Brain className="w-5 h-5" />
                Synthesized Recommendation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-slate-300">{response.synthesis}</p>

              {/* Action Plan */}
              <div className="space-y-3">
                <div className="text-sm uppercase tracking-wider text-slate-500">
                  Action Plan
                </div>
                {response.actionPlan.map((action, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 p-3 rounded-lg bg-white/5 border border-white/10"
                  >
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    <span className="text-slate-300">{action}</span>
                  </div>
                ))}
              </div>

              {/* Projected ROI */}
              {response.projectedROI > 0 && (
                <div className="flex items-center justify-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <TrendingUp className="w-6 h-6 text-emerald-400" />
                  <div>
                    <div className="text-xs uppercase tracking-wider text-emerald-400">
                      Projected ROI
                    </div>
                    <div className="text-2xl font-bold text-emerald-300">
                      ${response.projectedROI.toLocaleString()}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
};

export default IntelligenceDashboard;

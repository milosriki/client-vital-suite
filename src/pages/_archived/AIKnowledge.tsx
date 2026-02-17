import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Brain,
  BookOpen,
  Search,
  TrendingUp,
  ArrowLeft,
  Database,
  Sparkles,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { useDedupedQuery } from "@/hooks/useDedupedQuery";

export default function AIKnowledge() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Fetch knowledge base entries from knowledge_base table
  const { data: knowledgeEntries, isLoading } = useDedupedQuery({
    queryKey: ["ai-knowledge", categoryFilter],
    queryFn: async () => {
      let query = supabase
        .from("knowledge_base")
        .select("id, content, source, category, confidence, created_at")
        .order("created_at", { ascending: false });

      if (categoryFilter !== "all") {
        query = query.eq("category", categoryFilter);
      }

      const { data, error } = await query;
      if (error) {
        console.warn("Knowledge base query error:", error);
        return [];
      }
      return data || [];
    },
  });

  // Fetch category counts
  const { data: categoryCounts } = useDedupedQuery({
    queryKey: ["ai-knowledge-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("knowledge_base")
        .select("category");

      if (error) {
        console.warn("Knowledge stats error:", error);
        return {};
      }

      const counts: Record<string, number> = {};
      (data || []).forEach((entry) => {
        const cat = entry.category || "other";
        counts[cat] = (counts[cat] || 0) + 1;
      });

      return counts;
    },
  });

  // Filter entries by search term
  const filteredEntries = knowledgeEntries?.filter((entry) =>
    searchTerm
      ? entry.content?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.source?.toLowerCase().includes(searchTerm.toLowerCase())
      : true,
  );

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      intervention: "bg-purple-500/10 text-purple-500 border-purple-500/20",
      pattern: "bg-blue-500/10 text-blue-500 border-blue-500/20",
      client_insight:
        "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
      coach_tip: "bg-amber-500/10 text-amber-500 border-amber-500/20",
      health_scoring: "bg-rose-500/10 text-rose-500 border-rose-500/20",
      business: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
    };
    return (
      colors[category] || "bg-slate-500/10 text-slate-400 border-slate-500/20"
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-20 md:pb-6">
      <div className="p-4 md:p-8 space-y-8 max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate("/")}
              className="bg-card border-border hover:bg-accent"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white flex items-center gap-2">
                <Brain className="h-6 w-6 text-purple-500" />
                Knowledge Graph
              </h1>
              <p className="text-muted-foreground text-sm">
                Deep memory and learned business insights
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => navigate("/ai-learning")}
            className="bg-card border-border hover:bg-accent hover:text-foreground gap-2"
          >
            <TrendingUp className="h-4 w-4 text-blue-500" />
            View Decision Logic
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-card border-border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Total Entities
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold flex items-center gap-2">
                {knowledgeEntries?.length || 0}
                <Database className="h-4 w-4 text-muted-foreground opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Interventions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-500">
                {categoryCounts?.intervention || 0}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Patterns
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-500">
                {categoryCounts?.pattern || 0}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Strategy
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-indigo-500">
                {categoryCounts?.business || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filter */}
        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="pb-3 border-b border-border/50">
            <CardTitle className="flex items-center gap-2 text-base">
              <Search className="h-4 w-4 text-primary" />
              Query Knowledge Base
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Search by keywords, entities, or original source..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-background border-border"
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full md:w-[200px] bg-background border-border">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="intervention">Interventions</SelectItem>
                  <SelectItem value="pattern">Patterns</SelectItem>
                  <SelectItem value="business">Business</SelectItem>
                  <SelectItem value="coach_tip">Coach Tips</SelectItem>
                  <SelectItem value="health_scoring">Health Scoring</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Knowledge Entries Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading ? (
            Array(6)
              .fill(0)
              .map((_, i) => (
                <Skeleton key={i} className="h-[200px] w-full rounded-xl" />
              ))
          ) : filteredEntries && filteredEntries.length > 0 ? (
            filteredEntries.map((entry) => (
              <Card
                key={entry.id}
                className="bg-card border-border shadow-sm hover:border-primary/30 transition-all group flex flex-col"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <Badge
                      variant="outline"
                      className={`${getCategoryColor(entry.category || "other")} mb-2`}
                    >
                      {entry.category || "other"}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {entry.created_at
                        ? format(new Date(entry.created_at), "MMM d")
                        : ""}
                    </span>
                  </div>
                  <CardTitle className="text-sm font-medium leading-relaxed line-clamp-2 min-h-[40px] flex items-start gap-2">
                    <Sparkles className="h-3 w-3 text-primary mt-1 shrink-0 px-0" />
                    {entry.source || "Insight"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col gap-3">
                  <p className="text-xs text-muted-foreground line-clamp-4 leading-relaxed">
                    {entry.content}
                  </p>

                  {/* Footer of Card */}
                  <div className="mt-auto pt-3 border-t border-border/50 flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Database className="h-3 w-3" />
                      {entry.confidence
                        ? `${Math.round(entry.confidence * 100)}% Conf.`
                        : "Verified"}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[10px] px-2 text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      View Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="col-span-full py-12 text-center border border-dashed border-border rounded-xl">
              <BookOpen className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
              <p className="text-lg font-medium text-foreground">
                No knowledge entries found
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                The neural network hasn't indexed any data matching your
                criteria yet.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

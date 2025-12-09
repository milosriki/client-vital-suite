import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Brain, BookOpen, Search, Filter, TrendingUp, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";

export default function AIKnowledge() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Fetch knowledge base entries
  const { data: knowledgeEntries, isLoading } = useQuery({
    queryKey: ["ai-knowledge", categoryFilter],
    queryFn: async () => {
      let query = supabase
        .from("agent_knowledge")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (categoryFilter !== "all") {
        query = query.eq("category", categoryFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Fetch category counts
  const { data: categoryCounts } = useQuery({
    queryKey: ["ai-knowledge-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_knowledge")
        .select("category");

      if (error) throw error;

      const counts: Record<string, number> = {};
      data.forEach((entry: any) => {
        counts[entry.category] = (counts[entry.category] || 0) + 1;
      });

      return counts;
    },
  });

  // Filter entries by search term
  const filteredEntries = knowledgeEntries?.filter((entry) =>
    searchTerm
      ? entry.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.content?.toLowerCase().includes(searchTerm.toLowerCase())
      : true
  );

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      intervention: "bg-purple-500",
      pattern: "bg-blue-500",
      client_insight: "bg-green-500",
      coach_tip: "bg-amber-500",
      health_scoring: "bg-red-500",
    };
    return colors[category] || "bg-gray-500";
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/dashboard")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Brain className="h-8 w-8 text-purple-500" />
              AI Knowledge Base
            </h1>
            <p className="text-muted-foreground">
              Browse and search AI-learned insights
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() => navigate("/ai-learning")}
        >
          <TrendingUp className="h-4 w-4 mr-2" />
          View AI Learning
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Total Entries
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {knowledgeEntries?.length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Interventions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {categoryCounts?.intervention || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Patterns
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {categoryCounts?.pattern || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Client Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {categoryCounts?.client_insight || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Search Knowledge Base
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search by title or content..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="intervention">Interventions</SelectItem>
                <SelectItem value="pattern">Patterns</SelectItem>
                <SelectItem value="client_insight">Client Insights</SelectItem>
                <SelectItem value="coach_tip">Coach Tips</SelectItem>
                <SelectItem value="health_scoring">Health Scoring</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Knowledge Entries */}
      <div className="space-y-4">
        {isLoading ? (
          <>
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </>
        ) : filteredEntries && filteredEntries.length > 0 ? (
          filteredEntries.map((entry) => (
            <Card key={entry.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2">
                      <BookOpen className="h-5 w-5" />
                      {entry.title || "Untitled"}
                    </CardTitle>
                    {entry.subcategory && (
                      <CardDescription className="mt-1">
                        {entry.subcategory}
                      </CardDescription>
                    )}
                  </div>
                  <Badge className={getCategoryColor(entry.category)}>
                    {entry.category}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {entry.content}
                </p>
                {entry.structured_data && Object.keys(entry.structured_data).length > 0 && (
                  <div className="mt-4 p-3 bg-muted rounded-lg">
                    <p className="text-xs font-medium mb-2">Additional Data:</p>
                    <pre className="text-xs overflow-auto">
                      {JSON.stringify(entry.structured_data, null, 2)}
                    </pre>
                  </div>
                )}
                <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Confidence: {Math.round((entry.confidence_score || 0) * 100)}%</span>
                  <span>
                    Created {format(new Date(entry.created_at), "PPp")}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No knowledge entries found</p>
              <p className="text-sm text-muted-foreground mt-2">
                {searchTerm || categoryFilter !== "all"
                  ? "Try adjusting your search or filters"
                  : "The AI knowledge base is currently empty"}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

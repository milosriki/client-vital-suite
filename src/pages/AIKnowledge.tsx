import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Brain, BookOpen, Search, Filter, TrendingUp, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";

interface KnowledgeEntry {
  id: string;
  category: string;
  subcategory: string | null;
  title: string;
  content: string;
  structured_data: any;
  source: string | null;
  confidence: number;
  usage_count: number;
  last_used_at: string | null;
  version: number;
  is_active: boolean;
  created_at: string;
}

export default function AIKnowledge() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const itemsPerPage = 20;

  // Fetch knowledge base
  const { data: knowledge, isLoading } = useQuery({
    queryKey: ["agent-knowledge", categoryFilter],
    queryFn: async (): Promise<KnowledgeEntry[]> => {
      try {
        let query = (supabase as any)
          .from("agent_knowledge")
          .select("*")
          .eq("is_active", true)
          .order("usage_count", { ascending: false });

        if (categoryFilter !== "all") {
          query = query.eq("category", categoryFilter);
        }

        const { data, error } = await query;

        if (error) {
          if (error.code === "42P01" || error.message?.includes("does not exist")) {
            console.info("agent_knowledge table not yet created");
            return [];
          }
          throw error;
        }

        return (data || []) as KnowledgeEntry[];
      } catch (e) {
        console.error("Error fetching knowledge:", e);
        return [];
      }
    },
    refetchInterval: 30000,
  });

  // Filter by search query
  const filteredKnowledge = knowledge?.filter((entry) =>
    searchQuery
      ? entry.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.content.toLowerCase().includes(searchQuery.toLowerCase())
      : true
  ) || [];

  // Pagination
  const totalPages = Math.ceil(filteredKnowledge.length / itemsPerPage);
  const paginatedKnowledge = filteredKnowledge.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage
  );

  // Get unique categories
  const categories = Array.from(new Set(knowledge?.map((k) => k.category) || []));

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "formula":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "rule":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "pattern":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
      case "learning":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return "text-green-600";
    if (confidence >= 0.5) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
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
                <Brain className="h-8 w-8 text-primary" />
                AI Knowledge Base
              </h1>
              <p className="text-muted-foreground mt-1">
                Explore what the AI knows and learns from your data
              </p>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Knowledge
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{knowledge?.length || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Categories
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{categories.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Most Used
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {Math.max(...(knowledge?.map((k) => k.usage_count) || [0]))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Avg Confidence
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {knowledge?.length
                  ? (
                      knowledge.reduce((acc, k) => acc + k.confidence, 0) /
                      knowledge.length
                    ).toFixed(2)
                  : "0.00"}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Search & Filter
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Search by title or content..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  className="w-full"
                />
              </div>
              <Select
                value={categoryFilter}
                onValueChange={(value) => {
                  setCategoryFilter(value);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Knowledge Cards */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2 mt-2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : paginatedKnowledge.length === 0 ? (
          <Card className="p-12 text-center">
            <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">
              {searchQuery || categoryFilter !== "all"
                ? "No knowledge entries match your search"
                : "No knowledge entries found. The AI will learn as you use it."}
            </p>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {paginatedKnowledge.map((entry) => (
                <Card key={entry.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg">{entry.title}</CardTitle>
                        <CardDescription className="mt-1">
                          {entry.subcategory && (
                            <span className="text-xs">{entry.subcategory}</span>
                          )}
                        </CardDescription>
                      </div>
                      <Badge className={getCategoryColor(entry.category)}>
                        {entry.category}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {entry.content}
                    </p>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Confidence:</span>
                        <span
                          className={`ml-2 font-semibold ${getConfidenceColor(
                            entry.confidence
                          )}`}
                        >
                          {(entry.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Used:</span>
                        <span className="ml-2 font-semibold">
                          {entry.usage_count} times
                        </span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Source:</span>
                        <span className="ml-2 font-semibold">
                          {entry.source || "unknown"}
                        </span>
                      </div>
                      {entry.last_used_at && (
                        <div className="col-span-2">
                          <span className="text-muted-foreground">Last used:</span>
                          <span className="ml-2 font-semibold">
                            {format(new Date(entry.last_used_at), "PPp")}
                          </span>
                        </div>
                      )}
                    </div>

                    {entry.structured_data &&
                      Object.keys(entry.structured_data).length > 0 && (
                        <div className="mt-4 p-3 bg-muted rounded-lg">
                          <p className="text-xs font-semibold mb-2">
                            Structured Data:
                          </p>
                          <pre className="text-xs overflow-x-auto">
                            {JSON.stringify(entry.structured_data, null, 2)}
                          </pre>
                        </div>
                      )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

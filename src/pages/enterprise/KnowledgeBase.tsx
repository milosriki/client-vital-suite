import { useState } from "react";
import { Library, Search, Brain, Database } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard/layout/DashboardHeader";
import { useKnowledgeSearch } from "@/hooks/enterprise/useKnowledgeSearch";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

export default function KnowledgeBase() {
  const [searchQuery, setSearchQuery] = useState("");
  const [category, setCategory] = useState<string | undefined>(undefined);
  const { results, stats, isLoading } = useKnowledgeSearch(searchQuery, category);

  const getCategoryColor = (cat: string) => {
    const colors: Record<string, string> = {
      intervention: "bg-purple-500/10 text-purple-500",
      pattern: "bg-blue-500/10 text-blue-500",
      client_insight: "bg-emerald-500/10 text-emerald-500",
      coach_tip: "bg-amber-500/10 text-amber-500",
      health_scoring: "bg-rose-500/10 text-rose-500",
      business: "bg-indigo-500/10 text-indigo-500",
    };
    return colors[cat] || "bg-muted text-muted-foreground";
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-8 bg-background min-h-screen">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-14 w-full max-w-3xl mx-auto rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 bg-background min-h-screen text-foreground">
      <DashboardHeader
        title="Knowledge Base"
        description={`Search across ${stats.data?.total || 0} verified intelligence entries`}
      />

      {/* Hero Search */}
      <div className="max-w-3xl mx-auto space-y-6 pt-6 pb-6">
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-violet-500/20 rounded-2xl blur opacity-25 group-hover:opacity-100 transition-all duration-1000" />
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Search knowledge base..."
              className="h-14 pl-12 rounded-xl text-lg font-medium"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {[
            "all",
            "intervention",
            "pattern",
            "business",
            "coach_tip",
            "health_scoring",
          ].map((cat) => (
            <Badge
              key={cat}
              variant="secondary"
              className={cn(
                "cursor-pointer px-3 py-1 hover:bg-primary/20",
                category === cat || (!category && cat === "all")
                  ? "bg-primary/20 text-primary"
                  : ""
              )}
              onClick={() => setCategory(cat === "all" ? undefined : cat)}
            >
              {cat === "all" ? "All" : cat.replace("_", " ")}
            </Badge>
          ))}
        </div>
      </div>

      {/* Results Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(results.data || []).map((entry) => (
              <Card
                key={entry.id}
                className="bg-card border-border hover:border-primary/30 transition-all cursor-pointer group"
              >
                <CardContent className="p-5 space-y-3">
                  <div className="flex justify-between items-start">
                    <Badge
                      className={cn(
                        "text-xs",
                        getCategoryColor(entry.category || "other")
                      )}
                    >
                      {entry.category || "other"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {entry.created_at
                        ? format(new Date(entry.created_at), "MMM d")
                        : ""}
                    </span>
                  </div>
                  <h4 className="font-bold text-sm group-hover:text-primary transition-colors line-clamp-2">
                    {entry.source || "Insight"}
                  </h4>
                  <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                    {entry.content}
                  </p>
                  <div className="flex justify-between items-center text-xs text-muted-foreground pt-2 border-t border-border/50">
                    <span className="flex items-center gap-1">
                      <Database className="h-3 w-3" />
                      {entry.confidence
                        ? `${Math.round(entry.confidence * 100)}% conf`
                        : "Verified"}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          {(results.data || []).length === 0 && (
            <div className="text-center py-12 border border-dashed border-border rounded-xl">
              <Library className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
              <p className="text-lg font-medium">No entries found</p>
              <p className="text-sm text-muted-foreground mt-2">
                Try adjusting your search or category filter
              </p>
            </div>
          )}
        </div>

        {/* Stats Sidebar */}
        <div className="space-y-6">
          <div className="p-6 rounded-2xl border border-border bg-card">
            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-6 flex items-center gap-2">
              <Brain className="w-4 h-4 text-primary" /> Memory Fabric
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-baseline">
                <span className="text-xs text-muted-foreground">
                  Total Entries
                </span>
                <span className="text-xl font-bold font-mono">
                  {stats.data?.total || 0}
                </span>
              </div>
              {Object.entries(stats.data?.byCategory || {})
                .slice(0, 5)
                .map(([cat, count]) => (
                  <div key={cat} className="flex justify-between items-baseline">
                    <span className="text-xs text-muted-foreground capitalize">
                      {cat.replace("_", " ")}
                    </span>
                    <span className="text-sm font-mono font-bold">{count}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

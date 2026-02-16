import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import {
  Search,
  History,
  User,
  Mail,
  Phone,
  Calendar,
  Edit,
  ArrowRight,
  FileText,
  Clock,
  Filter,
  Download,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { getBusinessDate } from "@/lib/date-utils";
import { useDedupedQuery } from "@/hooks/useDedupedQuery";

interface PropertyChange {
  timestamp: string;
  property: string;
  oldValue: string | null;
  newValue: string | null;
  source: string;
  sourceId?: string;
  userId?: string;
}

interface AuditResult {
  contactId: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  changes: PropertyChange[];
}

export default function AuditTrail() {
  const [searchValue, setSearchValue] = useState("");
  const [searchType, setSearchType] = useState<
    "email" | "phone" | "hubspot_id"
  >("email");
  const [searchTrigger, setSearchTrigger] = useState<string | null>(null);
  const [propertyFilter, setPropertyFilter] = useState<string>("all");
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const {
    data: auditData,
    isLoading,
    error,
    refetch,
  } = useDedupedQuery({
    queryKey: ["audit-trail", searchTrigger],
    queryFn: async () => {
      if (!searchTrigger) return null;

      const { data, error } = await supabase.functions.invoke(
        "fetch-forensic-data",
        {
          body: { target_identity: searchTrigger, search_type: searchType },
        },
      );

      if (error) throw error;
      return data as AuditResult;
    },
    enabled: !!searchTrigger,
  });

  const handleSearch = () => {
    if (!searchValue.trim()) {
      toast({
        title: "Enter a value",
        description: "Please enter an email, phone, or HubSpot ID",
        variant: "destructive",
      });
      return;
    }
    setSearchTrigger(searchValue.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const toggleExpand = (id: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const filteredChanges =
    auditData?.changes?.filter((change) => {
      if (propertyFilter === "all") return true;
      return change.property
        .toLowerCase()
        .includes(propertyFilter.toLowerCase());
    }) || [];

  const uniqueProperties = [
    ...new Set(auditData?.changes?.map((c) => c.property) || []),
  ];

  const getChangeIcon = (property: string) => {
    if (property.includes("email")) return <Mail className="h-4 w-4" />;
    if (property.includes("phone")) return <Phone className="h-4 w-4" />;
    if (property.includes("name") || property.includes("owner"))
      return <User className="h-4 w-4" />;
    if (property.includes("date") || property.includes("time"))
      return <Calendar className="h-4 w-4" />;
    return <Edit className="h-4 w-4" />;
  };

  const exportToCSV = () => {
    if (!filteredChanges.length) return;

    const headers = [
      "Timestamp",
      "Property",
      "Old Value",
      "New Value",
      "Source",
      "User",
    ];
    const rows = filteredChanges.map((c) => [
      c.timestamp,
      c.property,
      c.oldValue || "",
      c.newValue || "",
      c.source,
      c.userId || "",
    ]);

    const csv = [
      headers.join(","),
      ...rows.map((r) => r.map((v) => `"${v}"`).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-trail-${searchValue}-${format(getBusinessDate(), "yyyy-MM-dd")}.csv`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <History className="h-8 w-8 text-primary" />
              Audit Trail
            </h1>
            <p className="text-muted-foreground mt-1">
              Forensic view of all changes to contacts in HubSpot
            </p>
          </div>
        </div>

        {/* Search Card */}
        <Card className="card-dashboard">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Search className="h-5 w-5" />
              Search Contact History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-3">
              <Select
                value={searchType}
                onValueChange={(v: "email" | "phone" | "hubspot_id") =>
                  setSearchType(v)
                }
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Search by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="phone">Phone</SelectItem>
                  <SelectItem value="hubspot_id">HubSpot ID</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex-1 relative">
                <Input
                  placeholder={
                    searchType === "email"
                      ? "Enter email address..."
                      : searchType === "phone"
                        ? "Enter phone number..."
                        : "Enter HubSpot contact ID..."
                  }
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="pr-10"
                />
              </div>

              <Button onClick={handleSearch} disabled={isLoading}>
                {isLoading ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Search className="h-4 w-4 mr-2" />
                )}
                Search
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {isLoading && (
          <Card className="card-dashboard">
            <CardContent className="p-6 space-y-4">
              <Skeleton className="h-8 w-48" />
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </CardContent>
          </Card>
        )}

        {error && (
          <Card className="card-dashboard border-destructive/50">
            <CardContent className="p-6 text-center">
              <p className="text-destructive">
                Failed to fetch audit data. Please try again.
              </p>
              <Button
                variant="outline"
                onClick={() => refetch()}
                className="mt-4"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </CardContent>
          </Card>
        )}

        {auditData && (
          <>
            {/* Contact Info */}
            <Card className="card-dashboard">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">
                        {auditData.firstName} {auditData.lastName}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {auditData.email}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="font-mono text-xs">
                    {auditData.contactId}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Filters & Export */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select
                  value={propertyFilter}
                  onValueChange={setPropertyFilter}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Filter by property" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Properties</SelectItem>
                    {uniqueProperties.map((prop) => (
                      <SelectItem key={prop} value={prop}>
                        {prop}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-sm text-muted-foreground">
                  {filteredChanges.length} changes found
                </span>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={exportToCSV}
                disabled={!filteredChanges.length}
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>

            {/* Timeline */}
            {filteredChanges.length === 0 ? (
              <Card className="card-dashboard">
                <CardContent className="p-12 text-center">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    No changes found for this contact
                  </p>
                </CardContent>
              </Card>
            ) : (
              <ScrollArea className="h-[600px]">
                <div className="relative pl-8 space-y-4">
                  {/* Timeline line */}
                  <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-border" />

                  {filteredChanges.map((change, index) => {
                    const id = `${change.timestamp}-${change.property}-${index}`;
                    const isExpanded = expandedItems.has(id);

                    return (
                      <div key={id} className="relative">
                        {/* Timeline dot */}
                        <div className="absolute -left-5 w-4 h-4 rounded-full bg-primary border-2 border-background" />

                        <Card
                          className={cn(
                            "card-dashboard cursor-pointer transition-all",
                            isExpanded && "ring-1 ring-primary/30",
                          )}
                          onClick={() => toggleExpand(id)}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex items-start gap-3">
                                <div className="p-2 rounded-lg bg-muted">
                                  {getChangeIcon(change.property)}
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-medium">
                                      {change.property}
                                    </span>
                                    <Badge
                                      variant="outline"
                                      className="text-xs"
                                    >
                                      {change.source}
                                    </Badge>
                                  </div>

                                  <div className="mt-2 flex items-center gap-2 text-sm">
                                    <span className="text-muted-foreground line-through">
                                      {change.oldValue || "(empty)"}
                                    </span>
                                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                    <span className="font-medium text-primary">
                                      {change.newValue || "(empty)"}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                <span>
                                  {formatDistanceToNow(
                                    new Date(change.timestamp),
                                    { addSuffix: true },
                                  )}
                                </span>
                                {isExpanded ? (
                                  <ChevronUp className="h-4 w-4" />
                                ) : (
                                  <ChevronDown className="h-4 w-4" />
                                )}
                              </div>
                            </div>

                            {isExpanded && (
                              <div className="mt-4 pt-4 border-t text-sm space-y-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground">
                                    Exact time:
                                  </span>
                                  <span className="font-mono">
                                    {format(new Date(change.timestamp), "PPpp")}
                                  </span>
                                </div>
                                {change.userId && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-muted-foreground">
                                      Changed by:
                                    </span>
                                    <span>{change.userId}</span>
                                  </div>
                                )}
                                {change.sourceId && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-muted-foreground">
                                      Source ID:
                                    </span>
                                    <span className="font-mono text-xs">
                                      {change.sourceId}
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </>
        )}

        {/* Empty state */}
        {!searchTrigger && !isLoading && (
          <Card className="card-dashboard">
            <CardContent className="p-12 text-center">
              <History className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-semibold mb-2">
                Search Contact History
              </h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Enter an email address, phone number, or HubSpot contact ID to
                see all historical changes made to that contact.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

import { useState } from "react";
import { format } from "date-fns";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useDedupedQuery } from "@/hooks/useDedupedQuery";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";

const STATUS_OPTIONS = [
  { value: "ALL", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "contacted", label: "Contacted" },
  { value: "renewed", label: "Renewed" },
  { value: "churned", label: "Churned" },
];

const PRIORITY_OPTIONS = [
  { value: "ALL", label: "All priorities" },
  { value: "CRITICAL", label: "Critical" },
  { value: "HIGH", label: "High" },
];

const PRIORITY_BADGES: Record<string, string> = {
  CRITICAL: "bg-red-500/20 text-red-400 border-red-500/40",
  HIGH: "bg-orange-500/20 text-orange-400 border-orange-500/40",
};

const STATUS_BADGES: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40",
  contacted: "bg-blue-500/20 text-blue-300 border-blue-500/40",
  renewed: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  churned: "bg-red-500/20 text-red-300 border-red-500/40",
};

type AlertRow = {
  id: string;
  client_name: string | null;
  client_phone: string | null;
  remaining_sessions: number | null;
  last_coach: string | null;
  priority: string | null;
  alert_status: string | null;
  created_at: string | null;
};

const AlertCenter = () => {
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");

  const {
    data: alerts,
    isLoading,
    refetch,
  } = useDedupedQuery<AlertRow[]>({
    queryKey: ["session-depletion-alerts", statusFilter, priorityFilter],
    queryFn: async () => {
      let query = supabase
        .from("session_depletion_alerts" as any)
        .select(
          "id, client_name, client_phone, remaining_sessions, last_coach, priority, alert_status, created_at",
        )
        .order("created_at", { ascending: false });

      if (statusFilter !== "ALL") {
        query = query.eq("alert_status", statusFilter);
      }

      if (priorityFilter !== "ALL") {
        query = query.eq("priority", priorityFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as AlertRow[];
    },
    staleTime: 60 * 1000,
  });

  const rows = alerts ?? [];

  const formatDate = (value: string | null) => {
    if (!value) return "—";
    return format(new Date(value), "MMM d, yyyy");
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-4xl font-bold">Alert Center</h1>
            <p className="text-muted-foreground">
              Monitor session depletion risks and client outreach status
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="w-full md:w-56">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-full md:w-56">
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by priority" />
              </SelectTrigger>
              <SelectContent>
                {PRIORITY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground md:ml-auto">
            Status updates require service-role access and are disabled in this view.
          </p>
        </div>

        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Priority</TableHead>
                <TableHead>Client Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Remaining Sessions</TableHead>
                <TableHead>Last Coach</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    Loading alerts...
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8}>
                    <EmptyState
                      icon={AlertTriangle}
                      title="No alerts found"
                      description="Session depletion alerts will appear here as they are generated."
                      compact
                    />
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((alert) => (
                  <TableRow key={alert.id}>
                    <TableCell>
                      <Badge className={PRIORITY_BADGES[alert.priority ?? ""] ?? "bg-muted text-muted-foreground border-muted"}>
                        {alert.priority ?? "—"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-semibold">
                      {alert.client_name ?? "—"}
                    </TableCell>
                    <TableCell>
                      {alert.client_phone ? (
                        <a
                          className="text-primary hover:underline"
                          href={`tel:${alert.client_phone}`}
                        >
                          {alert.client_phone}
                        </a>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>{alert.remaining_sessions ?? "—"}</TableCell>
                    <TableCell>{alert.last_coach ?? "—"}</TableCell>
                    <TableCell>
                      <Badge className={STATUS_BADGES[alert.alert_status ?? ""] ?? "bg-muted text-muted-foreground border-muted"}>
                        {alert.alert_status ?? "—"}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(alert.created_at)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled
                          title="Requires service-role access"
                        >
                          Mark Contacted
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled
                          title="Requires service-role access"
                        >
                          Mark Renewed
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled
                          title="Requires service-role access"
                        >
                          Mark Churned
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};

export default AlertCenter;

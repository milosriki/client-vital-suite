import { useState, useMemo } from "react";
import { format, differenceInDays } from "date-fns";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import {
  Phone,
  MessageCircle,
  RefreshCw,
  Download,
  Search,
  AlertTriangle,
  Users,
  Calendar,
} from "lucide-react";
import { useClientActivity, type ClientPackage } from "@/hooks/useClientActivity";

// ── Helpers ──

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: "bg-red-500/20 text-red-400 border-red-500/40",
  HIGH: "bg-orange-500/20 text-orange-400 border-orange-500/40",
  MEDIUM: "bg-yellow-500/20 text-yellow-400 border-yellow-500/40",
  WATCH: "bg-blue-500/20 text-blue-400 border-blue-500/40",
  SAFE: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40",
};

const ROW_BG: Record<string, string> = {
  CRITICAL: "bg-red-500/5",
  HIGH: "bg-orange-500/5",
};

function remainingColor(n: number) {
  if (n <= 1) return "text-red-400 font-bold";
  if (n <= 3) return "text-orange-400 font-semibold";
  if (n <= 5) return "text-yellow-400";
  return "text-emerald-400";
}

function daysAgoLabel(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = differenceInDays(new Date(), new Date(dateStr));
  if (d === 0) return "Today";
  if (d === 1) return "1 day ago";
  return `${d} days ago`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return format(new Date(dateStr), "MMM d, yyyy");
}

function downloadCSV(rows: ClientPackage[]) {
  const headers = [
    "Client Name", "Phone", "Package", "Remaining", "Total",
    "Last Coach", "Last Session", "Sessions/Week", "Future Booked",
    "Next Session", "Priority",
  ];
  const csvRows = rows.map((r) => [
    r.client_name, r.phone, r.package_name,
    String(r.remaining_sessions), String(r.total_sessions),
    r.last_coach, r.last_session_date ?? "",
    String(r.sessions_per_week), String(r.future_booked),
    r.next_session_date ?? "", r.depletion_priority,
  ]);
  const csv = [
    headers.join(","),
    ...csvRows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `client-activity-${format(new Date(), "yyyy-MM-dd")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── KPI Card ──

function KpiCard({
  title,
  value,
  icon: Icon,
  color,
}: {
  title: string;
  value: number | string;
  icon: React.ElementType;
  color: "emerald" | "blue" | "red" | "orange";
}) {
  const colorMap = {
    emerald: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/30 text-emerald-400",
    blue: "from-blue-500/20 to-blue-500/5 border-blue-500/30 text-blue-400",
    red: "from-red-500/20 to-red-500/5 border-red-500/30 text-red-400",
    orange: "from-orange-500/20 to-orange-500/5 border-orange-500/30 text-orange-400",
  };

  return (
    <Card className={`bg-gradient-to-br ${colorMap[color]} border`}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
          </div>
          <Icon className="h-8 w-8 opacity-60" />
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main Page ──

export default function ClientActivity() {
  const { packages, isLoading, isFetching, refetch } = useClientActivity();
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("ALL");

  const filtered = useMemo(() => {
    let rows = packages;
    if (priorityFilter !== "ALL") {
      rows = rows.filter((r) => r.depletion_priority === priorityFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.client_name?.toLowerCase().includes(q) ||
          r.last_coach?.toLowerCase().includes(q) ||
          r.phone?.toLowerCase().includes(q),
      );
    }
    return rows;
  }, [packages, search, priorityFilter]);

  const criticalCount = packages.filter((r) => r.depletion_priority === "CRITICAL").length;
  const highCount = packages.filter((r) => r.depletion_priority === "HIGH").length;
  const futureBookings = packages.reduce((sum, r) => sum + (r.future_booked ?? 0), 0);

  const lastSynced = useMemo(() => {
    if (!packages.length) return null;
    const latest = packages.reduce((max, r) =>
      r.synced_at && r.synced_at > (max ?? "") ? r.synced_at : max, packages[0]?.synced_at);
    if (!latest) return null;
    const mins = Math.round((Date.now() - new Date(latest).getTime()) / 60000);
    return mins <= 0 ? "just now" : `${mins} min ago`;
  }, [packages]);

  if (isLoading) return <PageSkeleton variant="table" />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Client Activity</h1>
          {lastSynced && (
            <p className="text-xs text-muted-foreground mt-1">Last synced: {lastSynced}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => downloadCSV(filtered)}>
            <Download className="h-4 w-4 mr-1" /> Export
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 mr-1 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Active Clients" value={packages.length} icon={Users} color="blue" />
        <KpiCard title="Critical" value={criticalCount} icon={AlertTriangle} color="red" />
        <KpiCard title="High Priority" value={highCount} icon={AlertTriangle} color="orange" />
        <KpiCard title="Future Bookings" value={futureBookings} icon={Calendar} color="emerald" />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search name, coach, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Priorities</SelectItem>
            <SelectItem value="CRITICAL">Critical</SelectItem>
            <SelectItem value="HIGH">High</SelectItem>
            <SelectItem value="MEDIUM">Medium</SelectItem>
            <SelectItem value="WATCH">Watch</SelectItem>
            <SelectItem value="SAFE">Safe</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Package</TableHead>
                <TableHead className="text-center">Remaining/Total</TableHead>
                <TableHead>Last Coach</TableHead>
                <TableHead>Last Session</TableHead>
                <TableHead className="text-center">Sess/Wk</TableHead>
                <TableHead className="text-center">Booked</TableHead>
                <TableHead>Next Session</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center text-muted-foreground py-12">
                    No clients found
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((row) => (
                  <TableRow key={row.id} className={ROW_BG[row.depletion_priority] ?? ""}>
                    <TableCell className="font-medium">{row.client_name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{row.phone}</TableCell>
                    <TableCell className="text-xs">{row.package_name}</TableCell>
                    <TableCell className="text-center">
                      <span className={remainingColor(row.remaining_sessions)}>
                        {row.remaining_sessions}
                      </span>
                      <span className="text-muted-foreground">/{row.total_sessions}</span>
                    </TableCell>
                    <TableCell className="text-xs">{row.last_coach}</TableCell>
                    <TableCell className="text-xs">
                      <div>{formatDate(row.last_session_date)}</div>
                      <div className="text-muted-foreground">{daysAgoLabel(row.last_session_date)}</div>
                    </TableCell>
                    <TableCell className="text-center">{row.sessions_per_week}</TableCell>
                    <TableCell className="text-center">{row.future_booked}</TableCell>
                    <TableCell className="text-xs">{formatDate(row.next_session_date)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={PRIORITY_COLORS[row.depletion_priority] ?? ""}>
                        {row.depletion_priority}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {row.phone && (
                          <>
                            <a href={`tel:${row.phone}`} target="_blank" rel="noreferrer">
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <Phone className="h-3.5 w-3.5" />
                              </Button>
                            </a>
                            <a
                              href={`https://wa.me/${row.phone.replace(/[^0-9]/g, "")}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-400">
                                <MessageCircle className="h-3.5 w-3.5" />
                              </Button>
                            </a>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import {
  Phone,
  PhoneCall,
  Calendar,
  User,
  Clock,
  TrendingUp,
  CheckCircle2,
  Activity,
  RefreshCw,
} from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import { useDedupedQuery } from "@/hooks/useDedupedQuery";
import { getBusinessTodayString, getBusinessDate } from "@/lib/date-utils";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { HUBSPOT_STAGE_IDS, STAGE_LABELS } from "@/constants/dealStages";

const SetterActivityToday = () => {
  const todayStr = getBusinessTodayString();
  const todayStartIso = `${todayStr}T00:00:00`;
  const todayEndIso = `${todayStr}T23:59:59`;
  const [selectedOwner, setSelectedOwner] = useState<string>("all");

  // Fetch unique setters/owners from contacts
  const { data: owners } = useDedupedQuery({
    queryKey: ["contact-owners-setter"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("owner_name")
        .not("owner_name", "is", null);
      if (error) throw error;
      const unique = [...new Set(data?.map((c) => c.owner_name).filter(Boolean))] as string[];
      return unique;
    },
  });

  // Query REAL call_records for today
  const { data: callsData, isLoading: loadingCalls } = useDedupedQuery({
    queryKey: ["setter-calls-today", selectedOwner],
    queryFn: async () => {
      let query = supabase
        .from("call_records")
        .select("*")
        .gte("created_at", todayStartIso)
        .lte("created_at", todayEndIso)
        .order("created_at", { ascending: false });

      if (selectedOwner !== "all") {
        query = query.or(`owner.ilike.%${selectedOwner}%,assigned_to.ilike.%${selectedOwner}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    staleTime: 60000,
  });

  // Query REAL bookings: deals with Assessment Booked stage updated today
  const { data: bookingsData, isLoading: loadingBookings } = useDedupedQuery({
    queryKey: ["setter-bookings-today", selectedOwner],
    queryFn: async () => {
      let query = supabase
        .from("deals")
        .select("*")
        .in("stage", [HUBSPOT_STAGE_IDS.BOOKED, HUBSPOT_STAGE_IDS.HELD, HUBSPOT_STAGE_IDS.ASSESSMENT_DONE])
        .gte("updated_at", todayStartIso)
        .order("updated_at", { ascending: false });

      if (selectedOwner !== "all") {
        query = query.ilike("owner_name", `%${selectedOwner}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    staleTime: 60000,
  });

  // Calculate metrics from REAL data
  const totalCalls = callsData?.length || 0;
  const reached = callsData?.filter(
    (c) => c.call_status === "answered" || c.call_status === "ANSWERED" || c.call_outcome === "answered",
  ).length || 0;

  const booked = bookingsData?.length || 0;

  const conversionRate =
    totalCalls > 0 ? ((booked / totalCalls) * 100).toFixed(1) : "0";
  const connectionRate =
    totalCalls > 0 ? ((reached / totalCalls) * 100).toFixed(1) : "0";
  const totalRevenue =
    bookingsData?.reduce((sum, b) => sum + (b.deal_value || 0), 0) || 0;

  return (
    <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Activity className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-semibold">
              {selectedOwner === "all" ? "Team Activity" : selectedOwner}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {format(getBusinessDate(), "EEE, MMM d")} · Real call & deal data
            </p>
          </div>
        </div>

        <Select value={selectedOwner} onValueChange={setSelectedOwner}>
          <SelectTrigger className="w-full sm:w-[200px] h-9">
            <SelectValue placeholder="Filter by setter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Members</SelectItem>
            {owners?.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Calls</p>
                <p className="text-2xl font-bold mt-1">{totalCalls}</p>
              </div>
              <div className="h-9 w-9 rounded-full bg-muted/50 flex items-center justify-center">
                <Phone className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Reached</p>
                <p className="text-2xl font-bold mt-1 text-emerald-500">{reached}</p>
              </div>
              <div className="h-9 w-9 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <PhoneCall className="h-4 w-4 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Booked</p>
                <p className="text-2xl font-bold mt-1 text-primary">{booked}</p>
              </div>
              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                <Calendar className="h-4 w-4 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Convert</p>
                <p className="text-2xl font-bold mt-1">{conversionRate}%</p>
              </div>
              <div className="h-9 w-9 rounded-full bg-muted/50 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Summary */}
      <div className="flex flex-wrap items-center gap-4 sm:gap-6 px-4 py-3 rounded-lg bg-muted/30 border border-border/30 text-xs sm:text-sm">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Status:</span>
          <Badge variant={totalCalls > 0 ? "default" : "secondary"} className="text-xs">
            {totalCalls > 0 ? "Active" : "Idle"}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Connection:</span>
          <span className="font-medium">{connectionRate}%</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Pipeline Value:</span>
          <span className="font-semibold text-emerald-500">
            {totalRevenue.toLocaleString()} AED
          </span>
        </div>
        <div className="flex items-center gap-2 sm:ml-auto text-xs text-muted-foreground">
          <RefreshCw className="h-3 w-3" />
          Updated {format(getBusinessDate(), "HH:mm")}
        </div>
      </div>

      {/* Call Activity Details — from call_records */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <PhoneCall className="h-4 w-4" />
              Call Activity
            </CardTitle>
            <span className="text-xs text-muted-foreground">
              {selectedOwner !== "all" ? selectedOwner : "All members"}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {loadingCalls ? (
            <PageSkeleton variant="table" />
          ) : callsData && callsData.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs min-w-[80px]">Time</TableHead>
                    <TableHead className="text-xs min-w-[120px]">Caller</TableHead>
                    <TableHead className="text-xs min-w-[100px]">Direction</TableHead>
                    <TableHead className="text-xs min-w-[100px]">Status</TableHead>
                    <TableHead className="text-xs min-w-[80px]">Duration</TableHead>
                    <TableHead className="text-xs min-w-[100px]">Owner</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {callsData.map((call) => (
                    <TableRow key={call.id}>
                      <TableCell className="text-sm py-2">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          {format(new Date(call.created_at || getBusinessDate().toISOString()), "HH:mm")}
                        </div>
                      </TableCell>
                      <TableCell className="py-2">
                        <span className="font-medium text-sm">{call.caller_number || call.contact_name || "Unknown"}</span>
                      </TableCell>
                      <TableCell className="py-2">
                        <Badge variant="outline" className="text-xs">
                          {call.call_direction || "inbound"}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2">
                        <Badge
                          variant={call.call_status === "answered" || call.call_status === "ANSWERED" ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {call.call_status || "unknown"}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2 text-sm">
                        {call.duration ? `${Math.round(call.duration / 60)}m ${call.duration % 60}s` : "—"}
                      </TableCell>
                      <TableCell className="py-2 text-sm text-muted-foreground">
                        {call.owner || call.assigned_to || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Phone className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No calls recorded today</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bookings Today — from deals table */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              Booked Assessments
            </CardTitle>
            <Badge variant="outline" className="text-xs">
              {bookingsData?.length || 0} today
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {loadingBookings ? (
            <PageSkeleton variant="table" />
          ) : bookingsData && bookingsData.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs min-w-[150px]">Deal</TableHead>
                    <TableHead className="text-xs min-w-[120px]">Stage</TableHead>
                    <TableHead className="text-xs min-w-[100px]">Value</TableHead>
                    <TableHead className="text-xs min-w-[120px]">Owner</TableHead>
                    <TableHead className="text-xs min-w-[80px]">Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bookingsData.map((deal) => (
                    <TableRow key={deal.id}>
                      <TableCell className="py-2">
                        <div className="flex items-center gap-2">
                          <User className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="font-medium text-sm">
                            {deal.deal_name || "Untitled Deal"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-2">
                        <Badge variant="outline" className="text-xs">
                          {STAGE_LABELS[deal.stage] || deal.stage}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2 font-semibold text-emerald-500 text-sm">
                        {(deal.deal_value || 0).toLocaleString()} AED
                      </TableCell>
                      <TableCell className="py-2 text-sm">
                        {deal.owner_name || "—"}
                      </TableCell>
                      <TableCell className="py-2 text-sm text-muted-foreground">
                        {format(new Date(deal.updated_at || deal.created_at || getBusinessDate().toISOString()), "HH:mm")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No bookings yet today</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SetterActivityToday;

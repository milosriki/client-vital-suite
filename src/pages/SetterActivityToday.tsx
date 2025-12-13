import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Phone, PhoneCall, Calendar, User, Clock, TrendingUp, CheckCircle2, Activity, RefreshCw } from "lucide-react";
import { format, startOfDay, endOfDay } from "date-fns";
import { useState } from "react";

const SetterActivityToday = () => {
  const todayStart = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());
  const [selectedOwner, setSelectedOwner] = useState<string>("all");

  // Fetch all unique owners from contacts
  const { data: owners } = useQuery({
    queryKey: ["contact-owners"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("owner_id")
        .not("owner_id", "is", null);
      
      if (error) throw error;
      
      // Get unique owners
      const uniqueOwners = [...new Set(data?.map(c => c.owner_id).filter(Boolean))];
      return uniqueOwners;
    }
  });

  // Query for calls today - filtered by owner if selected
  const { data: callsData, isLoading: loadingCalls } = useQuery({
    queryKey: ["team-calls-today", selectedOwner],
    queryFn: async () => {
      // Query intervention_log for calls made today
      let query = supabase
        .from("intervention_log")
        .select("*")
        .gte("created_at", todayStart.toISOString())
        .lte("created_at", todayEnd.toISOString())
        .order("created_at", { ascending: false });

      if (selectedOwner !== "all") {
        query = query.or(`executed_by.ilike.%${selectedOwner}%,assigned_to.ilike.%${selectedOwner}%`);
      }

      const { data: interventions, error: interventionError } = await query;
      if (interventionError) throw interventionError;

      // Query client_health_scores for clients contacted today
      let clientQuery = supabase
        .from("client_health_scores")
        .select("*")
        .gte("calculated_at", todayStart.toISOString())
        .lte("calculated_at", todayEnd.toISOString());

      if (selectedOwner !== "all") {
        clientQuery = clientQuery.ilike("assigned_coach", `%${selectedOwner}%`);
      }

      const { data: clients, error: clientError } = await clientQuery;
      if (clientError) throw clientError;

      return {
        interventions: interventions || [],
        clients: clients || []
      };
    },
    refetchInterval: 30000
  });

  // Query for bookings today
  const { data: bookingsData, isLoading: loadingBookings } = useQuery({
    queryKey: ["team-bookings-today", selectedOwner],
    queryFn: async () => {
      let query = supabase
        .from("client_health_scores")
        .select("*")
        .not("health_zone", "eq", "RED")
        .gte("calculated_at", todayStart.toISOString())
        .lte("calculated_at", todayEnd.toISOString())
        .order("health_score", { ascending: false });

      if (selectedOwner !== "all") {
        query = query.ilike("assigned_coach", `%${selectedOwner}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000
  });

  // Calculate metrics
  const totalCalls = (callsData?.interventions.length || 0) + (callsData?.clients.length || 0);
  const reached = callsData?.interventions.filter(i => 
    i.status === "COMPLETED" || 
    i.outcome === "success" ||
    i.intervention_type?.includes("call") ||
    i.intervention_type?.includes("contact")
  ).length || 0;
  
  const booked = bookingsData?.filter(b => 
    b.health_zone === "GREEN" || b.health_zone === "PURPLE"
  ).length || 0;

  const conversionRate = totalCalls > 0 ? ((booked / totalCalls) * 100).toFixed(1) : 0;
  const connectionRate = totalCalls > 0 ? ((reached / totalCalls) * 100).toFixed(1) : 0;
  const totalRevenue = bookingsData?.reduce((sum, b) => sum + (b.package_value_aed || 0), 0) || 0;

  return (
    <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto p-4 sm:p-6">
      {/* Compact Header */}
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
              {format(new Date(), "EEE, MMM d")} · Auto-refreshes
            </p>
          </div>
        </div>
        
        <Select value={selectedOwner} onValueChange={setSelectedOwner}>
          <SelectTrigger className="w-full sm:w-[160px] h-9">
            <SelectValue placeholder="Filter by owner" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Members</SelectItem>
            {owners?.map((ownerId) => (
              <SelectItem key={ownerId} value={ownerId || ''}>
                {ownerId}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* KPI Row - Compact Cards */}
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

      {/* Performance Summary - Inline */}
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
          <span className="text-muted-foreground">Revenue Potential:</span>
          <span className="font-semibold text-emerald-500">{totalRevenue.toLocaleString()} AED</span>
        </div>
        <div className="flex items-center gap-2 sm:ml-auto text-xs text-muted-foreground">
          <RefreshCw className="h-3 w-3" />
          Updated {format(new Date(), "HH:mm")}
        </div>
      </div>

      {/* Call Activity Details */}
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
            <div className="text-center py-6 text-muted-foreground text-sm">Loading...</div>
          ) : callsData && (callsData.interventions.length > 0 || callsData.clients.length > 0) ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs min-w-[80px]">Time</TableHead>
                    <TableHead className="text-xs min-w-[150px]">Client</TableHead>
                    <TableHead className="text-xs min-w-[100px]">Type</TableHead>
                    <TableHead className="text-xs min-w-[100px]">Status</TableHead>
                    <TableHead className="text-xs min-w-[120px]">Outcome</TableHead>
                  </TableRow>
                </TableHeader>
              <TableBody>
                {callsData.interventions.map((call) => (
                  <TableRow key={call.id}>
                    <TableCell className="text-sm py-2">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        {format(new Date(call.created_at || new Date()), "HH:mm")}
                      </div>
                    </TableCell>
                    <TableCell className="py-2">
                      <span className="font-medium text-sm">{call.firstname} {call.lastname}</span>
                      <div className="text-xs text-muted-foreground">{call.email}</div>
                    </TableCell>
                    <TableCell className="py-2">
                      <Badge variant="outline" className="text-xs">{call.intervention_type}</Badge>
                    </TableCell>
                    <TableCell className="py-2">
                      <Badge variant={call.status === "COMPLETED" ? "default" : "secondary"} className="text-xs">
                        {call.status || "Pending"}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-2 text-sm">
                      {call.outcome || <span className="text-muted-foreground text-xs">—</span>}
                    </TableCell>
                  </TableRow>
                ))}
                {callsData.clients.slice(0, 5).map((client) => (
                  <TableRow key={client.id}>
                    <TableCell className="text-sm py-2">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        {format(new Date(client.calculated_at || new Date()), "HH:mm")}
                      </div>
                    </TableCell>
                    <TableCell className="py-2">
                      <span className="font-medium text-sm">{client.firstname} {client.lastname}</span>
                      <div className="text-xs text-muted-foreground">{client.email}</div>
                    </TableCell>
                    <TableCell className="py-2">
                      <Badge variant="outline" className="text-xs">Contact</Badge>
                    </TableCell>
                    <TableCell className="py-2">
                      <Badge variant="default" className="text-xs">Active</Badge>
                    </TableCell>
                    <TableCell className="py-2 text-sm">
                      Health: {client.health_score?.toFixed(0)}
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

      {/* Bookings Today */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              Booked Assessments
            </CardTitle>
            <Badge variant="outline" className="text-xs">{bookingsData?.length || 0} today</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {loadingBookings ? (
            <div className="text-center py-6 text-muted-foreground text-sm">Loading...</div>
          ) : bookingsData && bookingsData.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs min-w-[150px]">Client</TableHead>
                    <TableHead className="text-xs min-w-[100px]">Segment</TableHead>
                    <TableHead className="text-xs min-w-[100px]">Value</TableHead>
                    <TableHead className="text-xs min-w-[80px]">Zone</TableHead>
                    <TableHead className="text-xs min-w-[100px]">Time</TableHead>
                  </TableRow>
                </TableHeader>
              <TableBody>
                {bookingsData.map((booking) => (
                  <TableRow key={booking.id}>
                    <TableCell className="py-2">
                      <div className="flex items-center gap-2">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-medium text-sm">{booking.firstname} {booking.lastname}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-2">
                      <Badge variant="outline" className="text-xs">{booking.client_segment || "—"}</Badge>
                    </TableCell>
                    <TableCell className="py-2 font-semibold text-emerald-500 text-sm">
                      {(booking.package_value_aed || 0).toLocaleString()} AED
                    </TableCell>
                    <TableCell className="py-2">
                      <Badge 
                        className={`text-xs ${
                          booking.health_zone === "GREEN" 
                            ? "bg-emerald-500/20 text-emerald-500 border-emerald-500/30" 
                            : booking.health_zone === "PURPLE" 
                            ? "bg-primary/20 text-primary border-primary/30" 
                            : "bg-amber-500/20 text-amber-500 border-amber-500/30"
                        }`}
                        variant="outline"
                      >
                        {booking.health_zone}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-2 text-sm text-muted-foreground">
                      {format(new Date(booking.calculated_at || new Date()), "HH:mm")}
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

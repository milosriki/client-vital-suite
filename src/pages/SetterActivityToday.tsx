import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Phone, PhoneCall, Calendar, User, Clock, TrendingUp, CheckCircle2 } from "lucide-react";
import { format, startOfDay, endOfDay } from "date-fns";

const SetterActivityToday = () => {
  const todayStart = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());

  // Query for Matthew's calls today
  const { data: callsData, isLoading: loadingCalls } = useQuery({
    queryKey: ["matthew-calls-today"],
    queryFn: async () => {
      // Query intervention_log for calls made by Matthew today
      const { data: interventions, error: interventionError } = await supabase
        .from("intervention_log")
        .select("*")
        .or('executed_by.ilike.%matthew%,assigned_to.ilike.%matthew%')
        .gte("created_at", todayStart.toISOString())
        .lte("created_at", todayEnd.toISOString())
        .order("created_at", { ascending: false });

      if (interventionError) throw interventionError;

      // Query client_health_scores for Matthew's assigned clients contacted today
      const { data: clients, error: clientError } = await supabase
        .from("client_health_scores")
        .select("*")
        .ilike("assigned_coach", "%matthew%")
        .gte("calculated_at", todayStart.toISOString())
        .lte("calculated_at", todayEnd.toISOString());

      if (clientError) throw clientError;

      return {
        interventions: interventions || [],
        clients: clients || []
      };
    },
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Query for bookings today (assessments scheduled)
  const { data: bookingsData, isLoading: loadingBookings } = useQuery({
    queryKey: ["matthew-bookings-today"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_health_scores")
        .select("*")
        .ilike("assigned_coach", "%matthew%")
        .not("health_zone", "eq", "RED")
        .gte("calculated_at", todayStart.toISOString())
        .lte("calculated_at", todayEnd.toISOString())
        .order("health_score", { ascending: false });

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Matthew's Activity Today</h1>
        <p className="text-muted-foreground">
          Real-time data from Supabase - {format(new Date(), "EEEE, MMMM dd, yyyy")}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Calls</CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCalls}</div>
            <p className="text-xs text-muted-foreground">
              Calls made today
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reached</CardTitle>
            <PhoneCall className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{reached}</div>
            <p className="text-xs text-muted-foreground">
              Successfully connected
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Booked</CardTitle>
            <Calendar className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{booked}</div>
            <p className="text-xs text-muted-foreground">
              Assessments scheduled
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{conversionRate}%</div>
            <p className="text-xs text-muted-foreground">
              Calls to bookings
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Call Activity Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PhoneCall className="h-5 w-5" />
            Call Activity Log - Today
          </CardTitle>
          <CardDescription>
            Real-time call records for Matthew (auto-refreshes every 30 seconds)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingCalls ? (
            <div className="text-center py-8 text-muted-foreground">Loading call activity...</div>
          ) : callsData && (callsData.interventions.length > 0 || callsData.clients.length > 0) ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Outcome</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {callsData.interventions.map((call) => (
                  <TableRow key={call.id}>
                    <TableCell className="text-sm">
                      <div className="flex items-center gap-2">
                        <Clock className="h-3 w-3" />
                        {format(new Date(call.created_at || new Date()), "HH:mm")}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {call.firstname} {call.lastname}
                      <div className="text-xs text-muted-foreground">{call.email}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{call.intervention_type}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={call.status === "COMPLETED" ? "default" : "secondary"}>
                        {call.status || "Pending"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {call.outcome ? (
                        <span className="text-sm">{call.outcome}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">In progress</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {callsData.clients.slice(0, 5).map((client) => (
                  <TableRow key={client.id}>
                    <TableCell className="text-sm">
                      <div className="flex items-center gap-2">
                        <Clock className="h-3 w-3" />
                        {format(new Date(client.calculated_at || new Date()), "HH:mm")}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {client.firstname} {client.lastname}
                      <div className="text-xs text-muted-foreground">{client.email}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">Client Contact</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="default">Active</Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">Health: {client.health_score?.toFixed(0)}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Alert>
              <Phone className="h-4 w-4" />
              <AlertTitle>No Calls Yet Today</AlertTitle>
              <AlertDescription>
                No call activity recorded for Matthew today. Data refreshes automatically every 30 seconds.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Bookings Today */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-success" />
            Booked Assessments - Today
          </CardTitle>
          <CardDescription>
            Clients Matthew has successfully booked today
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingBookings ? (
            <div className="text-center py-8 text-muted-foreground">Loading bookings...</div>
          ) : bookingsData && bookingsData.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Package Value</TableHead>
                  <TableHead>Health Zone</TableHead>
                  <TableHead>Booked At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookingsData.map((booking) => (
                  <TableRow key={booking.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        {booking.firstname} {booking.lastname}
                      </div>
                      <div className="text-xs text-muted-foreground">{booking.email}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{booking.client_segment || "N/A"}</Badge>
                    </TableCell>
                    <TableCell className="font-bold text-success">
                      {(booking.package_value_aed || 0).toLocaleString()} AED
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant="default" 
                        className={
                          booking.health_zone === "GREEN" 
                            ? "bg-success" 
                            : booking.health_zone === "PURPLE" 
                            ? "bg-primary" 
                            : "bg-warning"
                        }
                      >
                        {booking.health_zone}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {format(new Date(booking.calculated_at || new Date()), "HH:mm")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Alert>
              <Calendar className="h-4 w-4" />
              <AlertTitle>No Bookings Yet</AlertTitle>
              <AlertDescription>
                No assessments booked by Matthew today. Keep calling!
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Performance Summary */}
      <Card className="border-primary">
        <CardHeader>
          <CardTitle>Today's Performance Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-center pb-2 border-b">
              <span className="font-medium">Activity Status</span>
              <Badge variant={totalCalls > 0 ? "default" : "secondary"}>
                {totalCalls > 0 ? "Active" : "No Activity"}
              </Badge>
            </div>
            <div className="flex justify-between items-center pb-2 border-b">
              <span className="font-medium">Connection Rate</span>
              <span className="font-bold">
                {totalCalls > 0 ? ((reached / totalCalls) * 100).toFixed(1) : 0}%
              </span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b">
              <span className="font-medium">Booking Rate</span>
              <span className="font-bold text-success">
                {conversionRate}%
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-medium">Total Revenue Potential</span>
              <span className="font-bold text-success">
                {bookingsData?.reduce((sum, b) => sum + (b.package_value_aed || 0), 0).toLocaleString() || 0} AED
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Alert>
        <Clock className="h-4 w-4" />
        <AlertTitle>Live Data</AlertTitle>
        <AlertDescription>
          This dashboard automatically refreshes every 30 seconds to show real-time activity from Supabase.
          Last updated: {format(new Date(), "HH:mm:ss")}
        </AlertDescription>
      </Alert>
    </div>
  );
};

export default SetterActivityToday;

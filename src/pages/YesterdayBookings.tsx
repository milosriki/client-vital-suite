import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Calendar, User, DollarSign, MapPin, Clock, CheckCircle2 } from "lucide-react";
import { format, startOfDay, endOfDay, subDays } from "date-fns";

const YesterdayBookings = () => {
  const yesterday = subDays(new Date(), 1);
  const yesterdayStart = startOfDay(yesterday);
  const yesterdayEnd = endOfDay(yesterday);

  // Query for bookings from yesterday
  const { data: bookings, isLoading } = useQuery({
    queryKey: ["yesterday-bookings"],
    queryFn: async () => {
      // Try multiple approaches to find bookings from yesterday
      
      // Approach 1: Check intervention_log for booked assessments
      const { data: interventions, error: interventionError } = await supabase
        .from("intervention_log")
        .select("*")
        .or('intervention_type.ilike.%booking%,intervention_type.ilike.%assessment%,intervention_type.ilike.%scheduled%')
        .gte("created_at", yesterdayStart.toISOString())
        .lte("created_at", yesterdayEnd.toISOString())
        .order("created_at", { ascending: false })
        .limit(5);

      if (interventionError) console.error("Intervention query error:", interventionError);

      // Approach 2: Check client_health_scores for GREEN/PURPLE clients from yesterday
      const { data: greenClients, error: clientError } = await supabase
        .from("client_health_scores")
        .select("*")
        .in("health_zone", ["GREEN", "PURPLE"])
        .gte("calculated_at", yesterdayStart.toISOString())
        .lte("calculated_at", yesterdayEnd.toISOString())
        .order("health_score", { ascending: false })
        .limit(5);

      if (clientError) console.error("Client query error:", clientError);

      // Combine and deduplicate results
      const allBookings = [
        ...(interventions || []).map(i => ({
          id: i.id,
          type: 'intervention' as const,
          client_name: `${i.firstname || ''} ${i.lastname || ''}`.trim(),
          email: i.email,
          coach: i.assigned_to || i.executed_by || 'Unknown',
          value: i.revenue_protected_aed || 0,
          status: i.status,
          intervention_type: i.intervention_type,
          created_at: i.created_at,
          health_zone: i.health_zone_after || i.health_zone,
          notes: i.notes,
          location: undefined
        })),
        ...(greenClients || []).map(c => ({
          id: c.id,
          type: 'client' as const,
          client_name: `${c.firstname || ''} ${c.lastname || ''}`.trim(),
          email: c.email,
          coach: c.assigned_coach || 'Unknown',
          value: c.package_value_aed || 0,
          status: 'BOOKED',
          health_zone: c.health_zone,
          created_at: c.calculated_at,
          location: c.client_segment,
          intervention_type: undefined,
          notes: undefined
        }))
      ];

      // Remove duplicates based on email
      const uniqueBookings = Array.from(
        new Map(allBookings.map(b => [b.email, b])).values()
      );

      return uniqueBookings.slice(0, 5);
    },
  });

  const totalValue = bookings?.reduce((sum, booking) => sum + (booking.value || 0), 0) || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Yesterday's Bookings</h1>
        <p className="text-muted-foreground">
          {format(yesterday, "EEEE, MMMM dd, yyyy")} - Assessment bookings and conversions
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Bookings</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{bookings?.length || 0}</div>
            <p className="text-xs text-muted-foreground">
              Assessments scheduled yesterday
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <DollarSign className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">
              {totalValue.toLocaleString()} AED
            </div>
            <p className="text-xs text-muted-foreground">
              Combined package value
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {bookings && bookings.length > 0 
                ? Math.round(totalValue / bookings.length).toLocaleString() 
                : 0} AED
            </div>
            <p className="text-xs text-muted-foreground">
              Per booking
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Bookings Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            5 Bookings from Yesterday
          </CardTitle>
          <CardDescription>
            Assessment bookings and conversions from {format(yesterday, "MMMM dd, yyyy")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading yesterday's bookings...</div>
          ) : bookings && bookings.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Coach/Setter</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings.map((booking) => (
                  <TableRow key={booking.id}>
                    <TableCell className="text-sm">
                      <div className="flex items-center gap-2">
                        <Clock className="h-3 w-3" />
                        {format(new Date(booking.created_at || yesterday), "HH:mm")}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        {booking.client_name || "Unknown"}
                      </div>
                      <div className="text-xs text-muted-foreground">{booking.email}</div>
                      {booking.location && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                          <MapPin className="h-3 w-3" />
                          {booking.location}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{booking.coach}</Badge>
                    </TableCell>
                    <TableCell>
                      {booking.type === 'intervention' ? (
                        <Badge variant="secondary">
                          {booking.intervention_type || "Booking"}
                        </Badge>
                      ) : (
                        <Badge variant="default">
                          {booking.health_zone || "Assessment"}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-bold text-success">
                      {(booking.value || 0).toLocaleString()} AED
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant="default"
                        className={
                          booking.health_zone === "GREEN" 
                            ? "bg-success" 
                            : booking.health_zone === "PURPLE"
                            ? "bg-primary"
                            : "bg-secondary"
                        }
                      >
                        {booking.status || "Confirmed"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Alert>
              <Calendar className="h-4 w-4" />
              <AlertTitle>No Bookings Found</AlertTitle>
              <AlertDescription>
                No bookings or assessments were recorded for {format(yesterday, "MMMM dd, yyyy")}. 
                This could mean:
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>It was a day off or weekend</li>
                  <li>Bookings were not logged in the system</li>
                  <li>All activity happened on different dates</li>
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Additional Details */}
      {bookings && bookings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Booking Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {bookings.map((booking, index) => (
                <div key={booking.id} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-lg">Booking #{index + 1}</div>
                    <Badge>{format(new Date(booking.created_at || yesterday), "HH:mm")}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Client:</span>
                      <div className="font-medium">{booking.client_name}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Coach:</span>
                      <div className="font-medium">{booking.coach}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Package Value:</span>
                      <div className="font-medium text-success">{(booking.value || 0).toLocaleString()} AED</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Zone:</span>
                      <div className="font-medium">{booking.health_zone || "N/A"}</div>
                    </div>
                  </div>
                  {booking.notes && (
                    <div className="text-sm pt-2 border-t">
                      <span className="text-muted-foreground">Notes:</span>
                      <div className="mt-1">{booking.notes}</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Alert>
        <Calendar className="h-4 w-4" />
        <AlertTitle>Data Source</AlertTitle>
        <AlertDescription>
          This data is pulled from your Supabase database tables: intervention_log and client_health_scores.
          Date range: {format(yesterdayStart, "yyyy-MM-dd HH:mm")} to {format(yesterdayEnd, "yyyy-MM-dd HH:mm")}
        </AlertDescription>
      </Alert>
    </div>
  );
};

export default YesterdayBookings;

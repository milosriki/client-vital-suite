import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Phone, PhoneCall, Calendar, User, Clock, TrendingUp, CheckCircle2, Brain, AlertTriangle, Sparkles, UserPlus, TrendingDown, ArrowRight } from "lucide-react";
import { format, startOfDay, endOfDay } from "date-fns";
import { SmartCallQueue } from "@/components/SmartCallQueue";
import { AskAI } from "@/components/ai/AskAI";

const SetterActivityToday = () => {
  const todayStart = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());
  const [selectedOwner, setSelectedOwner] = useState<string>('all');
  const [showAIQueue, setShowAIQueue] = useState(false);
  const [isGeneratingQueue, setIsGeneratingQueue] = useState(false);
  const [aiQueueData, setAiQueueData] = useState<any>(null);

  // Query for available owners from client_health_scores and intervention_log
  const { data: owners } = useQuery({
    queryKey: ["owners"],
    queryFn: async () => {
      // Get unique owners from both tables
      const { data: coaches } = await supabase
        .from("client_health_scores")
        .select("assigned_coach")
        .not("assigned_coach", "is", null);

      const { data: executors } = await supabase
        .from("intervention_log")
        .select("executed_by, assigned_to")
        .not("executed_by", "is", null);

      const uniqueOwners = new Set<string>();

      coaches?.forEach((c: any) => {
        if (c.assigned_coach) uniqueOwners.add(c.assigned_coach);
      });

      executors?.forEach((e: any) => {
        if (e.executed_by) uniqueOwners.add(e.executed_by);
        if (e.assigned_to) uniqueOwners.add(e.assigned_to);
      });

      return Array.from(uniqueOwners).sort();
    },
  });

  // Query for calls today (dynamic owner)
  const { data: callsData, isLoading: loadingCalls } = useQuery({
    queryKey: ["calls-today", selectedOwner],
    queryFn: async () => {
      // Build intervention query based on selected owner
      let interventionQuery = supabase
        .from("intervention_log")
        .select("*")
        .gte("created_at", todayStart.toISOString())
        .lte("created_at", todayEnd.toISOString());

      if (selectedOwner !== 'all') {
        interventionQuery = interventionQuery.or(`executed_by.ilike.%${selectedOwner}%,assigned_to.ilike.%${selectedOwner}%`);
      }

      const { data: interventions, error: interventionError } = await interventionQuery.order("created_at", { ascending: false });

      if (interventionError) throw interventionError;

      // Build client query based on selected owner
      let clientQuery = supabase
        .from("client_health_scores")
        .select("*")
        .gte("calculated_at", todayStart.toISOString())
        .lte("calculated_at", todayEnd.toISOString());

      if (selectedOwner !== 'all') {
        clientQuery = clientQuery.ilike("assigned_coach", `%${selectedOwner}%`);
      }

      const { data: clients, error: clientError } = await clientQuery;

      if (clientError) throw clientError;

      return {
        interventions: interventions || [],
        clients: clients || []
      };
    },
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Query for bookings today (assessments scheduled) - dynamic owner
  const { data: bookingsData, isLoading: loadingBookings } = useQuery({
    queryKey: ["bookings-today", selectedOwner],
    queryFn: async () => {
      let query = supabase
        .from("client_health_scores")
        .select("*")
        .not("health_zone", "eq", "RED")
        .gte("calculated_at", todayStart.toISOString())
        .lte("calculated_at", todayEnd.toISOString());

      if (selectedOwner !== 'all') {
        query = query.ilike("assigned_coach", `%${selectedOwner}%`);
      }

      const { data, error } = await query.order("health_score", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000
  });

  // Query for pattern breaks - clients below their usual frequency
  const { data: patternBreaks } = useQuery({
    queryKey: ["pattern-breaks", selectedOwner],
    queryFn: async () => {
      let query = supabase
        .from("client_health_scores")
        .select("*")
        .eq("pattern_status", "PATTERN_BREAK");

      if (selectedOwner !== 'all') {
        query = query.ilike("assigned_coach", `%${selectedOwner}%`);
      }

      const { data, error } = await query.limit(10);

      if (error) throw error;
      return data || [];
    },
    refetchInterval: 60000
  });

  // Query for recently assigned clients (owner changed in last 7 days)
  const { data: recentlyAssigned } = useQuery({
    queryKey: ["recently-assigned", selectedOwner],
    queryFn: async () => {
      if (selectedOwner === 'all') return [];

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data, error } = await supabase
        .from("contact_owner_history")
        .select(`
          *,
          client_health_scores!inner(
            email,
            firstname,
            lastname,
            health_score,
            health_zone,
            assigned_coach
          )
        `)
        .eq("new_owner", selectedOwner)
        .gte("changed_at", sevenDaysAgo.toISOString())
        .order("changed_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      return data || [];
    },
    refetchInterval: 120000,
    enabled: selectedOwner !== 'all'
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

  // Handler to generate AI call queue
  const handleGenerateCallQueue = async () => {
    setIsGeneratingQueue(true);
    setShowAIQueue(true);

    try {
      // Get at-risk clients for the selected owner
      let query = supabase
        .from("client_health_scores")
        .select("*")
        .in("risk_category", ["HIGH", "CRITICAL"]);

      if (selectedOwner !== 'all') {
        query = query.ilike("assigned_coach", `%${selectedOwner}%`);
      }

      const { data: atRiskClients, error: clientError } = await query
        .order("predictive_risk_score", { ascending: false })
        .limit(10);

      if (clientError) throw clientError;

      const { data, error } = await supabase.functions.invoke('ptd-agent', {
        body: {
          query: `Generate a prioritized call queue for ${selectedOwner === 'all' ? 'all contact owners' : selectedOwner}.

For each client in the queue, provide:
1. Client name and email
2. Priority level (URGENT/HIGH/MEDIUM)
3. Specific reason they need calling (pattern break, health drop, package expiring, etc.)
4. A personalized draft WhatsApp message ready to copy

Context: ${atRiskClients?.length || 0} at-risk clients need attention.`,
          action: 'call_queue',
          context: {
            owner: selectedOwner,
            date: new Date(),
            atRiskClients: atRiskClients?.slice(0, 10).map(c => ({
              email: c.email,
              name: `${c.firstname} ${c.lastname}`,
              healthScore: c.health_score,
              riskScore: c.predictive_risk_score,
              zone: c.health_zone,
              lastContact: c.days_since_last_session,
              patternStatus: c.pattern_status
            }))
          }
        }
      });

      if (error) throw error;

      setAiQueueData(data?.response || 'No call queue generated.');
    } catch (error: any) {
      console.error('Error generating AI queue:', error);
      setAiQueueData(`Error: ${error?.message || 'Failed to generate call queue. Make sure ptd-agent is deployed.'}`);
    } finally {
      setIsGeneratingQueue(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Owner Selector */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Setter Activity Today</h1>
          <p className="text-muted-foreground">
            Real-time data from Supabase - {format(new Date(), "EEEE, MMMM dd, yyyy")}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Contact Owner:</label>
            <Select value={selectedOwner} onValueChange={setSelectedOwner}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select owner" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Owners</SelectItem>
                {owners?.map((owner) => (
                  <SelectItem key={owner} value={owner}>
                    {owner}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Smart Call Queue - AI-Powered Lead Prioritization */}
      <SmartCallQueue
        owner={selectedOwner === "all" ? null : selectedOwner}
        daysThreshold={3}
        limit={50}
        autoRefresh={true}
      />

      {/* AI Call Queue Widget */}
      <Card className="border-primary bg-gradient-to-r from-primary/5 to-background">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            AI Recommended Call Queue
          </CardTitle>
          <CardDescription>
            AI-powered recommendations for who to call today with draft messages
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={handleGenerateCallQueue}
            className="w-full gap-2"
            variant="default"
            disabled={isGeneratingQueue}
          >
            {isGeneratingQueue ? (
              <>
                <Clock className="h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generate My Smart Call Queue (AI)
              </>
            )}
          </Button>

          {showAIQueue && aiQueueData && (
            <div className="mt-4 p-4 bg-background border rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <span className="font-medium">AI-Generated Call Queue</span>
              </div>
              <div className="prose prose-sm max-w-none">
                <div className="whitespace-pre-wrap text-sm">
                  {aiQueueData}
                </div>
              </div>
            </div>
          )}

          {isGeneratingQueue && (
            <Alert>
              <Brain className="h-4 w-4" />
              <AlertTitle>AI Analysis Running</AlertTitle>
              <AlertDescription>
                Analyzing client patterns, health scores, and engagement history to create your personalized call queue...
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Recently Assigned to You */}
      {recentlyAssigned && recentlyAssigned.length > 0 && selectedOwner !== 'all' && (
        <Card className="border-blue-500 bg-blue-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-blue-600" />
              Recently Assigned to You
            </CardTitle>
            <CardDescription>
              Clients who were recently assigned to {selectedOwner} - reach out to introduce yourself
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentlyAssigned.map((assignment: any) => {
                const client = assignment.client_health_scores;
                const healthDelta = assignment.health_after !== null && assignment.health_before !== null
                  ? assignment.health_after - assignment.health_before
                  : null;

                return (
                  <div key={assignment.id} className="flex items-center justify-between p-3 border rounded-lg bg-background">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className="font-medium">{client?.firstname} {client?.lastname}</div>
                        {healthDelta !== null && healthDelta < 0 && (
                          <Badge variant="destructive" className="gap-1">
                            <TrendingDown className="h-3 w-3" />
                            {healthDelta.toFixed(0)}
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {client?.email}
                      </div>
                      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          From: <Badge variant="outline" className="text-xs">{assignment.old_owner || 'Unassigned'}</Badge>
                        </span>
                        <ArrowRight className="h-3 w-3" />
                        <span className="flex items-center gap-1">
                          {format(new Date(assignment.changed_at), "MMM dd")}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge
                        variant="default"
                        className={
                          client?.health_zone === "GREEN"
                            ? "bg-success"
                            : client?.health_zone === "YELLOW"
                            ? "bg-warning"
                            : "bg-destructive"
                        }
                      >
                        {client?.health_zone || 'UNKNOWN'}
                      </Badge>
                      {assignment.triggered_intervention && (
                        <Badge variant="secondary" className="text-xs">
                          Auto-intro created
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
              <p className="text-sm text-muted-foreground pt-2">
                {recentlyAssigned.length} client{recentlyAssigned.length > 1 ? 's' : ''} recently assigned to you
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pattern Break Alerts */}
      {patternBreaks && patternBreaks.length > 0 && (
        <Card className="border-warning bg-warning/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Pattern Breaks Today
            </CardTitle>
            <CardDescription>
              Clients below their usual call frequency - needs attention
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {patternBreaks.slice(0, 5).map((client) => (
                <div key={client.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">{client.firstname} {client.lastname}</div>
                    <div className="text-sm text-muted-foreground">
                      Usually books regularly, activity dropped
                    </div>
                  </div>
                  <Badge variant="outline" className="text-warning border-warning">
                    Pattern Break
                  </Badge>
                </div>
              ))}
              <p className="text-sm text-muted-foreground pt-2">
                {patternBreaks.length} client{patternBreaks.length > 1 ? 's' : ''} below their usual call frequency
              </p>
            </div>
          </CardContent>
        </Card>
      )}

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
      {/* Ask AI - Always Available */}
      <AskAI page="setter-activity" context={{ selectedOwner, totalCalls, reached, booked, conversionRate }} />
      </Alert>
    </div>
  );
};

export default SetterActivityToday;

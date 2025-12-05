import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, Activity, Users, Phone, Calendar, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

const HubSpotLiveData = () => {
  const [timeframe, setTimeframe] = useState("today");
  const [selectedSetter, setSelectedSetter] = useState("all");

  const { data: liveData, isLoading, refetch, error } = useQuery({
    queryKey: ["hubspot-live", timeframe, selectedSetter],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('fetch-hubspot-live', {
        body: {
          type: 'contacts',
          timeframe,
          setter: selectedSetter !== 'all' ? selectedSetter : undefined
        }
      });

      if (error) throw error;
      return data;
    },
    refetchInterval: 60000, // Refresh every minute
  });

  const { data: activityData, isLoading: loadingActivity, refetch: refetchActivity } = useQuery({
    queryKey: ["hubspot-activity", timeframe],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('fetch-hubspot-live', {
        body: {
          type: 'activity',
          timeframe
        }
      });

      if (error) throw error;
      return data;
    },
    refetchInterval: 60000,
  });

  const handleRefresh = async () => {
    toast.info("Refreshing live data from HubSpot...");
    await Promise.all([refetch(), refetchActivity()]);
    toast.success("Data refreshed successfully!");
  };

  // Extract unique owners for filter
  const uniqueOwners = liveData?.contacts
    ? Array.from(new Set(liveData.contacts.map((c: any) => c.owner)))
    : [];

  // Calculate metrics
  const totalCalls = activityData?.activities?.length || 0;
  const totalContacts = liveData?.totalContacts || 0;
  const totalDeals = liveData?.totalDeals || 0;
  const totalRevenue = liveData?.deals?.reduce((sum: number, d: any) => sum + (parseFloat(d.amount) || 0), 0) || 0;

  if (error) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertTitle>Connection Error</AlertTitle>
          <AlertDescription>
            Failed to connect to HubSpot API. Please check your HUBSPOT_API_KEY in Supabase secrets.
            Error: {error instanceof Error ? error.message : 'Unknown error'}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Activity className="h-8 w-8 text-primary" />
            HubSpot Live Data
          </h1>
          <p className="text-muted-foreground">
            Real-time data directly from HubSpot API - Auto-refreshes every 60 seconds
          </p>
        </div>
        <Button onClick={handleRefresh} disabled={isLoading || loadingActivity}>
          <RefreshCw className={`h-4 w-4 mr-2 ${(isLoading || loadingActivity) ? 'animate-spin' : ''}`} />
          Refresh Now
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <Select value={timeframe} onValueChange={setTimeframe}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="yesterday">Yesterday</SelectItem>
            <SelectItem value="this_month">This Month</SelectItem>
            <SelectItem value="last_month">Last Month</SelectItem>
            <SelectItem value="last_7_days">Last 7 Days</SelectItem>
          </SelectContent>
        </Select>

        <Select value={selectedSetter} onValueChange={setSelectedSetter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Setters" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Setters</SelectItem>
            {uniqueOwners.map((owner: string) => (
              <SelectItem key={owner} value={owner.toLowerCase()}>
                {owner}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Contacts</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalContacts}</div>
            <p className="text-xs text-muted-foreground">
              From HubSpot CRM
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Calls</CardTitle>
            <Phone className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCalls}</div>
            <p className="text-xs text-muted-foreground">
              Call activities logged
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Deals</CardTitle>
            <Calendar className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalDeals}</div>
            <p className="text-xs text-muted-foreground">
              Active deals
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">
              {totalRevenue.toLocaleString()} AED
            </div>
            <p className="text-xs text-muted-foreground">
              Deal pipeline value
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="contacts">
        <TabsList>
          <TabsTrigger value="contacts">Contacts ({totalContacts})</TabsTrigger>
          <TabsTrigger value="calls">Calls ({totalCalls})</TabsTrigger>
          <TabsTrigger value="deals">Deals ({totalDeals})</TabsTrigger>
        </TabsList>

        {/* Contacts Tab */}
        <TabsContent value="contacts">
          <Card>
            <CardHeader>
              <CardTitle>Live Contacts from HubSpot</CardTitle>
              <CardDescription>
                Real-time contact data - Last updated: {liveData ? new Date().toLocaleTimeString() : 'Loading...'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading live data from HubSpot...
                </div>
              ) : liveData?.contacts && liveData.contacts.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Owner/Setter</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Stage</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {liveData.contacts.slice(0, 50).map((contact: any) => (
                      <TableRow key={contact.id}>
                        <TableCell className="font-medium">
                          {contact.firstName} {contact.lastName}
                        </TableCell>
                        <TableCell className="text-sm">{contact.email}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{contact.owner}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={contact.callStatus?.includes('INTERESTED') ? 'default' : 'secondary'}>
                            {contact.callStatus || contact.leadStatus || 'New'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge>{contact.lifecycleStage || 'Lead'}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {contact.createdDate ? format(new Date(contact.createdDate), 'MMM dd, HH:mm') : 'N/A'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <Alert>
                  <AlertTitle>No Contacts Found</AlertTitle>
                  <AlertDescription>
                    No contacts found for the selected timeframe and filters.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Calls Tab */}
        <TabsContent value="calls">
          <Card>
            <CardHeader>
              <CardTitle>Live Call Activity</CardTitle>
              <CardDescription>
                Real-time call logs from HubSpot
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingActivity ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading call activity...
                </div>
              ) : activityData?.activities && activityData.activities.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Phone</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activityData.activities.slice(0, 50).map((activity: any) => (
                      <TableRow key={activity.id}>
                        <TableCell className="text-sm">
                          {activity.timestamp ? format(new Date(parseInt(activity.timestamp)), 'HH:mm') : 'N/A'}
                        </TableCell>
                        <TableCell className="font-medium">
                          {activity.title || 'Call'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={activity.status === 'COMPLETED' ? 'default' : 'secondary'}>
                            {activity.status || 'Unknown'}
                          </Badge>
                        </TableCell>
                        <TableCell>{activity.duration ? `${Math.round(activity.duration / 1000)}s` : 'N/A'}</TableCell>
                        <TableCell className="text-sm">{activity.toNumber || 'N/A'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <Alert>
                  <AlertTitle>No Calls Found</AlertTitle>
                  <AlertDescription>
                    No call activity found for the selected timeframe.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Deals Tab */}
        <TabsContent value="deals">
          <Card>
            <CardHeader>
              <CardTitle>Live Deals Pipeline</CardTitle>
              <CardDescription>
                Real-time deal data from HubSpot
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading deals...
                </div>
              ) : liveData?.deals && liveData.deals.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Deal Name</TableHead>
                      <TableHead>Stage</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Owner</TableHead>
                      <TableHead>Close Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {liveData.deals.map((deal: any) => (
                      <TableRow key={deal.id}>
                        <TableCell className="font-medium">{deal.name}</TableCell>
                        <TableCell>
                          <Badge>{deal.stage}</Badge>
                        </TableCell>
                        <TableCell className="font-bold text-success">
                          {parseFloat(deal.amount || 0).toLocaleString()} AED
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{deal.owner}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {deal.closeDate ? format(new Date(deal.closeDate), 'MMM dd, yyyy') : 'Not set'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <Alert>
                  <AlertTitle>No Deals Found</AlertTitle>
                  <AlertDescription>
                    No deals found for the selected timeframe and filters.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Alert>
        <Activity className="h-4 w-4" />
        <AlertTitle>Live HubSpot Connection</AlertTitle>
        <AlertDescription>
          This data is pulled directly from HubSpot API in real-time. Data auto-refreshes every 60 seconds.
          Filter date: {liveData?.filterDate ? format(new Date(liveData.filterDate), 'MMM dd, yyyy HH:mm') : 'N/A'}
        </AlertDescription>
      </Alert>
    </div>
  );
};

export default HubSpotLiveData;

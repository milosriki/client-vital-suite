import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { ClientTable } from "@/components/ClientTable";
import { HealthScoreBadge } from "@/components/HealthScoreBadge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Search, RefreshCw } from "lucide-react";
import type { ClientHealthScore } from "@/types/database";

const Clients = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [healthZoneFilter, setHealthZoneFilter] = useState("All");
  const [segmentFilter, setSegmentFilter] = useState("All");
  const [coachFilter, setCoachFilter] = useState("All");
  const [selectedClient, setSelectedClient] = useState<ClientHealthScore | null>(null);

  const { data: clients, isLoading, error, refetch } = useQuery<ClientHealthScore[]>({
    queryKey: ['clients', healthZoneFilter, segmentFilter, coachFilter],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      let query = (supabase as any)
        .from('client_health_scores')
        .select('*')
        .eq('calculated_at::date', today)
        .order('health_score', { ascending: true });

      if (healthZoneFilter !== 'All') {
        query = query.eq('health_zone', healthZoneFilter);
      }
      if (segmentFilter !== 'All') {
        query = query.eq('client_segment', segmentFilter);
      }
      if (coachFilter !== 'All') {
        query = query.eq('assigned_coach', coachFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data as ClientHealthScore[]) || [];
    },
    refetchInterval: 5 * 60 * 1000,
  });

  // Get unique coaches for filter
  const coaches = [...new Set(clients?.map(c => c.assigned_coach).filter(Boolean))];

  const filteredClients = clients?.filter((client) =>
    client.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.client_email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getHealthColor = (zone: string) => {
    switch (zone) {
      case 'RED': return 'text-[#ef4444]';
      case 'YELLOW': return 'text-[#eab308]';
      case 'GREEN': return 'text-[#22c55e]';
      case 'PURPLE': return 'text-[#a855f7]';
      default: return 'text-gray-500';
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold mb-2">Client Directory</h1>
            <p className="text-muted-foreground">View and manage all clients</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Search and Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={healthZoneFilter} onValueChange={setHealthZoneFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Health Zone" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Zones</SelectItem>
              <SelectItem value="RED">RED</SelectItem>
              <SelectItem value="YELLOW">YELLOW</SelectItem>
              <SelectItem value="GREEN">GREEN</SelectItem>
              <SelectItem value="PURPLE">PURPLE</SelectItem>
            </SelectContent>
          </Select>

          <Select value={segmentFilter} onValueChange={setSegmentFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Client Segment" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Segments</SelectItem>
              <SelectItem value="ACTIVE_CONSISTENT">Active Consistent</SelectItem>
              <SelectItem value="ACTIVE_SPORADIC">Active Sporadic</SelectItem>
              <SelectItem value="INACTIVE_RECENT">Inactive Recent</SelectItem>
              <SelectItem value="INACTIVE_LONG">Inactive Long</SelectItem>
              <SelectItem value="CHURNED">Churned</SelectItem>
            </SelectContent>
          </Select>

          <Select value={coachFilter} onValueChange={setCoachFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Coach" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Coaches</SelectItem>
              {coaches.map((coach) => (
                <SelectItem key={coach} value={coach || ''}>{coach}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Results Count */}
        <p className="text-sm text-muted-foreground">
          Showing {filteredClients?.length || 0} clients
        </p>

        {/* Client Table */}
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-96" />
          </div>
        ) : error ? (
          <Card className="p-12 text-center">
            <p className="text-destructive mb-4">Failed to load clients</p>
            <Button onClick={() => refetch()}>Try Again</Button>
          </Card>
        ) : filteredClients?.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground mb-2">
              {clients?.length === 0 
                ? "No data yet" 
                : "No clients found matching your criteria"}
            </p>
            {clients?.length === 0 && (
              <p className="text-sm text-muted-foreground">Run your n8n workflow to populate the database.</p>
            )}
          </Card>
        ) : (
          <ClientTable 
            clients={filteredClients || []} 
            onViewDetails={setSelectedClient}
          />
        )}

        {/* Client Detail Modal */}
        <Dialog open={!!selectedClient} onOpenChange={() => setSelectedClient(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center gap-4 mb-4">
                <HealthScoreBadge 
                  score={selectedClient?.health_score || 0} 
                  zone={selectedClient?.health_zone as any}
                  size="lg"
                />
                <div>
                  <DialogTitle className="text-2xl">{selectedClient?.client_name}</DialogTitle>
                  <DialogDescription>{selectedClient?.client_email}</DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <Tabs defaultValue="health">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="health">Health History</TabsTrigger>
                <TabsTrigger value="activity">Session Activity</TabsTrigger>
                <TabsTrigger value="interventions">Interventions</TabsTrigger>
              </TabsList>

              <TabsContent value="health" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">Engagement Score</p>
                    <p className="text-2xl font-semibold">{selectedClient?.engagement_score?.toFixed(1) || 'N/A'}</p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">Momentum Score</p>
                    <p className="text-2xl font-semibold">{selectedClient?.momentum_score?.toFixed(1) || 'N/A'}</p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">Package Health</p>
                    <p className="text-2xl font-semibold">{selectedClient?.package_health_score?.toFixed(1) || 'N/A'}</p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">Relationship Score</p>
                    <p className="text-2xl font-semibold">{selectedClient?.relationship_score?.toFixed(1) || 'N/A'}</p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="activity" className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">Last 7 Days</p>
                    <p className="text-2xl font-semibold">{selectedClient?.sessions_last_7_days}</p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">Last 30 Days</p>
                    <p className="text-2xl font-semibold">{selectedClient?.sessions_last_30_days}</p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">Last 90 Days</p>
                    <p className="text-2xl font-semibold">{selectedClient?.sessions_last_90_days}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">Outstanding Sessions</p>
                    <p className="text-2xl font-semibold">{selectedClient?.outstanding_sessions}</p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">Purchased Sessions</p>
                    <p className="text-2xl font-semibold">{selectedClient?.purchased_sessions}</p>
                  </div>
                </div>
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Days Since Last Session</p>
                  <p className="text-2xl font-semibold">{selectedClient?.days_since_last_session || 'N/A'}</p>
                </div>
              </TabsContent>

              <TabsContent value="interventions">
                <div className="text-center py-8 text-muted-foreground">
                  <p>Intervention history will be displayed here</p>
                  <p className="text-sm mt-2">This feature connects to the intervention_log table</p>
                </div>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Clients;

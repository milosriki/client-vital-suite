import { useState } from "react";
import { useClientHealthScores } from "@/hooks/useClientHealthScores";
import { ClientTable } from "@/components/ClientTable";
import { ZoneDistributionChart } from "@/components/ZoneDistributionChart";
import { RefreshButton } from "@/components/RefreshButton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

const Clients = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [healthZoneFilter, setHealthZoneFilter] = useState("All");
  const [segmentFilter, setSegmentFilter] = useState("All");
  const [coachFilter, setCoachFilter] = useState("All");

  const { data: clients, isLoading, error, refetch } = useClientHealthScores({
    healthZone: healthZoneFilter,
    segment: segmentFilter,
    coach: coachFilter,
  });

  // Get unique coaches for filter
  const coaches = [...new Set(clients?.map(c => c.assigned_coach).filter(Boolean))];

  const filteredClients = clients?.filter((client) => {
    const fullName = `${client.firstname || ''} ${client.lastname || ''}`.toLowerCase();
    return fullName.includes(searchTerm.toLowerCase()) ||
      client.email?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold mb-2">Client Directory</h1>
            <p className="text-muted-foreground">View and manage all clients</p>
          </div>
          <RefreshButton onRefresh={async () => { await refetch(); }} />
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

        {/* Zone Distribution Chart */}
        {!isLoading && clients && clients.length > 0 && (
          <ZoneDistributionChart 
            clients={clients}
            selectedZone={healthZoneFilter}
            onZoneSelect={setHealthZoneFilter}
          />
        )}

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
          />
        )}
      </div>
    </div>
  );
};

export default Clients;

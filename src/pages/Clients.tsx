import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useClientHealthScores } from "@/hooks/useClientHealthScores";
import { ZoneDistributionChart } from "@/components/ZoneDistributionChart";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Search, RefreshCw, UserPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ClientCard } from "@/components/ClientCard";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

const Clients = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [healthZoneFilter, setHealthZoneFilter] = useState<string>(searchParams.get("zone") || "All");
  const [segmentFilter, setSegmentFilter] = useState<string>("All");
  const [coachFilter, setCoachFilter] = useState<string>("All");
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [addClientDialogOpen, setAddClientDialogOpen] = useState(false);
  const [newClientData, setNewClientData] = useState({ firstname: "", lastname: "", email: "" });
  const [isAddingClient, setIsAddingClient] = useState(false);

  const { data: clientsData, isLoading, error, refetch } = useClientHealthScores({
    healthZone: healthZoneFilter,
    segment: segmentFilter,
    coach: coachFilter,
    searchTerm: searchTerm,
    page,
    pageSize
  });

  const clients = clientsData?.data || [];
  const totalCount = clientsData?.count || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [searchTerm, healthZoneFilter, segmentFilter, coachFilter]);

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchTerm(e.target.value);
    };

    const handleAddClient = async () => {
      if (!newClientData.email || !newClientData.firstname) {
        toast.error("Please fill in at least first name and email");
        return;
      }
      setIsAddingClient(true);
      try {
        const { error } = await supabase
          .from('contacts')
          .insert({
            email: newClientData.email,
            firstname: newClientData.firstname,
            lastname: newClientData.lastname,
            created_at: new Date().toISOString()
          });
      
        if (error) throw error;
        toast.success("Client added successfully");
        setAddClientDialogOpen(false);
        setNewClientData({ firstname: "", lastname: "", email: "" });
        refetch();
      } catch (err: any) {
        toast.error("Failed to add client: " + err.message);
      } finally {
        setIsAddingClient(false);
      }
    };

    if (error) {
    toast.error("Failed to load clients");
  }

  return (
    <div className="space-y-6 p-6 min-h-screen bg-background">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Client Directory</h1>
          <p className="text-muted-foreground">
            Manage and monitor client health scores and engagement.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
                    <Button className="bg-gradient-to-r from-cyan-600 to-blue-600" onClick={() => setAddClientDialogOpen(true)}>
                      <UserPlus className="mr-2 h-4 w-4" />
                      Add Client
                    </Button>
        </div>
      </div>

      {/* Filters & Search */}
      <Card className="bg-card/50 backdrop-blur-sm border-white/10">
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <CardTitle className="text-xl font-semibold text-white">
              Clients ({totalCount})
            </CardTitle>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search clients..."
                  className="pl-8 w-full sm:w-[250px] bg-background/50 border-white/10"
                  value={searchTerm}
                  onChange={handleSearch}
                />
              </div>
              <Select value={healthZoneFilter} onValueChange={setHealthZoneFilter}>
                <SelectTrigger className="w-full sm:w-[150px] bg-background/50 border-white/10">
                  <SelectValue placeholder="Health Zone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Zones</SelectItem>
                  <SelectItem value="Green">Green</SelectItem>
                  <SelectItem value="Yellow">Yellow</SelectItem>
                  <SelectItem value="Red">Red</SelectItem>
                  <SelectItem value="Purple">Purple</SelectItem>
                </SelectContent>
              </Select>
              <Select value={segmentFilter} onValueChange={setSegmentFilter}>
                <SelectTrigger className="w-full sm:w-[150px] bg-background/50 border-white/10">
                  <SelectValue placeholder="Segment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Segments</SelectItem>
                  <SelectItem value="High Value">High Value</SelectItem>
                  <SelectItem value="At Risk">At Risk</SelectItem>
                  <SelectItem value="New">New</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {/* Client Grid */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {clients.map((client) => (
                  <ClientCard 
                    key={client.client_id} 
                    client={client} 
                    onViewDetails={() => navigate(`/clients/${client.client_id}`)}
                  />
                ))}
              </div>

              {/* Empty State */}
              {clients.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  No clients found matching your criteria.
                </div>
              )}
              
              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-4 mt-8">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {page} of {totalPages}
                  </span>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
      
      {/* Zone Distribution (Optional - shows stats for current page/filter) */}
      {!isLoading && clients.length > 0 && (
         <div className="mt-8">
            <h3 className="text-lg font-semibold text-white mb-4">Health Distribution (Current View)</h3>
            <ZoneDistributionChart 
              clients={clients}
              selectedZone={healthZoneFilter}
              onZoneSelect={setHealthZoneFilter}
            />
         </div>
      )}

      <Dialog open={addClientDialogOpen} onOpenChange={setAddClientDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Client</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="firstname">First Name *</Label>
              <Input
                id="firstname"
                value={newClientData.firstname}
                onChange={(e) => setNewClientData({ ...newClientData, firstname: e.target.value })}
                placeholder="Enter first name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastname">Last Name</Label>
              <Input
                id="lastname"
                value={newClientData.lastname}
                onChange={(e) => setNewClientData({ ...newClientData, lastname: e.target.value })}
                placeholder="Enter last name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={newClientData.email}
                onChange={(e) => setNewClientData({ ...newClientData, email: e.target.value })}
                placeholder="Enter email address"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddClientDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddClient} disabled={isAddingClient}>
              {isAddingClient ? "Adding..." : "Add Client"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Clients;

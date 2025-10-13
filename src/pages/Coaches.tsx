import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { CoachCard } from "@/components/CoachCard";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ClientCard } from "@/components/ClientCard";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import type { CoachPerformance, ClientHealthScore } from "@/types/database";

const Coaches = () => {
  const [selectedCoach, setSelectedCoach] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState<ClientHealthScore | null>(null);

  const { data: coaches, isLoading, error, refetch } = useQuery<CoachPerformance[]>({
    queryKey: ['coach-performance'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await (supabase as any)
        .from('coach_performance')
        .select('*')
        .eq('report_date', today)
        .order('avg_health_score', { ascending: false });

      if (error) throw error;
      return (data as CoachPerformance[]) || [];
    },
    refetchInterval: 5 * 60 * 1000,
  });

  const { data: coachClients } = useQuery<ClientHealthScore[]>({
    queryKey: ['coach-clients', selectedCoach],
    queryFn: async () => {
      if (!selectedCoach) return [];

      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await (supabase as any)
        .from('client_health_scores')
        .select('*')
        .eq('assigned_coach', selectedCoach)
        .eq('calculated_at::date', today)
        .order('health_score', { ascending: true });

      if (error) throw error;
      return (data as ClientHealthScore[]) || [];
    },
    enabled: !!selectedCoach,
  });

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold mb-2">Coach Performance</h1>
            <p className="text-muted-foreground">Track coach metrics and client management</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Coach Cards Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-64" />)}
          </div>
        ) : error ? (
          <Card className="p-12 text-center">
            <p className="text-destructive mb-4">Failed to load coach data</p>
            <Button onClick={() => refetch()}>Try Again</Button>
          </Card>
        ) : coaches?.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground mb-2">No data yet</p>
            <p className="text-sm text-muted-foreground">Run your n8n workflow to populate the database.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {coaches?.map((coach) => (
              <CoachCard
                key={coach.id}
                coach={coach}
                onViewClients={() => setSelectedCoach(coach.coach_name)}
              />
            ))}
          </div>
        )}

        {/* Coach Detail Modal */}
        <Dialog open={!!selectedCoach} onOpenChange={() => setSelectedCoach(null)}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl">{selectedCoach}'s Clients</DialogTitle>
            </DialogHeader>

            <div className="mb-6">
              <p className="text-sm text-muted-foreground mb-2">
                Total Clients: {coachClients?.length || 0}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {coachClients?.map((client) => (
                <ClientCard
                  key={client.id}
                  client={client}
                  onViewDetails={() => setSelectedClient(client)}
                />
              ))}
            </div>

            {coachClients?.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No clients assigned to this coach</p>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Coaches;

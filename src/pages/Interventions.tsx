import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";

const Interventions = () => {
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const { data: interventions, isLoading, refetch } = useQuery({
    queryKey: ['interventions-all', statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('intervention_log')
        .select('*')
        .order('triggered_at', { ascending: false });

      if (statusFilter !== 'ALL') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 5 * 60 * 1000,
  });

  const getPriorityColor = (priority: string | null) => {
    switch (priority?.toUpperCase()) {
      case 'CRITICAL': return 'bg-red-500';
      case 'HIGH': return 'bg-orange-500';
      case 'MEDIUM': return 'bg-yellow-500';
      case 'LOW': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string | null) => {
    switch (status?.toUpperCase()) {
      case 'COMPLETED': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'CANCELLED': return <XCircle className="h-4 w-4 text-red-500" />;
      default: return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const pendingCritical = interventions?.filter(i => i.status === 'PENDING' && i.priority === 'CRITICAL').length || 0;
  const pendingHigh = interventions?.filter(i => i.status === 'PENDING' && i.priority === 'HIGH').length || 0;
  const completed = interventions?.filter(i => i.status === 'COMPLETED').length || 0;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold mb-2">Interventions</h1>
            <p className="text-muted-foreground">Track and manage client interventions</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Critical Pending</p>
                  <p className="text-3xl font-bold text-red-500">{pendingCritical}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-red-500/20 flex items-center justify-center">
                  <AlertTriangle className="h-6 w-6 text-red-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">High Priority</p>
                  <p className="text-3xl font-bold text-orange-500">{pendingHigh}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-orange-500/20 flex items-center justify-center">
                  <AlertTriangle className="h-6 w-6 text-orange-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Completed</p>
                  <p className="text-3xl font-bold text-green-500">{completed}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-green-500/20 flex items-center justify-center">
                  <CheckCircle className="h-6 w-6 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          {['ALL', 'PENDING', 'COMPLETED', 'CANCELLED'].map(status => (
            <Button
              key={status}
              variant={statusFilter === status ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter(status)}
            >
              {status}
            </Button>
          ))}
        </div>

        {/* Interventions List */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-48" />)}
          </div>
        ) : interventions?.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground">No interventions found</p>
          </Card>
        ) : (
          <div className="space-y-4">
            {interventions?.map((intervention) => (
              <Card key={intervention.id} className="card-hover">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        {getStatusIcon(intervention.status)}
                        <CardTitle className="text-lg">
                          {intervention.email}
                        </CardTitle>
                        {intervention.priority && (
                          <Badge className={`${getPriorityColor(intervention.priority)} text-white border-none`}>
                            {intervention.priority}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{intervention.email}</p>
                    </div>
                    <Badge variant="outline">{intervention.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {intervention.intervention_type && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Type</p>
                      <p className="text-sm">{intervention.intervention_type}</p>
                    </div>
                  )}

                  {intervention.trigger_reason && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Trigger Reason</p>
                      <p className="text-sm">{intervention.trigger_reason}</p>
                    </div>
                  )}

                  {intervention.ai_recommendation && (
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <p className="text-sm font-medium text-muted-foreground mb-2">AI Recommendation</p>
                      <p className="text-sm">{intervention.ai_recommendation}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    {intervention.health_score_at_trigger !== null && (
                      <div>
                        <p className="text-muted-foreground">Health Score</p>
                        <p className="font-semibold">{intervention.health_score_at_trigger.toFixed(1)}</p>
                      </div>
                    )}
                    {intervention.assigned_to && (
                      <div>
                        <p className="text-muted-foreground">Assigned To</p>
                        <p className="font-semibold">{intervention.assigned_to}</p>
                      </div>
                    )}
                    {intervention.triggered_at && (
                      <div>
                        <p className="text-muted-foreground">Triggered</p>
                        <p className="font-semibold">{format(new Date(intervention.triggered_at), 'MMM d, yyyy')}</p>
                      </div>
                    )}
                    {intervention.completed_at && (
                      <div>
                        <p className="text-muted-foreground">Completed</p>
                        <p className="font-semibold">{format(new Date(intervention.completed_at), 'MMM d, yyyy')}</p>
                      </div>
                    )}
                  </div>

                  {intervention.status === 'PENDING' && (
                    <div className="flex gap-2 pt-4">
                      <Button size="sm" variant="default">Mark Complete</Button>
                      <Button size="sm" variant="outline">Add Notes</Button>
                      <Button size="sm" variant="ghost">Cancel</Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Interventions;

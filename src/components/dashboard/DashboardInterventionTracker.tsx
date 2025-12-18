import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle, Clock, AlertTriangle, Target, ListTodo } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { QUERY_KEYS } from '@/config/queryKeys';

export function DashboardInterventionTracker() {
  const queryClient = useQueryClient();
  const [selectedIntervention, setSelectedIntervention] = useState<any>(null);
  const [notes, setNotes] = useState('');

  // Self-fetching interventions
  const { data: interventions = [], isLoading } = useQuery({
    queryKey: QUERY_KEYS.interventions.dashboard,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('intervention_log')
        .select('*')
        .neq('status', 'COMPLETED')
        .order('priority', { ascending: true })
        .limit(10);
      
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 60000,
  });

  const getPriorityBadge = (priority: string | null) => {
    switch (priority) {
      case 'CRITICAL':
        return <Badge variant="destructive" className="text-xs">CRITICAL</Badge>;
      case 'HIGH':
        return <Badge className="bg-warning text-warning-foreground text-xs">HIGH</Badge>;
      case 'MEDIUM':
        return <Badge className="bg-primary/20 text-primary text-xs">MEDIUM</Badge>;
      default:
        return <Badge variant="secondary" className="text-xs">LOW</Badge>;
    }
  };

  const getStatusIcon = (status: string | null) => {
    if (status === 'COMPLETED') return <CheckCircle className="h-4 w-4 text-success" />;
    if (status === 'IN_PROGRESS') return <Clock className="h-4 w-4 text-primary" />;
    return <AlertTriangle className="h-4 w-4 text-warning" />;
  };

  const handleMarkExecuted = async (interventionId: number) => {
    const { error } = await supabase
      .from('intervention_log')
      .update({
        status: 'COMPLETED',
        actioned_at: new Date().toISOString(),
      })
      .eq('id', interventionId);

    if (error) {
      toast({ title: 'Error', description: 'Failed to update intervention status', variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Intervention marked as executed' });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.interventions.dashboard });
    }
  };

  const getDaysSince = (date: string | null) => {
    if (!date) return 0;
    const diff = Date.now() - new Date(date).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  if (isLoading) {
    return (
      <Card className="border-border/50 bg-card/80">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="h-4 w-4 text-primary" />
            Intervention Tracker
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (interventions.length === 0) {
    return (
      <Card className="border-border/50 bg-card/80">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="h-4 w-4 text-primary" />
            Intervention Tracker
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <ListTodo className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No pending interventions</p>
            <p className="text-xs text-muted-foreground/70 mt-1">All clients are on track!</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50 bg-card/80">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="h-4 w-4 text-primary" />
            Intervention Tracker
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            {interventions.length} pending
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-[400px] overflow-y-auto scrollbar-thin">
          {interventions.map((intervention) => (
            <div 
              key={intervention.id} 
              className="p-3 rounded-lg border border-border/30 bg-muted/20 hover:bg-muted/40 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    {getStatusIcon(intervention.status)}
                    <span className="font-medium text-sm truncate">
                      {intervention.firstname} {intervention.lastname}
                    </span>
                    {getPriorityBadge(intervention.priority)}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{intervention.intervention_type}</span>
                    <span>•</span>
                    <span>{getDaysSince(intervention.triggered_at)} days ago</span>
                  </div>
                  {intervention.ai_recommendation && (
                    <p className="text-xs text-muted-foreground line-clamp-2 italic">
                      {intervention.ai_recommendation}
                    </p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 text-xs h-7 px-2"
                  onClick={() => handleMarkExecuted(intervention.id)}
                >
                  Done
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface InterventionTrackerProps {
  interventions: any[];
  isLoading: boolean;
}

export function InterventionTracker({ interventions, isLoading }: InterventionTrackerProps) {
  const queryClient = useQueryClient();
  const [selectedIntervention, setSelectedIntervention] = useState<any>(null);
  const [notes, setNotes] = useState('');

  const getPriorityBadge = (priority: string | null) => {
    switch (priority) {
      case 'CRITICAL':
        return <Badge variant="destructive">CRITICAL</Badge>;
      case 'HIGH':
        return <Badge className="bg-orange-500">HIGH</Badge>;
      case 'MEDIUM':
        return <Badge className="bg-yellow-500 text-black">MEDIUM</Badge>;
      default:
        return <Badge variant="secondary">LOW</Badge>;
    }
  };

  const getStatusIcon = (status: string | null) => {
    if (status === 'COMPLETED') return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (status === 'IN_PROGRESS') return <Clock className="h-4 w-4 text-blue-500" />;
    return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
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
      toast({
        title: 'Error',
        description: 'Failed to update intervention status',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Success',
        description: 'Intervention marked as executed',
      });
      queryClient.invalidateQueries({ queryKey: ['interventions'] });
    }
  };

  const handleAddNotes = async () => {
    if (!selectedIntervention || !notes) return;

    const { error } = await supabase
      .from('intervention_log')
      .update({
        outcome: notes,
        completed_at: new Date().toISOString(),
      })
      .eq('id', selectedIntervention.id);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to add notes',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Success',
        description: 'Notes added successfully',
      });
      setNotes('');
      setSelectedIntervention(null);
      queryClient.invalidateQueries({ queryKey: ['interventions'] });
    }
  };

  const getDaysSince = (date: string | null) => {
    if (!date) return 0;
    const diff = Date.now() - new Date(date).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Intervention Tracker</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground">Loading interventions...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Intervention Tracker ({interventions.length} interventions)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {interventions.map((intervention) => (
            <Card key={intervention.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(intervention.status)}
                      <h3 className="font-semibold">
                        {intervention.firstname} {intervention.lastname}
                      </h3>
                      {getPriorityBadge(intervention.priority)}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Type:</span>{' '}
                        <span className="font-medium">{intervention.intervention_type}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Recommended by:</span>{' '}
                        <span className="font-medium">{intervention.recommended_by || 'System'}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Days since:</span>{' '}
                        <span className="font-medium">
                          {getDaysSince(intervention.triggered_at)} days
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Success probability:</span>{' '}
                        <span className="font-medium">
                          {intervention.success_probability?.toFixed(0) || 0}%
                        </span>
                      </div>
                    </div>
                    {intervention.ai_recommendation && (
                      <p className="text-sm text-muted-foreground italic">
                        {intervention.ai_recommendation}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    {intervention.status !== 'COMPLETED' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleMarkExecuted(intervention.id)}
                      >
                        Mark as Executed
                      </Button>
                    )}
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedIntervention(intervention)}
                        >
                          Add Notes
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add Outcome Notes</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <Textarea
                            placeholder="Enter outcome notes..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={5}
                          />
                          <Button onClick={handleAddNotes} className="w-full">
                            Save Notes
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';
import {
  UserCog,
  TrendingDown,
  TrendingUp,
  ArrowRight,
  Calendar,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface OwnerChange {
  id: string;
  client_email: string;
  old_owner: string | null;
  new_owner: string;
  changed_at: string;
  health_before: number | null;
  health_after: number | null;
  health_zone_before: string | null;
  health_zone_after: string | null;
  triggered_intervention: boolean;
}

interface OwnerChangeAlertProps {
  timeframe?: 'day' | 'week' | 'month';
}

export function OwnerChangeAlert({ timeframe = 'week' }: OwnerChangeAlertProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [selectedChanges, setSelectedChanges] = useState<OwnerChange[]>([]);

  // Calculate date threshold based on timeframe
  const getDateThreshold = () => {
    const now = new Date();
    switch (timeframe) {
      case 'day':
        now.setDate(now.getDate() - 1);
        break;
      case 'week':
        now.setDate(now.getDate() - 7);
        break;
      case 'month':
        now.setMonth(now.getMonth() - 1);
        break;
    }
    return now.toISOString();
  };

  // Fetch owner changes
  const { data: ownerChanges, isLoading } = useQuery({
    queryKey: ['owner-changes', timeframe],
    queryFn: async () => {
      const threshold = getDateThreshold();
      const { data, error } = await supabase
        .from('contact_owner_history')
        .select('*')
        .gte('changed_at', threshold)
        .order('changed_at', { ascending: false });

      if (error) throw error;
      return data as OwnerChange[];
    },
    refetchInterval: 60000, // Refresh every minute
  });

  // Calculate metrics
  const totalChanges = ownerChanges?.length || 0;
  const healthDrops = ownerChanges?.filter(
    (c) => c.health_after !== null && c.health_before !== null && c.health_after < c.health_before
  ).length || 0;
  const healthImprovements = ownerChanges?.filter(
    (c) => c.health_after !== null && c.health_before !== null && c.health_after >= c.health_before
  ).length || 0;
  const interventionsTriggered = ownerChanges?.filter((c) => c.triggered_intervention).length || 0;

  const handleViewDetails = (filterType: 'all' | 'drops' | 'improvements') => {
    if (!ownerChanges) return;

    let filtered = ownerChanges;
    if (filterType === 'drops') {
      filtered = ownerChanges.filter(
        (c) => c.health_after !== null && c.health_before !== null && c.health_after < c.health_before
      );
    } else if (filterType === 'improvements') {
      filtered = ownerChanges.filter(
        (c) => c.health_after !== null && c.health_before !== null && c.health_after >= c.health_before
      );
    }

    setSelectedChanges(filtered);
    setShowDetails(true);
  };

  const getHealthDelta = (change: OwnerChange) => {
    if (change.health_before === null || change.health_after === null) return null;
    return change.health_after - change.health_before;
  };

  const getTimeframeLabel = () => {
    switch (timeframe) {
      case 'day':
        return 'today';
      case 'week':
        return 'this week';
      case 'month':
        return 'this month';
    }
  };

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </Card>
    );
  }

  if (totalChanges === 0) {
    return null; // Don't show if no changes
  }

  return (
    <>
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserCog className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Contact Owner Changes</h3>
            </div>
            <Badge variant="secondary">{getTimeframeLabel()}</Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Total Changes */}
            <button
              onClick={() => handleViewDetails('all')}
              className="flex flex-col items-start p-4 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 transition-colors text-left"
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-2xl font-bold text-blue-600">{totalChanges}</span>
                <ChevronRight className="h-5 w-5 text-blue-600" />
              </div>
              <span className="text-sm text-muted-foreground mt-1">Total Changes</span>
            </button>

            {/* Health Drops */}
            {healthDrops > 0 && (
              <button
                onClick={() => handleViewDetails('drops')}
                className="flex flex-col items-start p-4 rounded-lg bg-destructive/10 hover:bg-destructive/20 transition-colors text-left"
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-destructive">{healthDrops}</span>
                    <TrendingDown className="h-4 w-4 text-destructive" />
                  </div>
                  <ChevronRight className="h-5 w-5 text-destructive" />
                </div>
                <span className="text-sm text-muted-foreground mt-1">Health Dropped</span>
              </button>
            )}

            {/* Health Improvements */}
            {healthImprovements > 0 && (
              <button
                onClick={() => handleViewDetails('improvements')}
                className="flex flex-col items-start p-4 rounded-lg bg-green-500/10 hover:bg-green-500/20 transition-colors text-left"
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-green-600">{healthImprovements}</span>
                    <TrendingUp className="h-4 w-4 text-green-600" />
                  </div>
                  <ChevronRight className="h-5 w-5 text-green-600" />
                </div>
                <span className="text-sm text-muted-foreground mt-1">Health Improved</span>
              </button>
            )}
          </div>

          {interventionsTriggered > 0 && (
            <div className="pt-2 border-t">
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-primary">{interventionsTriggered}</span>{' '}
                automatic interventions triggered
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Owner Change Details</DialogTitle>
            <DialogDescription>
              Showing {selectedChanges.length} owner change{selectedChanges.length !== 1 ? 's' : ''}{' '}
              {getTimeframeLabel()}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {selectedChanges.map((change) => {
              const healthDelta = getHealthDelta(change);
              const hasHealthData = healthDelta !== null;

              return (
                <div
                  key={change.id}
                  className="p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-2">
                      {/* Client Email */}
                      <div className="font-medium">{change.client_email}</div>

                      {/* Owner Change */}
                      <div className="flex items-center gap-2 text-sm">
                        <Badge variant="outline">{change.old_owner || 'Unassigned'}</Badge>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        <Badge variant="default">{change.new_owner}</Badge>
                      </div>

                      {/* Health Change */}
                      {hasHealthData && (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-muted-foreground">Health:</span>
                          <span className="font-mono">
                            {change.health_before?.toFixed(1) || 'N/A'}
                          </span>
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          <span className="font-mono">
                            {change.health_after?.toFixed(1) || 'N/A'}
                          </span>
                          {healthDelta !== null && (
                            <Badge
                              variant={healthDelta >= 0 ? 'default' : 'destructive'}
                              className="gap-1"
                            >
                              {healthDelta >= 0 ? (
                                <TrendingUp className="h-3 w-3" />
                              ) : (
                                <TrendingDown className="h-3 w-3" />
                              )}
                              {healthDelta > 0 ? '+' : ''}
                              {healthDelta.toFixed(1)}
                            </Badge>
                          )}
                        </div>
                      )}

                      {/* Timestamp */}
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {formatDistanceToNow(new Date(change.changed_at), { addSuffix: true })}
                      </div>

                      {/* Intervention Badge */}
                      {change.triggered_intervention && (
                        <Badge variant="secondary" className="text-xs">
                          Auto-intervention created
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

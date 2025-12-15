import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, Minus, Grid3X3, BarChart3 } from 'lucide-react';
import { HeatmapChart } from '@/components/charts/HeatmapChart';
import { TrafficLightBadge } from '@/components/ui/traffic-light-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface ClientRiskMatrixProps {
  clients: any[];
  isLoading: boolean;
}

type ViewMode = 'grid' | 'heatmap';

export function ClientRiskMatrix({ clients, isLoading }: ClientRiskMatrixProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('heatmap');

  const getRiskCategoryBorder = (riskCategory: string | null) => {
    switch (riskCategory) {
      case 'CRITICAL':
        return 'border-l-4 border-l-destructive';
      case 'HIGH':
        return 'border-l-4 border-l-orange-500';
      case 'MEDIUM':
        return 'border-l-4 border-l-warning';
      case 'LOW':
        return 'border-l-4 border-l-success';
      default:
        return 'border-l-4 border-l-border';
    }
  };

  const getMomentumIcon = (momentum: string | null) => {
    if (momentum === 'ACCELERATING' || momentum === 'IMPROVING') 
      return <TrendingUp className="h-4 w-4 text-success" />;
    if (momentum === 'DECLINING') 
      return <TrendingDown className="h-4 w-4 text-destructive" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const getRiskBadge = (riskCategory: string | null, score: number | null) => {
    const config: Record<string, string> = {
      CRITICAL: 'bg-destructive text-destructive-foreground',
      HIGH: 'bg-orange-500 text-white',
      MEDIUM: 'bg-warning text-warning-foreground',
      LOW: 'bg-success text-success-foreground',
    };

    return (
      <Badge className={config[riskCategory || 'LOW'] || 'bg-muted text-muted-foreground'}>
        Risk: {score?.toFixed(0) || 0}%
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <Card className="border-border/50 bg-card/80">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Skeleton className="h-5 w-5" />
            <Skeleton className="h-6 w-48" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="space-y-3 p-4 border border-border/30 rounded-lg">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50 bg-card/80">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="flex items-center gap-2">
          Client Risk Matrix
          <Badge variant="secondary" className="ml-2 font-mono">
            {clients.length}
          </Badge>
        </CardTitle>
        <div className="flex items-center gap-1 bg-muted/30 rounded-lg p-1">
          <Button
            variant={viewMode === 'heatmap' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('heatmap')}
            className="gap-1.5 h-8"
          >
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Heatmap</span>
          </Button>
          <Button
            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('grid')}
            className="gap-1.5 h-8"
          >
            <Grid3X3 className="h-4 w-4" />
            <span className="hidden sm:inline">Grid</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {clients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <BarChart3 className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Client Data</h3>
            <p className="text-sm text-muted-foreground">
              Sync from HubSpot to populate the risk matrix
            </p>
          </div>
        ) : viewMode === 'heatmap' ? (
          <HeatmapChart clients={clients} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-h-[600px] overflow-y-auto scrollbar-thin pr-2">
            {clients.slice(0, 20).map((client) => (
              <Card
                key={client.id}
                className={cn(
                  getRiskCategoryBorder(client.risk_category),
                  'hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 cursor-pointer relative bg-card/50'
                )}
              >
                <CardContent className="p-4 space-y-3">
                  {client.early_warning_flag && (
                    <div className="absolute top-2 right-2">
                      <span className="text-lg" title="Early Warning">🚨</span>
                    </div>
                  )}
                  
                  <div className="flex items-start justify-between">
                    <div className="flex-1 pr-8">
                      <h3 className="font-semibold truncate text-foreground">
                        {client.firstname} {client.lastname}
                      </h3>
                      <p className="text-xs text-muted-foreground truncate">{client.email}</p>
                    </div>
                    <TrafficLightBadge zone={client.health_zone || 'UNKNOWN'} size="lg" pulsing={client.health_zone === 'RED'} />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">Health</span>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold font-mono">
                          {client.health_score?.toFixed(0) || 0}
                        </span>
                        {getMomentumIcon(client.momentum_indicator || client.health_trend)}
                      </div>
                    </div>
                    <Progress value={client.health_score || 0} className="h-2" />
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {getRiskBadge(client.risk_category, client.predictive_risk_score)}
                    <Badge variant="outline" className="text-xs">
                      {client.momentum_indicator || client.health_trend || 'STABLE'}
                    </Badge>
                  </div>

                  <div className="space-y-1 text-xs border-t border-border/30 pt-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Last Session</span>
                      <span className="font-medium font-mono">
                        {client.days_since_last_session || 0}d ago
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Coach</span>
                      <span className="font-medium truncate max-w-[100px]">
                        {client.assigned_coach || 'Unassigned'}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
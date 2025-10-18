import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface ClientRiskMatrixProps {
  clients: any[];
  isLoading: boolean;
}

export function ClientRiskMatrix({ clients, isLoading }: ClientRiskMatrixProps) {
  const getPriorityColor = (priority: string | null) => {
    switch (priority) {
      case 'CRITICAL':
        return 'border-l-4 border-l-destructive';
      case 'HIGH':
        return 'border-l-4 border-l-orange-500';
      case 'MEDIUM':
        return 'border-l-4 border-l-yellow-500';
      default:
        return 'border-l-4 border-l-border';
    }
  };

  const getZoneColor = (zone: string) => {
    switch (zone) {
      case 'RED':
        return 'bg-destructive text-destructive-foreground';
      case 'YELLOW':
        return 'bg-yellow-500 text-black';
      case 'GREEN':
        return 'bg-green-500 text-white';
      case 'PURPLE':
        return 'bg-purple-500 text-white';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getTrendIcon = (trend: string | null) => {
    if (trend === 'IMPROVING') return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (trend === 'DECLINING') return <TrendingDown className="h-4 w-4 text-destructive" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Client Risk Matrix</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground">Loading clients...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Client Risk Matrix ({clients.length} clients)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {clients.map((client) => (
            <Card
              key={client.id}
              className={`${getPriorityColor(client.intervention_priority)} hover:shadow-lg transition-shadow`}
            >
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold truncate">
                      {client.firstname} {client.lastname}
                    </h3>
                    <p className="text-xs text-muted-foreground truncate">{client.email}</p>
                  </div>
                  <Badge className={getZoneColor(client.health_zone || 'UNKNOWN')}>
                    {client.health_zone}
                  </Badge>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Health Score</span>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold">
                        {client.health_score?.toFixed(0) || 0}
                      </span>
                      {getTrendIcon(client.health_trend)}
                    </div>
                  </div>
                  <Progress value={client.health_score || 0} className="h-2" />
                </div>

                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Last Session:</span>
                    <span className="font-medium">
                      {client.days_since_last_session || 0} days ago
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Churn Risk:</span>
                    <span className="font-medium">
                      {client.churn_risk_score?.toFixed(0) || 0}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Coach:</span>
                    <span className="font-medium truncate max-w-[120px]">
                      {client.assigned_coach || 'Unassigned'}
                    </span>
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

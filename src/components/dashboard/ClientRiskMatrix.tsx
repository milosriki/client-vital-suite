import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface ClientRiskMatrixProps {
  clients: any[];
  isLoading: boolean;
}

type RiskCategory = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
type MomentumIndicator = 'ACCELERATING' | 'STABLE' | 'DECLINING';

export function ClientRiskMatrix({ clients, isLoading }: ClientRiskMatrixProps) {
  const getRiskCategoryBorder = (riskCategory: string | null) => {
    switch (riskCategory) {
      case 'CRITICAL':
        return 'border-l-4 border-l-red-600';
      case 'HIGH':
        return 'border-l-4 border-l-orange-500';
      case 'MEDIUM':
        return 'border-l-4 border-l-yellow-500';
      case 'LOW':
        return 'border-l-4 border-l-green-500';
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

  const getMomentumIcon = (momentum: string | null) => {
    if (momentum === 'ACCELERATING') return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (momentum === 'DECLINING') return <TrendingDown className="h-4 w-4 text-destructive" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const getRiskBadge = (riskCategory: string | null, score: number | null) => {
    const colorClass = {
      CRITICAL: 'bg-red-600 text-white',
      HIGH: 'bg-orange-500 text-white',
      MEDIUM: 'bg-yellow-500 text-black',
      LOW: 'bg-green-500 text-white',
    }[riskCategory || 'LOW'] || 'bg-gray-500 text-white';

    return (
      <Badge className={colorClass}>
        Risk: {score?.toFixed(0) || 0}%
      </Badge>
    );
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
              className={`${getRiskCategoryBorder(client.risk_category)} hover:shadow-lg transition-shadow relative`}
            >
              <CardContent className="p-4 space-y-3">
                {client.early_warning_flag && (
                  <div className="absolute top-2 right-2">
                    <span className="text-xl" title="Early Warning">🚨</span>
                  </div>
                )}
                
                <div className="flex items-start justify-between">
                  <div className="flex-1 pr-8">
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
                      {getMomentumIcon(client.momentum_indicator)}
                    </div>
                  </div>
                  <Progress value={client.health_score || 0} className="h-2" />
                </div>

                <div className="flex items-center gap-2">
                  {getRiskBadge(client.risk_category, client.predictive_risk_score)}
                  <Badge variant="outline" className="text-xs">
                    {client.momentum_indicator || 'STABLE'}
                  </Badge>
                </div>

                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Last Session:</span>
                    <span className="font-medium">
                      {client.days_since_last_session || 0} days ago
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Rate of Change:</span>
                    <span className={`font-medium ${
                      (client.rate_of_change_percent || 0) > 0 ? 'text-green-500' : 'text-red-500'
                    }`}>
                      {client.rate_of_change_percent?.toFixed(0) || 0}%
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

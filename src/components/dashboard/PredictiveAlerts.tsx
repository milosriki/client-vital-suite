import { Card } from '@/components/ui/card';
import { AlertCircle, TrendingUp, Users } from 'lucide-react';

interface PredictiveAlertsProps {
  clients: any[];
  summary: any;
}

export function PredictiveAlerts({ clients, summary }: PredictiveAlertsProps) {
  const predictedChurns = clients.filter((c) => (c.predictive_risk_score || 0) >= 70).length;
  const highRiskClients = clients.filter(
    (c) => c.risk_category === 'CRITICAL' || c.risk_category === 'HIGH'
  ).length;
  const improvingClients = clients.filter((c) => c.momentum_indicator === 'ACCELERATING').length;

  const metrics = [
    {
      label: 'Predicted Churns Next 30 Days',
      value: predictedChurns,
      icon: AlertCircle,
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
    },
    {
      label: 'High Risk Clients Needing Intervention',
      value: highRiskClients,
      icon: Users,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
    },
    {
      label: 'Positive Trend This Week',
      value: improvingClients,
      icon: TrendingUp,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {metrics.map((metric) => (
        <Card key={metric.label} className={metric.bgColor}>
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">{metric.label}</p>
                <p className="text-3xl font-bold">{metric.value}</p>
              </div>
              <metric.icon className={`h-8 w-8 ${metric.color}`} />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

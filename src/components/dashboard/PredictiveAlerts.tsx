import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, TrendingUp, Users, Zap, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface PredictiveAlertsProps {
  clients: any[];
  summary: any;
}

export function PredictiveAlerts({ clients, summary }: PredictiveAlertsProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  
  const predictedChurns = clients.filter((c) => (c.churn_risk_score || 0) >= 70).length;
  const highRiskClients = clients.filter(
    (c) => c.health_zone === 'RED' || c.health_zone === 'YELLOW'
  ).length;
  const improvingClients = clients.filter((c) => c.health_trend === 'IMPROVING').length;

  const generateInterventions = async () => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('intervention-recommender');
      if (error) throw error;
      toast({ 
        title: 'Interventions Generated', 
        description: `Created ${data?.interventions_created || 0} recommendations` 
      });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
  };

  const metrics = [
    {
      label: 'High Churn Risk (30 days)',
      value: predictedChurns,
      icon: AlertCircle,
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
    },
    {
      label: 'Needs Intervention',
      value: highRiskClients,
      icon: Users,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
    },
    {
      label: 'Improving This Week',
      value: improvingClients,
      icon: TrendingUp,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
  ];

  return (
    <div className="space-y-4">
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
      
      {highRiskClients > 0 && (
        <div className="flex justify-end">
          <Button 
            onClick={generateInterventions} 
            disabled={isGenerating}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Zap className="h-4 w-4" />
            )}
            Generate AI Interventions
          </Button>
        </div>
      )}
    </div>
  );
}

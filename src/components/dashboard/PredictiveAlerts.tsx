import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, TrendingUp, Users, Zap, Loader2, Clock, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

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
  const criticalClients = clients.filter((c) => c.risk_category === 'CRITICAL').length;

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
      label: 'Critical Risk',
      sublabel: 'Immediate attention needed',
      value: criticalClients,
      icon: AlertCircle,
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
      borderColor: 'border-destructive/30',
      glowClass: 'shadow-glow-danger',
      isPulsing: criticalClients > 0,
      urgency: 'critical',
    },
    {
      label: 'High Churn Risk',
      sublabel: 'Next 30 days',
      value: predictedChurns,
      icon: Clock,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
      borderColor: 'border-orange-500/30',
      glowClass: '',
      isPulsing: predictedChurns > 5,
      urgency: 'high',
    },
    {
      label: 'Needs Intervention',
      sublabel: 'Yellow & Red zones',
      value: highRiskClients,
      icon: Users,
      color: 'text-warning',
      bgColor: 'bg-warning/10',
      borderColor: 'border-warning/30',
      glowClass: '',
      isPulsing: false,
      urgency: 'medium',
    },
    {
      label: 'Improving',
      sublabel: 'Positive momentum',
      value: improvingClients,
      icon: TrendingUp,
      color: 'text-success',
      bgColor: 'bg-success/10',
      borderColor: 'border-success/30',
      glowClass: '',
      isPulsing: false,
      urgency: 'info',
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Predictive Alerts
          </h3>
          {criticalClients > 0 && (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive" />
            </span>
          )}
        </div>
        {highRiskClients > 0 && (
          <Button 
            onClick={generateInterventions} 
            disabled={isGenerating}
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
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric) => (
          <Card 
            key={metric.label} 
            className={cn(
              'relative overflow-hidden transition-all duration-300 border',
              metric.bgColor,
              metric.borderColor,
              metric.isPulsing && 'pulse-glow',
              'hover:-translate-y-0.5 hover:shadow-lg cursor-pointer'
            )}
          >
            <div className="p-5">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">{metric.label}</p>
                  <p className="text-xs text-muted-foreground">{metric.sublabel}</p>
                  <p className="text-3xl font-bold font-mono mt-2">{metric.value}</p>
                </div>
                <div className={cn('p-2.5 rounded-lg', metric.bgColor)}>
                  <metric.icon className={cn('h-6 w-6', metric.color)} />
                </div>
              </div>
              
              {metric.value > 0 && (
                <div className="mt-4 pt-3 border-t border-border/30">
                  <Button variant="ghost" size="sm" className="gap-1 px-0 h-auto text-xs text-muted-foreground hover:text-foreground">
                    Take Action <ArrowRight className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
            
            {/* Urgency indicator line */}
            {metric.urgency === 'critical' && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-destructive animate-pulse" />
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

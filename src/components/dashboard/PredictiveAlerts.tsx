import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';
import { AlertCircle, TrendingUp, Users, Sparkles, Loader2 } from 'lucide-react';

interface PredictiveAlertsProps {
  clients: any[];
  summary: any;
}

export function PredictiveAlerts({ clients, summary }: PredictiveAlertsProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [aiRecommendations, setAiRecommendations] = useState<any>(null);

  const predictedChurns = clients.filter((c) => (c.predictive_risk_score || 0) >= 70).length;
  const highRiskClients = clients.filter(
    (c) => c.risk_category === 'CRITICAL' || c.risk_category === 'HIGH'
  ).length;
  const improvingClients = clients.filter((c) => c.momentum_indicator === 'ACCELERATING').length;

  const handleGetAIRecommendations = async () => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('ptd-agent', {
        body: {
          query: `Based on current client health data, which 5 clients need immediate action and why? Include specific reasons and recommended actions for each. Context: ${highRiskClients} high-risk clients, ${predictedChurns} predicted churns.`,
          action: 'recommend',
          context: {
            highRiskClients,
            predictedChurns,
            topRiskClients: clients
              .filter((c) => c.risk_category === 'CRITICAL' || c.risk_category === 'HIGH')
              .slice(0, 10)
              .map(c => ({ email: c.email, score: c.health_score, risk: c.predictive_risk_score }))
          }
        }
      });

      if (error) throw error;

      setAiRecommendations(data?.response || 'No recommendations generated.');
      setShowRecommendations(true);

      toast({
        title: 'AI Recommendations Generated',
        description: 'Review the suggested actions for high-risk clients.',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to generate AI recommendations. Make sure ptd-agent is deployed.',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

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
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Predictive Alerts</h2>
          <Button
            onClick={handleGetAIRecommendations}
            disabled={isGenerating || highRiskClients === 0}
            className="gap-2"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Get AI Recommendations
              </>
            )}
          </Button>
        </div>

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
      </div>

      <Dialog open={showRecommendations} onOpenChange={setShowRecommendations}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI-Generated Recommendations
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            <div className="prose prose-sm max-w-none">
              {aiRecommendations && (
                <div className="whitespace-pre-wrap text-sm">
                  {aiRecommendations}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

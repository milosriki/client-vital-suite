import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { Brain, Sparkles, Loader2, AlertCircle, TrendingUp, Users } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface AIRecommendationsWidgetProps {
  clients: any[];
}

export function AIRecommendationsWidget({ clients }: AIRecommendationsWidgetProps) {
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [recommendations, setRecommendations] = useState<any>(null);

  const highRiskCount = clients.filter(
    (c) => c.risk_category === 'CRITICAL' || c.risk_category === 'HIGH'
  ).length;

  const handleGenerateRecommendations = async () => {
    setIsGenerating(true);
    setShowRecommendations(true);

    try {
      const topRiskClients = clients
        .filter((c) => c.risk_category === 'CRITICAL' || c.risk_category === 'HIGH')
        .slice(0, 10);

      const { data, error } = await supabase.functions.invoke('ptd-agent', {
        body: {
          query: `Provide the top 3 most important actions I should take today based on current client health data.

For each recommendation:
1. What action to take
2. Why it matters (impact/urgency)
3. How to execute it

Context: ${highRiskCount} high-risk clients identified.`,
          action: 'recommend',
          context: {
            highRiskClients: highRiskCount,
            topClients: topRiskClients.map(c => ({
              email: c.email,
              name: `${c.firstname} ${c.lastname}`,
              healthScore: c.health_score,
              riskScore: c.predictive_risk_score,
              zone: c.health_zone,
              patternStatus: c.pattern_status
            }))
          }
        }
      });

      if (error) throw error;

      setRecommendations(data?.response || 'No recommendations available.');
    } catch (error: any) {
      console.error('Error generating recommendations:', error);
      setRecommendations(`Error: ${error?.message || 'Failed to generate recommendations.'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card className="border-primary bg-gradient-to-r from-primary/5 to-background">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          AI Recommendations
        </CardTitle>
        <CardDescription>
          Get AI-powered action items based on current client health
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4 inline mr-1" />
            {highRiskCount} high-risk clients detected
          </div>
          <Button
            onClick={handleGenerateRecommendations}
            variant="default"
            size="sm"
            disabled={isGenerating}
            className="gap-2"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Get AI Recommendations
              </>
            )}
          </Button>
        </div>

        {showRecommendations && recommendations && (
          <Alert>
            <Brain className="h-4 w-4" />
            <AlertTitle>AI Recommendations</AlertTitle>
            <AlertDescription className="mt-2">
              <div className="whitespace-pre-wrap text-sm">
                {recommendations}
              </div>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

export default AIRecommendationsWidget;

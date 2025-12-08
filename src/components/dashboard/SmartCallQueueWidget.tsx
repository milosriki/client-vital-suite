import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { Phone, Sparkles, Loader2, User } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface SmartCallQueueWidgetProps {
  clients: any[];
}

export function SmartCallQueueWidget({ clients }: SmartCallQueueWidgetProps) {
  const [showQueue, setShowQueue] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [callQueue, setCallQueue] = useState<any>(null);

  const handleGenerateQueue = async () => {
    setIsGenerating(true);
    setShowQueue(true);

    try {
      const atRiskClients = clients
        .filter((c) => c.risk_category === 'CRITICAL' || c.risk_category === 'HIGH')
        .slice(0, 10);

      const { data, error } = await supabase.functions.invoke('ptd-agent', {
        body: {
          query: `Generate a smart call queue for today.

Show the top 5 clients to call, in priority order:
1. Client name
2. Priority (URGENT/HIGH/MEDIUM)
3. Reason to call
4. Draft WhatsApp message

Focus on: pattern breaks, health drops, package expiring, no recent contact.`,
          action: 'call_queue',
          context: {
            date: new Date(),
            atRiskClients: atRiskClients.map(c => ({
              email: c.email,
              name: `${c.firstname} ${c.lastname}`,
              healthScore: c.health_score,
              riskScore: c.predictive_risk_score,
              zone: c.health_zone,
              daysSinceLastSession: c.days_since_last_session,
              patternStatus: c.pattern_status
            }))
          }
        }
      });

      if (error) throw error;

      setCallQueue(data?.response || 'No call queue generated.');
    } catch (error: any) {
      console.error('Error generating queue:', error);
      setCallQueue(`Error: ${error?.message || 'Failed to generate call queue.'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card className="border-secondary">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Phone className="h-5 w-5" />
          Smart Call Queue
        </CardTitle>
        <CardDescription>
          AI suggests who to call today with priority and draft messages
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          onClick={handleGenerateQueue}
          variant="secondary"
          className="w-full gap-2"
          disabled={isGenerating}
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating Queue...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Generate My Call Queue
            </>
          )}
        </Button>

        {showQueue && callQueue && (
          <Alert>
            <Phone className="h-4 w-4" />
            <AlertTitle>Today's Call Queue</AlertTitle>
            <AlertDescription className="mt-2">
              <div className="whitespace-pre-wrap text-sm">
                {callQueue}
              </div>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

export default SmartCallQueueWidget;

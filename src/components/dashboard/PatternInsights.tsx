import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Lightbulb, TrendingUp, AlertTriangle, Users } from 'lucide-react';

interface PatternInsightsProps {
  patterns: any;
  clients: any[];
}

export function PatternInsights({ patterns, clients }: PatternInsightsProps) {
  const generateInsights = () => {
    const insights = [];

    // Coach-based patterns
    const coachGroups = clients.reduce((acc, client) => {
      const coach = client.assigned_coach || 'Unassigned';
      if (!acc[coach]) acc[coach] = [];
      acc[coach].push(client);
      return acc;
    }, {} as Record<string, any[]>);

    Object.entries(coachGroups).forEach(([coach, coachClients]: [string, any[]]) => {
      const redCount = coachClients.filter((c) => c.health_zone === 'RED').length;
      if (redCount > 3) {
        insights.push({
          icon: AlertTriangle,
          color: 'text-destructive',
          text: `${redCount} clients in RED zone all have Coach ${coach}`,
        });
      }
    });

    // Session-based patterns
    const recentSessionClients = clients.filter((c) => (c.days_since_last_session || 0) <= 7);
    const oldSessionClients = clients.filter((c) => (c.days_since_last_session || 0) > 30);

    if (recentSessionClients.length > 0 && oldSessionClients.length > 0) {
      const recentAvg =
        recentSessionClients.reduce((sum, c) => sum + (c.health_score || 0), 0) /
        recentSessionClients.length;
      const oldAvg =
        oldSessionClients.reduce((sum, c) => sum + (c.health_score || 0), 0) / oldSessionClients.length;
      const diff = ((recentAvg - oldAvg) / oldAvg) * 100;

      if (Math.abs(diff) > 10) {
        insights.push({
          icon: TrendingUp,
          color: 'text-green-500',
          text: `Clients with recent sessions have ${Math.abs(diff).toFixed(0)}% ${
            diff > 0 ? 'better' : 'worse'
          } health scores`,
        });
      }
    }

    // Trend patterns
    const improvingCount = clients.filter((c) => c.health_trend === 'IMPROVING').length;
    const decliningCount = clients.filter((c) => c.health_trend === 'DECLINING').length;

    if (improvingCount > decliningCount * 1.5) {
      insights.push({
        icon: TrendingUp,
        color: 'text-green-500',
        text: `${improvingCount} clients showing positive health trends this period`,
      });
    }

    // Weekly patterns from database
    if (patterns?.pattern_insights) {
      insights.push({
        icon: Lightbulb,
        color: 'text-blue-500',
        text: patterns.pattern_insights,
      });
    }

    return insights;
  };

  const insights = generateInsights();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5" />
          Pattern Insights
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {insights.length === 0 ? (
            <div className="col-span-full text-center text-muted-foreground py-8">
              No significant patterns detected yet. Check back after more data is collected.
            </div>
          ) : (
            insights.map((insight, index) => (
              <Card key={index} className="border-l-4 border-l-primary">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <insight.icon className={`h-5 w-5 mt-1 ${insight.color}`} />
                    <p className="text-sm">{insight.text}</p>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { format } from "date-fns";

interface WeeklyPattern {
  id: string;
  client_id: string;
  week_start: string;
  pattern_summary: {
    avg_health_score?: number;
    total_clients?: number;
    green_clients?: number;
    yellow_clients?: number;
    red_clients?: number;
    purple_clients?: number;
    clients_improving?: number;
    clients_declining?: number;
  } | null;
  ai_insights: string | null;
  created_at: string | null;
}

interface WeeklyAnalyticsProps {
  patterns: WeeklyPattern[];
}

export const WeeklyAnalytics = ({ patterns }: WeeklyAnalyticsProps) => {
  const latestWeek = patterns[0];
  const previousWeek = patterns[1];

  const calculateChange = (current: number | null, previous: number | null) => {
    if (!current || !previous || previous === 0) return null;
    return ((current - previous) / previous) * 100;
  };

  const renderTrend = (change: number | null) => {
    if (change === null) return <Minus className="h-4 w-4 text-gray-400" />;
    if (change > 0) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (change < 0) return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-gray-400" />;
  };

  if (!latestWeek) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Weekly Patterns</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <p>No weekly data available yet</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const greenChange = calculateChange(latestWeek.pattern_summary?.green_clients ?? null, previousWeek?.pattern_summary?.green_clients ?? null);
  const yellowChange = calculateChange(latestWeek.pattern_summary?.yellow_clients ?? null, previousWeek?.pattern_summary?.yellow_clients ?? null);
  const redChange = calculateChange(latestWeek.pattern_summary?.red_clients ?? null, previousWeek?.pattern_summary?.red_clients ?? null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Weekly Patterns</span>
          <Badge variant="outline">
            Week of {format(new Date(latestWeek.week_start), 'MMM dd, yyyy')}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Average Health Score */}
          <div className="flex items-center justify-between p-4 bg-primary/5 rounded-lg">
            <div>
              <p className="text-sm text-muted-foreground">Average Health Score</p>
              <p className="text-2xl font-bold">{latestWeek.pattern_summary?.avg_health_score?.toFixed(1) || 'N/A'}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Total Clients</p>
              <p className="text-2xl font-bold">{latestWeek.pattern_summary?.total_clients || 0}</p>
            </div>
          </div>

          {/* Zone Distribution Changes */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium">This Week vs Last Week</h4>
            
            <div className="flex items-center justify-between p-3 bg-green-500/5 rounded-lg border border-green-500/20">
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-sm font-medium">Green Zone</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-lg font-bold">{latestWeek.pattern_summary?.green_clients || 0}</span>
                {renderTrend(greenChange)}
                {greenChange !== null && (
                  <span className={`text-xs ${greenChange > 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {greenChange > 0 ? '+' : ''}{greenChange.toFixed(1)}%
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-yellow-500/5 rounded-lg border border-yellow-500/20">
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <span className="text-sm font-medium">Yellow Zone</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-lg font-bold">{latestWeek.pattern_summary?.yellow_clients || 0}</span>
                {renderTrend(yellowChange)}
                {yellowChange !== null && (
                  <span className={`text-xs ${yellowChange < 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {yellowChange > 0 ? '+' : ''}{yellowChange.toFixed(1)}%
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-red-500/5 rounded-lg border border-red-500/20">
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span className="text-sm font-medium">Red Zone</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-lg font-bold">{latestWeek.pattern_summary?.red_clients || 0}</span>
                {renderTrend(redChange)}
                {redChange !== null && (
                  <span className={`text-xs ${redChange < 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {redChange > 0 ? '+' : ''}{redChange.toFixed(1)}%
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Client Movement */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-green-500/5 rounded-lg border border-green-500/20">
              <p className="text-xs text-muted-foreground mb-1">Improving</p>
              <p className="text-2xl font-bold text-green-500">{latestWeek.pattern_summary?.clients_improving || 0}</p>
            </div>
            <div className="p-3 bg-red-500/5 rounded-lg border border-red-500/20">
              <p className="text-xs text-muted-foreground mb-1">Declining</p>
              <p className="text-2xl font-bold text-red-500">{latestWeek.pattern_summary?.clients_declining || 0}</p>
            </div>
          </div>

          {/* Insights */}
          {latestWeek.ai_insights && (
            <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
              <p className="text-xs font-medium text-primary mb-2">Pattern Insights</p>
              <p className="text-sm text-muted-foreground">{latestWeek.ai_insights}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
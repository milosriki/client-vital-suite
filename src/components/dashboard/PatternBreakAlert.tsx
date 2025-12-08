import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { TrendingDown, TrendingUp, Activity, Phone, AlertCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface PatternBreak {
  client_email: string;
  client_name: string;
  avg_calls_per_week: number;
  calls_this_week: number;
  deviation_pct: number;
  pattern_status: string;
  health_zone: string;
  assigned_coach: string;
}

interface PatternHistory {
  analysis_date: string;
  calls_this_week: number;
  avg_calls_per_week: number;
}

export function PatternBreakAlert() {
  const queryClient = useQueryClient();
  const [selectedClient, setSelectedClient] = useState<PatternBreak | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Fetch pattern breaks
  const { data: patternBreaks = [], isLoading } = useQuery({
    queryKey: ['pattern-breaks'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_pattern_breaks', {
        days_back: 7
      });

      if (error) throw error;
      return data as PatternBreak[];
    },
    refetchInterval: 60000, // Refresh every minute
  });

  // Fetch pattern history for selected client
  const { data: patternHistory = [] } = useQuery({
    queryKey: ['pattern-history', selectedClient?.client_email],
    queryFn: async () => {
      if (!selectedClient) return [];

      const { data, error } = await supabase
        .from('call_pattern_analysis')
        .select('analysis_date, calls_this_week, avg_calls_per_week')
        .eq('client_email', selectedClient.client_email)
        .order('analysis_date', { ascending: true })
        .limit(30);

      if (error) throw error;
      return data as PatternHistory[];
    },
    enabled: !!selectedClient,
  });

  const handleRunAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-call-patterns', {
        body: { limit: 200 }
      });

      if (error) throw error;

      toast({
        title: 'Pattern Analysis Complete',
        description: `Analyzed ${data?.analyzed || 0} clients. Found ${data?.pattern_breaks || 0} pattern breaks.`,
      });

      queryClient.invalidateQueries({ queryKey: ['pattern-breaks'] });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to run pattern analysis.',
        variant: 'destructive',
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PATTERN_BREAK':
        return <Badge variant="destructive">PATTERN BREAK</Badge>;
      case 'BELOW_PATTERN':
        return <Badge className="bg-orange-500">BELOW PATTERN</Badge>;
      case 'ABOVE_PATTERN':
        return <Badge className="bg-blue-500">ABOVE PATTERN</Badge>;
      default:
        return <Badge variant="secondary">NORMAL</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    if (status === 'PATTERN_BREAK' || status === 'BELOW_PATTERN') {
      return <TrendingDown className="h-4 w-4 text-red-500" />;
    }
    if (status === 'ABOVE_PATTERN') {
      return <TrendingUp className="h-4 w-4 text-blue-500" />;
    }
    return <Activity className="h-4 w-4 text-green-500" />;
  };

  const chartData = patternHistory.map((item) => ({
    date: new Date(item.analysis_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    actual: item.calls_this_week,
    average: item.avg_calls_per_week,
  }));

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Call Pattern Breaks</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground">Loading pattern analysis...</div>
        </CardContent>
      </Card>
    );
  }

  const criticalBreaks = patternBreaks.filter(p => p.pattern_status === 'PATTERN_BREAK').length;
  const belowPattern = patternBreaks.filter(p => p.pattern_status === 'BELOW_PATTERN').length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Call Pattern Breaks
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {criticalBreaks > 0 && (
                <span className="text-red-500 font-semibold">
                  {criticalBreaks} critical breaks
                </span>
              )}
              {criticalBreaks > 0 && belowPattern > 0 && ', '}
              {belowPattern > 0 && (
                <span className="text-orange-500 font-semibold">
                  {belowPattern} below pattern
                </span>
              )}
              {patternBreaks.length === 0 && (
                <span className="text-green-500">All clients on track!</span>
              )}
            </p>
          </div>
          <Button
            onClick={handleRunAnalysis}
            disabled={isAnalyzing}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            {isAnalyzing ? (
              <>
                <Activity className="h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <AlertCircle className="h-4 w-4" />
                Run Analysis
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {patternBreaks.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Activity className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No pattern breaks detected</p>
            <p className="text-sm">All clients are maintaining their usual call frequency</p>
          </div>
        ) : (
          <div className="space-y-3">
            {patternBreaks.map((pattern) => (
              <Card key={pattern.client_email} className="border-l-4 border-l-red-500">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(pattern.pattern_status)}
                        <h3 className="font-semibold">{pattern.client_name}</h3>
                        {getStatusBadge(pattern.pattern_status)}
                        {pattern.health_zone && (
                          <Badge variant="outline">{pattern.health_zone}</Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Usual:</span>{' '}
                          <span className="font-medium">
                            {pattern.avg_calls_per_week.toFixed(1)}x/week
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">This Week:</span>{' '}
                          <span className="font-medium text-red-500">
                            {pattern.calls_this_week} calls
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Change:</span>{' '}
                          <span className={`font-medium ${pattern.deviation_pct < 0 ? 'text-red-500' : 'text-green-500'}`}>
                            {pattern.deviation_pct > 0 ? '+' : ''}{pattern.deviation_pct.toFixed(0)}%
                          </span>
                        </div>
                      </div>
                      {pattern.assigned_coach && (
                        <p className="text-sm text-muted-foreground">
                          Coach: <span className="font-medium">{pattern.assigned_coach}</span>
                        </p>
                      )}
                      <p className="text-sm text-muted-foreground italic">
                        Usually books {pattern.avg_calls_per_week.toFixed(1)}x/week, only {pattern.calls_this_week} this week
                      </p>
                    </div>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedClient(pattern)}
                        >
                          View Pattern
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-3xl">
                        <DialogHeader>
                          <DialogTitle>{pattern.client_name} - Call Pattern History</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="grid grid-cols-3 gap-4">
                            <div className="text-center p-4 bg-muted rounded-lg">
                              <div className="text-2xl font-bold">
                                {pattern.avg_calls_per_week.toFixed(1)}
                              </div>
                              <div className="text-sm text-muted-foreground">Avg/Week</div>
                            </div>
                            <div className="text-center p-4 bg-muted rounded-lg">
                              <div className="text-2xl font-bold text-red-500">
                                {pattern.calls_this_week}
                              </div>
                              <div className="text-sm text-muted-foreground">This Week</div>
                            </div>
                            <div className="text-center p-4 bg-muted rounded-lg">
                              <div className={`text-2xl font-bold ${pattern.deviation_pct < 0 ? 'text-red-500' : 'text-green-500'}`}>
                                {pattern.deviation_pct > 0 ? '+' : ''}{pattern.deviation_pct.toFixed(0)}%
                              </div>
                              <div className="text-sm text-muted-foreground">Deviation</div>
                            </div>
                          </div>
                          {chartData.length > 0 && (
                            <div className="h-64">
                              <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData}>
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis dataKey="date" />
                                  <YAxis />
                                  <Tooltip />
                                  <Line
                                    type="monotone"
                                    dataKey="actual"
                                    stroke="#ef4444"
                                    strokeWidth={2}
                                    name="Actual Calls"
                                  />
                                  <Line
                                    type="monotone"
                                    dataKey="average"
                                    stroke="#3b82f6"
                                    strokeWidth={2}
                                    strokeDasharray="5 5"
                                    name="Average"
                                  />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          )}
                          <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg">
                            <h4 className="font-semibold text-amber-900 mb-2">Recommended Action</h4>
                            <p className="text-sm text-amber-800">
                              Reach out personally. This client usually calls {pattern.avg_calls_per_week.toFixed(1)} times per week
                              but has only called {pattern.calls_this_week} time(s) this week. Early intervention can prevent churn.
                            </p>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

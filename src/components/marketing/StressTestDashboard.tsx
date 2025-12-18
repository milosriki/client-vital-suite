import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, TrendingUp, CheckCircle, XCircle, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useDedupedQuery } from '@/hooks/useDedupedQuery';

interface StressTestResult {
  question: string;
  answer: any;
  insights: string[];
  recommendations: string[];
  status: 'excellent' | 'good' | 'warning' | 'critical';
}

interface StressTestResponse {
  success: boolean;
  summary: {
    total_questions: number;
    excellent: number;
    good: number;
    warning: number;
    critical: number;
  };
  results: StressTestResult[];
  generated_at: string;
}

export function StressTestDashboard() {
  const { data, isLoading, refetch } = useDedupedQuery<StressTestResponse>({
    queryKey: ['marketing-stress-test'],
    dedupeIntervalMs: 1000,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('marketing-stress-test');
      if (error) throw error;
      return data;
    },
    refetchInterval: 3600000, // Every hour
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'excellent':
        return <Badge className="bg-green-500">Excellent</Badge>;
      case 'good':
        return <Badge className="bg-blue-500">Good</Badge>;
      case 'warning':
        return <Badge className="bg-yellow-500">Warning</Badge>;
      case 'critical':
        return <Badge className="bg-red-500">Critical</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'excellent':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'good':
        return <TrendingUp className="w-5 h-5 text-blue-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'critical':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
        <span className="ml-3 text-white/60">Running marketing stress test...</span>
      </div>
    );
  }

  if (!data?.success) {
    return (
      <Card className="bg-red-500/10 border-red-500/30">
        <CardContent className="p-6">
          <p className="text-red-400">Failed to load stress test results</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Marketing Stress Test</h1>
          <p className="text-white/60 mt-1">
            Dynamic analysis of your marketing performance across Facebook, HubSpot, and Stripe
          </p>
          <p className="text-xs text-white/40 mt-1">
            Last updated: {new Date(data.generated_at).toLocaleString()}
          </p>
        </div>
        <Button onClick={() => refetch()} variant="outline" className="border-cyan-500/50 text-cyan-400">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="bg-green-500/10 border-green-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white/60">Excellent</p>
                <p className="text-2xl font-bold text-green-400">{data.summary.excellent}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-400 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-blue-500/10 border-blue-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white/60">Good</p>
                <p className="text-2xl font-bold text-blue-400">{data.summary.good}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-blue-400 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-yellow-500/10 border-yellow-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white/60">Warning</p>
                <p className="text-2xl font-bold text-yellow-400">{data.summary.warning}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-yellow-400 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-red-500/10 border-red-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white/60">Critical</p>
                <p className="text-2xl font-bold text-red-400">{data.summary.critical}</p>
              </div>
              <XCircle className="w-8 h-8 text-red-400 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Results */}
      <div className="space-y-4">
        {data.results.map((result, idx) => (
          <Card key={idx} className={`border-2 ${
            result.status === 'excellent' ? 'border-green-500/30 bg-green-500/5' :
            result.status === 'good' ? 'border-blue-500/30 bg-blue-500/5' :
            result.status === 'warning' ? 'border-yellow-500/30 bg-yellow-500/5' :
            'border-red-500/30 bg-red-500/5'
          }`}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  {getStatusIcon(result.status)}
                  <div>
                    <CardTitle className="text-white">{result.question}</CardTitle>
                    <div className="flex gap-2 mt-2">
                      {getStatusBadge(result.status)}
                    </div>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Answer */}
              <div>
                <h4 className="text-sm font-semibold text-white/80 mb-2">Answer:</h4>
                <div className="bg-black/20 rounded-lg p-4">
                  {typeof result.answer === 'object' ? (
                    <pre className="text-sm text-white/70 whitespace-pre-wrap">
                      {JSON.stringify(result.answer, null, 2)}
                    </pre>
                  ) : (
                    <p className="text-white/70">{result.answer}</p>
                  )}
                </div>
              </div>

              {/* Insights */}
              {result.insights.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-white/80 mb-2">Insights:</h4>
                  <ul className="list-disc list-inside space-y-1">
                    {result.insights.map((insight, i) => (
                      <li key={i} className="text-sm text-white/70">{insight}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Recommendations */}
              {result.recommendations.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-cyan-400 mb-2">Recommendations:</h4>
                  <ul className="list-disc list-inside space-y-1">
                    {result.recommendations.map((rec, i) => (
                      <li key={i} className="text-sm text-cyan-300">{rec}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Tables for structured data */}
              {result.answer.all_campaigns && Array.isArray(result.answer.all_campaigns) && (
                <div>
                  <h4 className="text-sm font-semibold text-white/80 mb-2">All Campaigns:</h4>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {Object.keys(result.answer.all_campaigns[0] || {}).map((key) => (
                            <TableHead key={key} className="text-white/60 capitalize">
                              {key.replace(/_/g, ' ')}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {result.answer.all_campaigns.slice(0, 10).map((item: any, i: number) => (
                          <TableRow key={i}>
                            {Object.values(item).map((val: any, j: number) => (
                              <TableCell key={j} className="text-white/70">
                                {typeof val === 'number' ? val.toLocaleString() : String(val || 'N/A')}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
